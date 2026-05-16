import { classifyMusic } from "@museumsufer/classify";
import {
  BROWSER_UA,
  dateOffset,
  decodeEntities,
  normalizeUrl,
  slugify,
  stripHtml,
  todayIso,
  truncate,
} from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.brotfabrik.de";
const PROGRAM_URL = `${BASE}/programm/`;
const AJAX_URL = `${BASE}/wp-admin/admin-ajax.php`;

/**
 * Apache mod_security on brotfabrik.de 503s any UA that doesn't start
 * with "Mozilla". We send the standard browser string with a `From`
 * header that carries our contact email — the operator can identify
 * the crawler if needed.
 */
const FROM_HEADER = "jonas@bgdlabs.com (museumsufer event-hub crawler)";
const THROTTLE_MS = 200;
const MAX_MONTHS = 6;

/**
 * Kulturprojekt 21 e.V. (brotfabrik.de) runs the concerts. The mixed-genre
 * programme is rendered by the EventOn WordPress plugin: a single
 * server-rendered HTML view for the current month, with subsequent months
 * fetched via the same admin-ajax endpoint the calendar's "next" button
 * triggers. Each event tile carries a Schema.org Event block with clean
 * `<meta itemprop=...>` fields, so we read date/time/image/description
 * directly without further requests. Detail pages add the Reservix
 * ticket URL — fetched for every event to keep the metadata uniform.
 *
 * The venue mixes music with theater, comedy, lesung, and tanz; the hub
 * keeps all of them and routes via stage:* / talk:* labels rather than
 * dropping non-music events as the app-side scraper used to.
 */

const EVENT_BLOCK_RE =
  /<div\s+id="event_\d+"\s+class="eventon_list_event[\s\S]*?<div class='clear end'><\/div><\/div>/g;
const ITEMPROP_URL_RE = /<a\s+itemprop='url'\s+href='([^']+)'/;
const ITEMPROP_NAME_RE = /<span\s+itemprop='name'\s*>([\s\S]*?)<\/span>/;
const META_START_RE = /<meta\s+itemprop='startDate'\s+content='([^']+)'/;
const META_IMAGE_RE = /<meta\s+itemprop='image'\s+content='([^']+)'/;
const META_DESC_RE = /<meta\s+itemprop='description'\s+content='([^']+)'/;
const SUBTITLE_RE = /<span\s+class='evcal_event_subtitle'\s*>([\s\S]*?)<\/span>/;
const EVENT_TYPE_RE = /<em\s+data-filter='event_type'\s*>([\s\S]*?)<\/em>/g;
const RESERVIX_RE =
  /href=['"]\s*(https?:\/\/[^'"\s]*reservix[^'"\s]*\/(?:p\/reservix\/event\/|tickets-)[^'"\s]+)\s*['"]/i;
const PRICE_LINE_RE = /(\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR|Euro)/gi;
const SLUG_FROM_URL_RE = /\/events\/([^/?#]+)/;

interface MonthAjax {
  status: string;
  month: number;
  year: number;
  content: string;
}

export async function scrapeBrotfabrik(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(90);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const initialHtml = await fetchText(PROGRAM_URL);
  const { month, year } = readCalendarPosition(initialHtml);

  let html = extractListHtml(initialHtml);
  let cMonth = month;
  let cYear = year;
  let visited = 0;
  let pastHorizon = false;

  while (visited < MAX_MONTHS && !pastHorizon) {
    for (const block of html.matchAll(EVENT_BLOCK_RE)) {
      const parsed = parseEventBlock(block[0]);
      if (!parsed) continue;
      const { event, dedupKey } = parsed;
      if (event.date < today) continue;
      if (event.date > horizon) {
        pastHorizon = true;
        continue;
      }
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      events.push(event);
    }
    visited++;
    if (pastHorizon) break;

    await sleep(THROTTLE_MS);
    const next = await fetchNextMonth(cMonth, cYear);
    if (!next || next.status !== "GOOD" || !next.content) break;
    html = next.content;
    cMonth = next.month;
    cYear = next.year;
  }

  await enrichWithDetails(events);
  return { source_slug: "brotfabrik", events };
}

interface ParsedEvent {
  event: CanonicalScrapedEvent;
  dedupKey: string;
}

function parseEventBlock(block: string): ParsedEvent | null {
  const startRaw = META_START_RE.exec(block)?.[1];
  if (!startRaw) return null;
  const dt = parseIsoLike(startRaw);
  if (!dt) return null;

  const detailUrl = ITEMPROP_URL_RE.exec(block)?.[1];
  const nameRaw = ITEMPROP_NAME_RE.exec(block)?.[1] ?? "";
  const title = stripHtml(decodeEntities(nameRaw)).trim();
  if (!title) return null;

  const subtitleRaw = SUBTITLE_RE.exec(block)?.[1];
  const subtitle = subtitleRaw ? stripHtml(decodeEntities(subtitleRaw)).trim() || null : null;

  const eventTypes = [...block.matchAll(EVENT_TYPE_RE)]
    .map((m) => stripHtml(decodeEntities(m[1])).replace(/,$/, "").trim().toLowerCase())
    .filter(Boolean);

  const descRaw = META_DESC_RE.exec(block)?.[1];
  const description = descRaw ? truncate(decodeEntities(descRaw), 800) : null;
  const imageUrl = META_IMAGE_RE.exec(block)?.[1] ?? null;

  const slug = detailUrl ? slugFromUrl(detailUrl) : slugify(`${dt.date}-${title}`);
  const normalizedDetail = detailUrl ? normalizeUrl(detailUrl, BASE) : null;

  const labels = pickLabels(title, subtitle, eventTypes, description);

  const event: CanonicalScrapedEvent = {
    source_event_id: slug,
    title,
    subtitle,
    description,
    date: dt.date,
    time: dt.time,
    end_time: null,
    detail_url: normalizedDetail,
    ticket_url: null,
    image_url: imageUrl ? decodeEntities(imageUrl) : null,
    price_min: null,
    price_max: null,
    performers: subtitle,
    venue_room: null,
    raw_category: eventTypes.length ? eventTypes.join(",") : null,
    labels,
  };
  return { event, dedupKey: `${slug}|${dt.date}|${dt.time ?? ""}` };
}

/**
 * Brotfabrik mixes music, theater, comedy, kabarett, lesung, and tanz under
 * one programme. The EventOn `event_type` taxonomy is reliable when present;
 * fall back to title/subtitle regex matching when it isn't. Workshop and
 * tanzkurs entries are real classes the venue hosts, so we tag them with
 * the closest stage:* bucket rather than synthesise new labels.
 */
function pickLabels(
  title: string,
  subtitle: string | null,
  eventTypes: readonly string[],
  description: string | null,
): ScrapedLabel[] {
  const stage = matchStage(title, subtitle, eventTypes);
  if (stage) return [{ label: stage, confidence: 0.95, classifier: "upstream-tag" }];
  if (matchLesung(title, subtitle, eventTypes)) {
    return [{ label: "talk:lesung", confidence: 0.95, classifier: "upstream-tag" }];
  }
  const genre = classifyMusic(title, subtitle, description, "world");
  return [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }];
}

function matchStage(title: string, subtitle: string | null, eventTypes: readonly string[]): string | null {
  if (eventTypes.some((t) => t.includes("tanz"))) return "stage:dance";
  if (eventTypes.some((t) => /theater|comedy|kabarett|improtheater|workshop/.test(t))) return "stage:theater";
  const haystack = `${title} ${subtitle ?? ""}`;
  if (/\b(tanz(?:kurs|en|abend)?)\b/i.test(haystack)) return "stage:dance";
  if (/\b(theater|comedy|kabarett|improtheater|workshop)\b/i.test(haystack)) return "stage:theater";
  return null;
}

function matchLesung(title: string, subtitle: string | null, eventTypes: readonly string[]): boolean {
  if (eventTypes.some((t) => t.includes("lesung") || t.includes("vortrag"))) return true;
  const haystack = `${title} ${subtitle ?? ""}`;
  return /\b(lesung|vortrag)\b/i.test(haystack);
}

function parseIsoLike(raw: string): { date: string; time: string | null } | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{2})/.exec(raw);
  if (!m) return null;
  const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const time = `${m[4].padStart(2, "0")}:${m[5]}`;
  return { date, time: time === "00:00" ? null : time };
}

function slugFromUrl(url: string): string {
  const m = SLUG_FROM_URL_RE.exec(url);
  return m ? m[1] : slugify(url);
}

function readCalendarPosition(html: string): { month: number; year: number } {
  const month = parseInt(/data-cmonth="(\d+)"/.exec(html)?.[1] ?? "0", 10);
  const year = parseInt(/data-cyear="(\d+)"/.exec(html)?.[1] ?? "0", 10);
  return { month, year };
}

function extractListHtml(html: string): string {
  const start = html.indexOf("id='evcal_list'");
  if (start < 0) return html;
  const end = html.indexOf("<!-- #evcal_list-->", start);
  return end > start ? html.slice(start, end) : html.slice(start);
}

async function fetchNextMonth(currentMonth: number, currentYear: number): Promise<MonthAjax | null> {
  const body = new URLSearchParams();
  body.set("action", "the_ajax_hook");
  body.set("direction", "next");
  body.set("sort_by", "sort_date");
  body.set("ajaxtype", "switchmonth");

  const shortcode: Record<string, string> = {
    hide_past: "yes",
    show_et_ft_img: "yes",
    event_order: "ASC",
    ft_event_priority: "no",
    lang: "L1",
    month_incre: "0",
    only_ft: "no",
    hide_ft: "no",
    evc_open: "no",
    show_limit: "no",
    etc_override: "no",
    show_limit_redir: "0",
    tiles: "no",
    tile_height: "0",
    tile_bg: "0",
    tile_count: "2",
    tile_style: "0",
    members_only: "no",
    ux_val: "4",
    show_limit_ajax: "no",
    show_limit_paged: "1",
    hide_mult_occur: "no",
    show_repeats: "no",
    hide_end_time: "no",
  };
  for (const [k, v] of Object.entries(shortcode)) body.set(`shortcode[${k}]`, v);

  const evodata: Record<string, string> = {
    cyear: String(currentYear),
    cmonth: String(currentMonth),
    runajax: "1",
    cal_ver: "2.6.16",
    sort_by: "sort_date",
    ux_val: "4",
  };
  for (const [k, v] of Object.entries(evodata)) body.set(`evodata[${k}]`, v);

  const res = await fetch(AJAX_URL, {
    method: "POST",
    headers: {
      "User-Agent": BROWSER_UA,
      From: FROM_HEADER,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "Accept-Language": "de-DE,de;q=0.9",
    },
    body: body.toString(),
  });
  if (!res.ok) return null;
  return (await res.json()) as MonthAjax;
}

async function enrichWithDetails(events: CanonicalScrapedEvent[]): Promise<void> {
  for (const ev of events) {
    if (!ev.detail_url) continue;
    await sleep(THROTTLE_MS);
    const detail = await fetchDetail(ev.detail_url);
    if (detail.ticketUrl) ev.ticket_url = detail.ticketUrl;
    if (detail.priceMin != null) ev.price_min = detail.priceMin;
    if (detail.priceMax != null) ev.price_max = detail.priceMax;
  }
}

interface DetailFields {
  ticketUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
}

async function fetchDetail(url: string): Promise<DetailFields> {
  let html: string;
  try {
    html = await fetchText(url);
  } catch {
    return { ticketUrl: null, priceMin: null, priceMax: null };
  }

  const focused = sliceFocusedCard(html);
  const ticketUrl = RESERVIX_RE.exec(focused)?.[1] ?? null;
  const prices = collectPrices(focused);
  return {
    ticketUrl: ticketUrl ? decodeEntities(ticketUrl) : null,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length > 1 ? Math.max(...prices) : null,
  };
}

function sliceFocusedCard(html: string): string {
  const start = html.indexOf("evcal_eventcard open");
  if (start < 0) return html;
  const after = html.slice(start);
  const nextCard = after.indexOf("evcal_eventcard '", 1);
  return nextCard > 0 ? after.slice(0, nextCard) : after;
}

const PRICE_BLOCK_RE = /<h3\s+class='evo_h3'>Preise<\/h3>[\s\S]{0,400}/i;

function collectPrices(html: string): number[] {
  const block = PRICE_BLOCK_RE.exec(html)?.[0];
  if (!block) return [];
  const prices: number[] = [];
  for (const m of decodeEntities(block).matchAll(PRICE_LINE_RE)) {
    const value = parseFloat(m[1].replace(",", "."));
    if (Number.isFinite(value) && value > 0 && value < 1000) prices.push(value);
  }
  return prices;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      From: FROM_HEADER,
      "Accept-Language": "de-DE,de;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`brotfabrik fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
