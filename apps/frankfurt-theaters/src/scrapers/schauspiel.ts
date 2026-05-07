import { normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://www.schauspielfrankfurt.de";
const SPIELPLAN_URL = `${BASE}/spielplan/`;
const KARTEN_URL = `${BASE}/karten-abos/karten/`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeSchauspielFrankfurt(): Promise<ScrapeResult> {
  const [spielplanHtml, kartenHtml] = await Promise.all([
    fetchHtml(SPIELPLAN_URL),
    fetchHtml(KARTEN_URL).catch(() => null),
  ]);
  const venuePrices = kartenHtml ? parseSchauspielPrices(kartenHtml) : new Map();
  const result = parseSchauspielHtml(spielplanHtml, venuePrices);
  await enrichWithDetailPages(result);
  return result;
}

/**
 * Detail pages either expose an `og:image` or just embed the production
 * photo as the first lazy-loaded `<img class="image__image">` whose src is
 * the kxcdn `blank_*.png` placeholder, with the real URL on `data-image-url`.
 */
async function enrichWithDetailPages(result: ScrapeResult): Promise<void> {
  for (const show of result.shows) {
    if (!show.detail_url || show.image_url) continue;
    try {
      const html = await fetchHtml(show.detail_url);
      show.image_url = pickShowImage(html);
    } catch (err) {
      console.warn(`Schauspiel detail enrichment failed for ${show.slug}:`, err);
    }
  }
}

function pickShowImage(html: string): string | null {
  const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
  if (og && !/blank-image/i.test(og)) return og;
  // First lazy-loaded production image (data-image-url) that isn't the placeholder
  const lazy = html.match(/<img[^>]*\bdata-image-url="(https?:\/\/sf-6a25\.kxcdn\.com\/images\/[^"]+)"/i)?.[1];
  if (lazy) return lazy;
  // First eager image with kxcdn /images/ path (not blank, not logos)
  for (const m of html.matchAll(/<img[^>]+src="(https?:\/\/sf-6a25\.kxcdn\.com\/images\/[^"]+)"/gi)) {
    const url = m[1];
    if (/\b(?:logo|icon|favicon)\b/i.test(url)) continue;
    return url;
  }
  return null;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

interface PriceRange {
  min: number;
  max: number;
}

/**
 * Parses /karten-abos/karten/ to a `venue_room → {min, max}€` map.
 *
 * The page lists per-venue tables of Preisgruppe × Kategorie cells. We don't
 * know which Preisgruppe applies to a given performance — Schauspiel doesn't
 * publish that on the spielplan — so we report the overall venue range and
 * let the UI advertise it as "from X € to Y €".
 *
 * Box has no table; it's a flat 9-15 € line ("Box 15 € / ermäßigt 9 €").
 */
export function parseSchauspielPrices(html: string): Map<string, PriceRange> {
  const out = new Map<string, PriceRange>();
  const parts = html.split(/<h[34][^>]*>([^<]+)<\/h[34]>/);
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].trim();
    const content = parts[i + 1] ?? "";
    if (heading === "Schauspielhaus" || heading === "Kammerspiele") {
      const table = content.match(/<table\b[\s\S]*?<\/table>/);
      if (!table) continue;
      const prices = [...table[0].matchAll(/(\d{1,3})\s*€/g)].map((m) => parseInt(m[1], 10));
      if (prices.length) out.set(heading, { min: Math.min(...prices), max: Math.max(...prices) });
    }
    if (heading === "Box") {
      // "Box 15 € / ermäßigt 9 €" — text only, no table.
      const flat = stripHtml(content).match(/(\d{1,3})\s*€\s*\/\s*ermäßigt\s*(\d{1,3})\s*€/);
      if (flat) out.set("Box", { min: parseInt(flat[2], 10), max: parseInt(flat[1], 10) });
    }
  }
  return out;
}

export function parseSchauspielHtml(html: string, venuePrices: Map<string, PriceRange> = new Map()): ScrapeResult {
  const blocks = extractPerformanceBlocks(html);

  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const block of blocks) {
    const parsed = parsePerformance(block);
    if (!parsed) continue;
    const { show, perf } = parsed;

    if (perf.date < today) continue;

    const dedup = `${show.slug}|${perf.date}|${perf.time ?? ""}|${perf.venue_room ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    const range = perf.venue_room ? venuePrices.get(perf.venue_room) : undefined;
    if (range) {
      perf.price_min = range.min;
      perf.price_max = range.max;
    }

    if (!showsBySlug.has(show.slug)) showsBySlug.set(show.slug, show);
    performances.push({ ...perf, show_slug: show.slug });
  }

  return {
    theater_slug: "schauspiel-frankfurt",
    shows: [...showsBySlug.values()],
    performances,
  };
}

const PERFORMANCE_OPEN = /<div\s+class="performance[^"]*"[^>]*itemtype="http:\/\/schema\.org\/Event"[^>]*>/g;

function extractPerformanceBlocks(html: string): string[] {
  const blocks: string[] = [];
  for (const match of html.matchAll(PERFORMANCE_OPEN)) {
    const start = match.index;
    if (start === undefined) continue;
    const endIdx = findBlockEnd(html, start + match[0].length);
    if (endIdx > 0) blocks.push(html.slice(start, endIdx));
  }
  return blocks;
}

function findBlockEnd(html: string, from: number): number {
  let depth = 1;
  let i = from;
  while (i < html.length) {
    const open = html.indexOf("<div", i);
    const close = html.indexOf("</div>", i);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      depth++;
      i = open + 4;
    } else {
      depth--;
      i = close + 6;
      if (depth === 0) return i;
    }
  }
  return -1;
}

interface ParsedPerformance {
  show: ScrapedShow;
  perf: Omit<ScrapedPerformance, "show_slug">;
}

function parsePerformance(block: string): ParsedPerformance | null {
  const startDate = match1(block, /<meta\s+itemprop="startDate"\s+content="([^"]+)"/);
  if (!startDate) return null;

  const date = startDate.slice(0, 10);
  const time = nullIfMidnight(startDate.slice(11, 16));

  const dateLine = textOf(block, /<div\s+class="performance__dateandtime"[^>]*>([\s\S]*?)<\/div>/);
  const endTime = parseEndTime(dateLine);

  const venueRoom = textOf(block, /<div\s+class="performance__location"[^>]*>([\s\S]*?)<\/div>/);

  const titleLink = match1(block, /<h3[^>]*class="headline__headline"[^>]*>\s*<a\s+href="([^"]+)"/);
  const titleText = textOf(
    block,
    /<h3[^>]*class="headline__headline"[^>]*>[\s\S]*?<span\s+itemprop="name"[^>]*>([\s\S]*?)<\/span>/,
  );
  if (!titleLink || !titleText) return null;

  const title = titleText.replace(/­/g, "");
  const detailUrl = normalizeUrl(titleLink, BASE);
  const slug = deriveSlug(titleLink, title);

  const subtitle = textOf(block, /<div\s+class="performance__author"[^>]*>([\s\S]*?)<\/div>/);
  const productionInfo = textOf(block, /<div\s+class="performance__productioninfo"[^>]*>([\s\S]*?)<\/div>/);

  const ticketHref = extractTicketHref(block);
  const eventimEventId = ticketHref ? match1(ticketHref, /[?&](?:amp;)?event=(\d+)/) : null;
  const isCancelled = /performance--is-canceled/.test(block);
  const isSoldOut = /performance--is-soldout/.test(block);
  const status = isCancelled ? "cancelled" : isSoldOut ? "sold_out" : ticketHref ? "available" : "unknown";

  const show: ScrapedShow = {
    slug,
    title,
    subtitle: subtitle || null,
    description: productionInfo ? `${subtitle ? `${subtitle}\n` : ""}${productionInfo}`.trim() : subtitle || null,
    detail_url: detailUrl,
    image_url: null,
  };

  const perf: Omit<ScrapedPerformance, "show_slug"> = {
    date,
    time,
    end_time: endTime,
    venue_room: venueRoom || null,
    provider_event_id: eventimEventId,
    ticket_url: ticketHref || null,
    status,
  };

  return { show, perf };
}

function parseEndTime(line: string | null): string | null {
  if (!line) return null;
  const m = line.match(/(\d{1,2})[.:](\d{2})\s*[–-]\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  const h = m[3].padStart(2, "0");
  return nullIfMidnight(`${h}:${m[4]}`);
}

function deriveSlug(href: string, title: string): string {
  const m = href.match(/\/spielplan\/kalender\/([^/]+)\/?/);
  return m ? m[1] : slugify(title);
}

function extractTicketHref(block: string): string | null {
  for (const m of block.matchAll(/<a\b([^>]*)>/g)) {
    const attrs = m[1];
    if (!/class="[^"]*\bperformance__ticketlink\b/.test(attrs)) continue;
    const href = attrs.match(/href="([^"]+)"/);
    if (href) return decodeHtmlEntities(href[1]);
  }
  return null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function match1(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1] : null;
}

function textOf(block: string, re: RegExp): string | null {
  const m = block.match(re);
  return m ? stripHtml(m[1]) : null;
}
