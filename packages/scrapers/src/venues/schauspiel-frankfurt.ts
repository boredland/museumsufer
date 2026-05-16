import { normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.schauspielfrankfurt.de";
const SPIELPLAN_URL = `${BASE}/spielplan/`;
const KARTEN_URL = `${BASE}/karten-abos/karten/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Schauspielhaus / Kammerspiele / Box — Schauspiel Frankfurt's three rooms.
 * The /karten-abos/karten/ page exposes the per-room price grid we apply
 * to each performance's venue_room. The spielplan microdata-based parser
 * captures status (cancelled, sold_out) via DOM class flags; it rides in
 * raw_category.
 *
 * Detail pages are fetched once per unique show to upgrade missing
 * production photos (the listing leaves them lazy-loaded with kxcdn
 * placeholders).
 */

interface PriceRange {
  min: number;
  max: number;
}

interface RawPerf {
  showSlug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  detailUrl: string | null;
  date: string;
  time: string | null;
  endTime: string | null;
  venueRoom: string | null;
  providerEventId: string | null;
  ticketUrl: string | null;
  status: string;
}

export async function scrapeSchauspielFrankfurt(): Promise<VenueScrapeResult> {
  const [spielplanHtml, kartenHtml] = await Promise.all([
    fetchHtml(SPIELPLAN_URL),
    fetchHtml(KARTEN_URL).catch(() => null),
  ]);
  const venuePrices = kartenHtml ? parseSchauspielPrices(kartenHtml) : new Map<string, PriceRange>();
  const perfs = parsePerformances(spielplanHtml);
  const imageBySlug = await enrichImages(perfs);

  const events: CanonicalScrapedEvent[] = perfs.map((p) => {
    const range = p.venueRoom ? venuePrices.get(p.venueRoom) : undefined;
    return {
      source_event_id: p.providerEventId ?? `${p.showSlug}|${p.date}|${p.time ?? ""}|${p.venueRoom ?? ""}`,
      title: p.title,
      subtitle: p.subtitle,
      description: p.description,
      date: p.date,
      time: p.time,
      end_time: p.endTime,
      detail_url: p.detailUrl,
      ticket_url: p.ticketUrl,
      image_url: imageBySlug.get(p.showSlug) ?? null,
      price_min: range?.min ?? null,
      price_max: range?.max ?? null,
      venue_room: p.venueRoom,
      raw_category: p.status === "available" ? null : p.status,
      labels: resolveStageLabels({ title: p.title, subtitle: p.subtitle, confidence: 0.9 }),
    };
  });

  return { source_slug: "schauspiel-frankfurt", events };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

async function enrichImages(perfs: RawPerf[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const seen = new Set<string>();
  for (const p of perfs) {
    if (seen.has(p.showSlug) || !p.detailUrl) continue;
    seen.add(p.showSlug);
    try {
      const html = await fetchHtml(p.detailUrl);
      const img = pickShowImage(html);
      if (img) out.set(p.showSlug, img);
    } catch (err) {
      console.warn(`schauspiel-frankfurt detail enrichment failed for ${p.showSlug}:`, err);
    }
  }
  return out;
}

function pickShowImage(html: string): string | null {
  const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
  if (og && !/blank-image/i.test(og)) return og;
  const lazy = html.match(/<img[^>]*\bdata-image-url="(https?:\/\/sf-6a25\.kxcdn\.com\/images\/[^"]+)"/i)?.[1];
  if (lazy) return lazy;
  for (const m of html.matchAll(/<img[^>]+src="(https?:\/\/sf-6a25\.kxcdn\.com\/images\/[^"]+)"/gi)) {
    const url = m[1];
    if (/\b(?:logo|icon|favicon)\b/i.test(url)) continue;
    return url;
  }
  return null;
}

function parseSchauspielPrices(html: string): Map<string, PriceRange> {
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
      const flat = stripHtml(content).match(/(\d{1,3})\s*€\s*\/\s*ermäßigt\s*(\d{1,3})\s*€/);
      if (flat) out.set("Box", { min: parseInt(flat[2], 10), max: parseInt(flat[1], 10) });
    }
  }
  return out;
}

const PERFORMANCE_OPEN = /<div\s+class="performance[^"]*"[^>]*itemtype="http:\/\/schema\.org\/Event"[^>]*>/g;

function parsePerformances(html: string): RawPerf[] {
  const blocks = extractBlocks(html);
  const today = todayIso();
  const out: RawPerf[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const parsed = parseBlock(block);
    if (!parsed) continue;
    if (parsed.date < today) continue;
    const dedup = `${parsed.showSlug}|${parsed.date}|${parsed.time ?? ""}|${parsed.venueRoom ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    out.push(parsed);
  }
  return out;
}

function extractBlocks(html: string): string[] {
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

function parseBlock(block: string): RawPerf | null {
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

  const description = productionInfo ? `${subtitle ? `${subtitle}\n` : ""}${productionInfo}`.trim() : subtitle || null;

  return {
    showSlug: slug,
    title,
    subtitle: subtitle || null,
    description,
    detailUrl,
    date,
    time,
    endTime,
    venueRoom: venueRoom || null,
    providerEventId: eventimEventId,
    ticketUrl: ticketHref || null,
    status,
  };
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
