import {
  berlinNow,
  dateOffset,
  decodeEntities,
  normalizeUrl,
  nullIfMidnight,
  stripHtml,
  todayIso,
  truncate,
} from "@museumsufer/core";
import { classify } from "../genre-heuristics";
import type { Genre, ScrapedEvent, ScrapeResult } from "../types";

/**
 * Shared scraping primitives for hr-Sinfonieorchester and hr-Bigband.
 * Both ensembles run the same HR/ARD calendar CMS; only the venue slug,
 * base host, list-page id ("veranstaltungen-NNN") and fallback genre differ.
 */

const HR_UA = "konzert.haus crawler / contact: jonas@bgdlabs.com";
const HR_THROTTLE_MS = 200;
const HR_HORIZON_DAYS = 180;
const HR_MAX_DETAIL_FETCHES = 25;

/**
 * Touring ensembles play far afield; only Frankfurt shows belong here.
 * Per task spec we keep the canonical HR + classical halls plus anything
 * whose city line explicitly mentions Frankfurt. Kronberg/Casals Forum
 * is intentionally excluded because Kronberg Academy has its own scraper.
 */
const FFM_ROOM_KEYWORDS = [
  "alte oper",
  "oper frankfurt",
  "bockenheimer depot",
  "hr-sendesaal",
  "hr-funkhaus",
  "hr-hörfunkstudio",
  "hr-hoerfunkstudio",
];

export interface HrVenueConfig {
  venueSlug: string;
  baseUrl: string;
  /** e.g. "veranstaltungen-110" for sinfonie, "veranstaltungen-112" for bigband. */
  listPath: string;
  defaultGenre: Genre;
  /** Stable id prefix for `slug` field (keeps cross-venue uniqueness when both share a date). */
  slugPrefix: string;
}

export async function scrapeHrVenue(cfg: HrVenueConfig): Promise<ScrapeResult> {
  const cards = await fetchAllMonths(cfg);
  const ffm = cards.filter(isFrankfurtArea);

  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();
  let detailFetches = 0;

  for (const card of ffm) {
    const dedup = `${card.detailUrl}|${card.date}|${card.time ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    let description: string | null = null;
    let priceMin: number | null = null;
    let priceMax: number | null = null;
    let ticketUrl = card.ticketUrl;
    let imageUrl = card.imageUrl;

    if (detailFetches < HR_MAX_DETAIL_FETCHES) {
      await sleep(HR_THROTTLE_MS);
      try {
        const detail = await fetchDetail(card.detailUrl);
        description = detail.description;
        priceMin = detail.priceMin;
        priceMax = detail.priceMax;
        if (!ticketUrl && detail.ticketUrl) ticketUrl = detail.ticketUrl;
        if (!imageUrl && detail.imageUrl) imageUrl = detail.imageUrl;
      } catch (err) {
        console.warn(`${cfg.venueSlug} detail fetch failed for ${card.detailUrl}:`, err);
      }
      detailFetches++;
    }

    const subtitle = card.subtitles.length ? card.subtitles.join(" — ") : null;
    events.push({
      slug: `${cfg.slugPrefix}-${card.eventId}`,
      title: card.title,
      subtitle,
      description,
      date: card.date,
      time: card.time,
      end_time: null,
      genre: classify(card.title, subtitle, description, cfg.defaultGenre),
      image_url: imageUrl,
      detail_url: card.detailUrl,
      ticket_url: ticketUrl,
      price_min: priceMin,
      price_max: priceMax,
      venue_room: card.venueRoom,
      performers: card.performers,
    });
  }

  return { venue_slug: cfg.venueSlug, events };
}

async function fetchAllMonths(cfg: HrVenueConfig): Promise<HrCard[]> {
  const today = todayIso();
  const horizon = dateOffset(HR_HORIZON_DAYS);
  const cards: HrCard[] = [];
  let first = true;

  for (const month of monthsInRange(horizon)) {
    if (!first) await sleep(HR_THROTTLE_MS);
    first = false;
    const html = await fetchMonthHtml(cfg, month);
    if (html === null) continue;
    for (const card of parseHrCalendarHtml(html, cfg.baseUrl)) {
      if (card.date < today || card.date > horizon) continue;
      cards.push(card);
    }
  }
  return cards;
}

function monthsInRange(horizonDate: string): string[] {
  const months: string[] = [];
  let cursor = berlinNow().startOf("month");
  while (cursor.format("YYYY-MM-DD") <= horizonDate) {
    months.push(cursor.format("YYYY-MM"));
    cursor = cursor.add(1, "month");
  }
  return months;
}

async function fetchMonthHtml(cfg: HrVenueConfig, month: string): Promise<string | null> {
  const url = `${cfg.baseUrl}/konzerte/${cfg.listPath}~_month-${month}.html`;
  const res = await fetch(url, {
    headers: { "User-Agent": HR_UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  // Months with no scheduled events return 404/410 from the HR CMS;
  // treat both as empty rather than aborting the run.
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`${cfg.venueSlug} fetch failed: ${url} → ${res.status}`);
  return res.text();
}

export interface HrCard {
  eventId: string;
  date: string;
  time: string | null;
  title: string;
  subtitles: string[];
  city: string;
  venueRoom: string | null;
  detailUrl: string;
  ticketUrl: string | null;
  imageUrl: string | null;
  performers: string | null;
}

const SECTION_RE = /<section\s+id="(\d{4}-\d{2}-\d{2})"\s+class="c-eventCalendar__item[^"]*">([\s\S]*?)<\/section>/g;

export function parseHrCalendarHtml(html: string, baseUrl: string): HrCard[] {
  const cards: HrCard[] = [];
  for (const match of html.matchAll(SECTION_RE)) {
    const card = parseHrSection(match[1], match[2], baseUrl);
    if (card) cards.push(card);
  }
  return cards;
}

function parseHrSection(date: string, body: string, baseUrl: string): HrCard | null {
  const linkMatch = body.match(/<a\s+href="([^"]+)"\s+class="link c-teaser__headlineLink"\s*>([\s\S]*?)<\/a>/);
  if (!linkMatch) return null;
  const detailUrl = decodeEntities(linkMatch[1]);
  const linkBody = linkMatch[2];

  const title = textOf(linkBody, /<span\s+class="c-eventTeaser__headline[^"]*">([\s\S]*?)<\/span>/);
  if (!title) return null;

  const subtitles = [...linkBody.matchAll(/<span\s+class="c-eventTeaser__subHeadline[^"]*">([\s\S]*?)<\/span>/g)]
    .map((m) => stripHtml(decodeEntities(m[1])).trim())
    .filter(Boolean);

  const time = parseTime(body);
  const venue = parseVenue(body);

  const eventId = deriveEventId(detailUrl);
  const ticketUrl = parseTicketUrl(body);
  const imageUrl = parseImageUrl(body, baseUrl);
  const performers = parsePerformers(body);

  return {
    eventId,
    date,
    time,
    title,
    subtitles,
    city: venue.city,
    venueRoom: venue.room,
    detailUrl,
    ticketUrl,
    imageUrl,
    performers,
  };
}

function parseTime(body: string): string | null {
  const m = body.match(/<span\s+class="c-eventTeaser__startTime">\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  return nullIfMidnight(`${m[1].padStart(2, "0")}:${m[2]}`);
}

interface ParsedVenue {
  city: string;
  room: string | null;
}

function parseVenue(body: string): ParsedVenue {
  const venueIdx = body.indexOf('<div class="c-eventTeaser__venue">');
  if (venueIdx === -1) return { city: "", room: null };
  const region = body.slice(venueIdx);
  const city = textOf(region, /<strong>([\s\S]*?)<\/strong>/) ?? "";
  const room = textOf(region, /<div class="c-eventInstant__address">([\s\S]*?)<\/div>/);
  return { city, room };
}

function parseTicketUrl(body: string): string | null {
  const noscript = match1(body, /<noscript>[\s\S]*?<a\s+href="(https?:\/\/[^"]+)"[\s\S]*?<\/noscript>/);
  if (noscript) return noscript;
  return match1(body, /class="link js-modalConfirm"[\s\S]*?href="(https?:\/\/[^"]+)"/);
}

function parseImageUrl(body: string, baseUrl: string): string | null {
  const srcset = match1(body, /<source media="all and \(min-width: 890px\)"[\s\S]*?srcset="([^"]+)"/);
  if (!srcset) return normalizeUrl(match1(body, /<img[^>]*\bsrc="([^"]+)"/), baseUrl);
  // srcset is ordered small → retina; the non-retina 960w 16:9 jpg
  // is the best "stable" pick (used elsewhere on the site for OG cards).
  const urls = srcset
    .split(",")
    .map((s) => s.trim().split(/\s+/)[0])
    .filter(Boolean);
  const stable = urls.find((c) => /_v-16to9\.jpg$/.test(c)) ?? urls.at(-1);
  return normalizeUrl(stable ?? null, baseUrl);
}

/**
 * The first `c-concert-info` block lists performers (names rendered with the
 * `-uppercase` class). The second, when present, enumerates works. We only
 * want the performer list, so we look for `-uppercase` to discriminate.
 */
function parsePerformers(body: string): string | null {
  const blocks = [...body.matchAll(/<div class="c-concert-info">([\s\S]*?)<\/div>/g)];
  for (const block of blocks) {
    const inner = block[1];
    if (!/u-font-normal\s+-uppercase\s+-bold/.test(inner)) continue;
    const items = [...inner.matchAll(/<li[^>]*class="c-concert-info__item[^"]*">([\s\S]*?)<\/li>/g)]
      .map((m) => stripHtml(decodeEntities(m[1])).replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (items.length) return items.join(" · ");
  }
  return null;
}

function deriveEventId(detailUrl: string): string {
  const m = detailUrl.match(/,([^,/]+?)(?:-\d+)?\.html$/);
  if (m) return m[1];
  return detailUrl.replace(/\W+/g, "-").slice(-64);
}

function isFrankfurtArea(card: HrCard): boolean {
  const city = card.city.toLowerCase();
  if (city.includes("frankfurt")) return true;
  const haystack = `${card.city} ${card.venueRoom ?? ""}`.toLowerCase();
  return FFM_ROOM_KEYWORDS.some((kw) => haystack.includes(kw));
}

interface HrDetail {
  description: string | null;
  priceMin: number | null;
  priceMax: number | null;
  ticketUrl: string | null;
  imageUrl: string | null;
}

async function fetchDetail(url: string): Promise<HrDetail> {
  const res = await fetch(url, {
    headers: { "User-Agent": HR_UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`hr detail ${url} → ${res.status}`);
  return parseHrDetail(await res.text());
}

export function parseHrDetail(html: string): HrDetail {
  const event = extractEventJsonLd(html);
  const description = event?.description ? truncate(stripHtml(decodeEntities(event.description)), 800) : null;
  const ticketUrl = event?.offers?.url ?? null;
  const imageUrl = pickJsonLdImage(event);
  const { priceMin, priceMax } = parsePriceFromHtml(html);
  return { description, priceMin, priceMax, ticketUrl, imageUrl };
}

interface JsonLdEvent {
  "@type"?: string;
  description?: string;
  offers?: { url?: string };
  image?: string | string[];
}

function extractEventJsonLd(html: string): JsonLdEvent | null {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]) as JsonLdEvent;
      if (parsed["@type"] === "Event") return parsed;
    } catch {
      // hr.de occasionally emits malformed JSON-LD; skip and continue.
    }
  }
  return null;
}

function pickJsonLdImage(event: JsonLdEvent | null): string | null {
  if (!event?.image) return null;
  if (Array.isArray(event.image)) {
    const wide = event.image.find((u) => u.includes("_v-16to9"));
    return wide ?? event.image[0] ?? null;
  }
  return event.image;
}

/**
 * Detail pages render prices like "Tickets: 66,– | 55,– | 44,– | 33,– | 22,– €".
 * Tiers are pipe-separated; we keep min/max across all tiers in the first match.
 */
function parsePriceFromHtml(html: string): { priceMin: number | null; priceMax: number | null } {
  const match = html.match(/Tickets:\s*([\s\S]{0,200}?)€/i);
  if (!match) return { priceMin: null, priceMax: null };
  const nums = [...match[1].matchAll(/(\d{1,3})(?:,(\d{2}))?/g)]
    .map((m) => parseFloat(`${m[1]}.${m[2] ?? "00"}`))
    .filter((n) => n >= 5 && n <= 500);
  if (!nums.length) return { priceMin: null, priceMax: null };
  return { priceMin: Math.min(...nums), priceMax: Math.max(...nums) };
}

function match1(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1] : null;
}

function textOf(body: string, re: RegExp): string | null {
  const m = body.match(re);
  if (!m) return null;
  const text = stripHtml(decodeEntities(m[1])).replace(/\s+/g, " ").trim();
  return text || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
