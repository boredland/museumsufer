import { classifyMusic, classifyTalk, detectTalkLanguage } from "@museumsufer/classify";
import {
  dateOffset,
  decodeEntities,
  GERMAN_MONTHS,
  normalizeUrl,
  sanitizeImageUrl,
  stripHtml,
  todayIso,
  truncate,
} from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.romanfabrik.de";
const CALENDAR_URL = `${BASE}/programm/kalender`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;

/**
 * Romanfabrik runs TYPO3 + calendarize and tags each event with one or more
 * of `Ton` (music), `Text` (literature), `Thema` (lecture/discourse), `Bild`
 * (visual). Previously each consumer app filtered to a single tag with an
 * inverse drop-list — the hub emits everything and labels from the upstream
 * tag, which is canonical. Detail-page enrichment runs for every event so
 * both music and talk consumers get the same image/price/ticket metadata.
 */

const EVENT_LI_RE = /<li\s+class="event-\d+\s+panel\s+panel-default\s+state-([A-Za-z-]+)\s+([^"]*)"[\s\S]*?<\/li>/g;
const HEADER_DATE_RE =
  /<div\s+class="eventHeader[^"]*">\s*(\d{1,2})\/<span\s+class="head-dat-small">(\d{1,2})<\/span>\s*<\/div>/;
const TITLE_LINK_RE = /<h3>\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/;
const FULL_DATE_RE =
  /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),\s+(\d{1,2})\.\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/;
const TIME_RE = /\/\s*(\d{1,2})[:.](\d{2})/;
const PRICE_LINE_RE = /(\d+(?:[.,]\d{1,2})?)\s*Euro/gi;
const RESERVIX_RE = /href="(https?:\/\/[^"]*reservix[^"]+)"/i;
const DETAIL_IMG_RE = /<img[^>]+class="img-rounded"[^>]+src="([^"]+)"/i;
const DETAIL_TEXT_RE = /<div\s+class="text">([\s\S]*?)<\/div>\s*<dl/i;
const DETAIL_PRICE_RE = /<h4[^>]*>\s*Eintritt\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i;

export async function scrapeRomanfabrik(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(90);
  const html = await fetchText(CALENDAR_URL);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(EVENT_LI_RE)) {
    const state = m[1].toLowerCase();
    if (state === "canceled") continue;

    const categories = m[2].trim().split(/\s+/).filter(Boolean);
    const parsed = parseListing(m[0], categories);
    if (!parsed) continue;
    if (parsed.event.date < today || parsed.event.date > horizon) continue;
    if (seen.has(parsed.dedupKey)) continue;
    seen.add(parsed.dedupKey);

    events.push(parsed.event);
  }

  await enrichWithDetails(events);
  return { source_slug: "romanfabrik", display_name: "Romanfabrik Frankfurt", events };
}

interface Parsed {
  event: CanonicalScrapedEvent;
  dedupKey: string;
}

function parseListing(block: string, categories: readonly string[]): Parsed | null {
  const titleMatch = TITLE_LINK_RE.exec(block);
  if (!titleMatch) return null;
  const detailPath = decodeEntities(titleMatch[1]);
  const detailUrl = normalizeUrl(detailPath, BASE);
  if (!detailUrl) return null;
  const slug = slugFromPath(detailPath);

  const { title, subtitle } = parseTitleBlock(titleMatch[2]);
  if (!title) return null;

  const fullDate = FULL_DATE_RE.exec(block);
  let date: string | null = null;
  if (fullDate) {
    date = toIsoDate(fullDate[2], fullDate[3], fullDate[4]);
  } else {
    const headerDate = HEADER_DATE_RE.exec(block);
    if (headerDate) date = inferDateFromDayMonth(headerDate[1], headerDate[2]);
  }
  if (!date) return null;

  const time = parseTime(block);
  const labels = labelsFromCategories(title, subtitle, categories);

  const event: CanonicalScrapedEvent = {
    source_event_id: slug,
    title,
    subtitle,
    description: null,
    date,
    time,
    end_time: null,
    detail_url: detailUrl,
    ticket_url: null,
    image_url: null,
    language: detectTalkLanguage(title, subtitle),
    price_min: null,
    price_max: null,
    performers: subtitle,
    venue_room: null,
    raw_category: categories.join(" "),
    labels,
  };
  return { event, dedupKey: `${slug}|${date}|${time ?? ""}` };
}

function labelsFromCategories(title: string, subtitle: string | null, categories: readonly string[]): ScrapedLabel[] {
  const labels: ScrapedLabel[] = [];
  if (categories.includes("Ton")) {
    labels.push({
      label: `music:${classifyMusic(title, subtitle, null, "world")}`,
      confidence: 1.0,
      classifier: "upstream-tag",
    });
  }
  if (categories.includes("Text")) {
    labels.push({ label: "talk:lesung", confidence: 1.0, classifier: "upstream-tag" });
  }
  if (categories.includes("Thema")) {
    labels.push({
      label: `talk:${classifyTalk(title, subtitle).toLowerCase()}`,
      confidence: 0.95,
      classifier: "upstream-tag",
    });
  }
  return labels;
}

function parseTitleBlock(html: string): { title: string; subtitle: string | null } {
  const strongMatch = /<strong>([\s\S]*?)<\/strong>/.exec(html);
  if (!strongMatch) {
    const fallback = stripHtml(decodeEntities(html)).trim();
    return { title: fallback, subtitle: null };
  }
  const title = stripHtml(decodeEntities(strongMatch[1])).trim();
  const after = html.slice((strongMatch.index ?? 0) + strongMatch[0].length);
  const subtitleText = stripHtml(decodeEntities(after)).trim();
  return { title, subtitle: subtitleText || null };
}

function parseTime(block: string): string | null {
  const m = TIME_RE.exec(block);
  if (!m) return null;
  const hh = m[1].padStart(2, "0");
  if (hh === "00" && m[2] === "00") return null;
  return `${hh}:${m[2]}`;
}

function toIsoDate(day: string, monthName: string, year: string): string | null {
  const month = GERMAN_MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function inferDateFromDayMonth(day: string, month: string): string | null {
  const today = todayIso();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const dd = day.padStart(2, "0");
  const mm = month.padStart(2, "0");
  const candidate = `${currentYear}-${mm}-${dd}`;
  if (candidate >= today) return candidate;
  return `${currentYear + 1}-${mm}-${dd}`;
}

function slugFromPath(path: string): string {
  const m = /\/termin\/([^/?#]+)/.exec(path);
  return m ? m[1] : path.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9-]/gi, "-");
}

async function enrichWithDetails(events: CanonicalScrapedEvent[]): Promise<void> {
  for (const ev of events) {
    if (!ev.detail_url) continue;
    await sleep(THROTTLE_MS);
    try {
      const detail = await fetchDetail(ev.detail_url);
      if (detail.imageUrl) ev.image_url = detail.imageUrl;
      if (detail.description) ev.description = detail.description;
      if (detail.ticketUrl) ev.ticket_url = detail.ticketUrl;
      if (detail.priceMin != null) ev.price_min = detail.priceMin;
      if (detail.priceMax != null) ev.price_max = detail.priceMax;
    } catch {
      // Detail enrichment is best-effort — listing already has the essentials.
    }
  }
}

interface Detail {
  imageUrl: string | null;
  description: string | null;
  ticketUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
}

async function fetchDetail(url: string): Promise<Detail> {
  const html = await fetchText(url);
  const imgRaw = DETAIL_IMG_RE.exec(html)?.[1];
  const imageUrl = imgRaw ? sanitizeImageUrl(normalizeUrl(decodeEntities(imgRaw), BASE)) : null;

  const textRaw = DETAIL_TEXT_RE.exec(html)?.[1];
  const description = textRaw ? truncate(stripHtml(decodeEntities(textRaw)), 800) : null;

  const ticketRaw = RESERVIX_RE.exec(html)?.[1];
  const ticketUrl = ticketRaw ? decodeEntities(ticketRaw) : null;

  const priceRaw = DETAIL_PRICE_RE.exec(html)?.[1];
  const prices = priceRaw ? collectPrices(priceRaw) : [];

  return {
    imageUrl,
    description,
    ticketUrl,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length > 1 ? Math.max(...prices) : null,
  };
}

function collectPrices(text: string): number[] {
  const decoded = decodeEntities(text);
  const prices: number[] = [];
  for (const m of decoded.matchAll(PRICE_LINE_RE)) {
    const value = parseFloat(m[1].replace(",", "."));
    if (Number.isFinite(value) && value > 0 && value < 1000) prices.push(value);
  }
  return prices;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`romanfabrik fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
