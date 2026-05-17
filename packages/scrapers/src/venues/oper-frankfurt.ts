import { decodeEntities, normalizeUrl, nullIfMidnight, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://oper-frankfurt.de";
const SPIELPLAN_URL = `${BASE}/de/spielplan/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Oper Frankfurt main spielplan — operas, ballets, schauspiel, and
 * gastspiele. The konzerte/liederabende side lives in oper-frankfurt-konzerte
 * (music labels only); this scraper covers everything else and emits
 * stage:* / music:* labels via the keyword resolver.
 *
 * `/de/spielplan/` ships:
 *   - a `var dates_available = new Array("YYYY-MM-DD", ...)` JS list of every
 *     calendar day with at least one performance (full season ahead)
 *   - 30 or so `<div class="repertoire-element">` cards for the current view,
 *     each carrying day-of-month only (`<span>09</span>`), title, composer,
 *     `<span class="meta">19.30 Uhr, Opernhaus</span>`, and an optional
 *     `<span class="label label-blank">Ausverkauft</span>`.
 *
 * We use `dates_available` as the spine: walk both lists in lockstep,
 * advancing the date pointer when an element's day-of-month differs from
 * the previous one. Per-show enrichment fetches detail pages for the
 * synopsis, production photo, and price (when present as plain Euros).
 */

interface RawPerf {
  showSlug: string;
  title: string;
  composer: string | null;
  date: string;
  time: string | null;
  venueRoom: string | null;
  detailUrl: string | null;
  ticketUrl: string | null;
  providerEventId: string | null;
  status: string;
}

interface ShowEnrichment {
  description: string | null;
  image: string | null;
  priceEuro: number | null;
}

export async function scrapeOperFrankfurt(): Promise<VenueScrapeResult> {
  const html = await fetchHtml(SPIELPLAN_URL);
  const perfs = parseSpielplan(html);
  const enrichBySlug = await enrichShows(perfs);

  const events: CanonicalScrapedEvent[] = perfs.map((p) => {
    const e = enrichBySlug.get(p.showSlug) ?? { description: null, image: null, priceEuro: null };
    return {
      source_event_id: p.providerEventId ?? `${p.showSlug}|${p.date}|${p.time ?? ""}|${p.venueRoom ?? ""}`,
      title: p.title,
      subtitle: p.composer,
      description: e.description ?? p.composer,
      date: p.date,
      time: p.time,
      detail_url: p.detailUrl,
      ticket_url: p.ticketUrl,
      image_url: e.image,
      price_min: e.priceEuro,
      price_max: e.priceEuro,
      venue_room: p.venueRoom,
      raw_category: p.status === "available" ? null : p.status,
      labels: resolveStageLabels({ title: p.title, subtitle: p.composer, confidence: 0.9 }),
    };
  });

  return { source_slug: "oper-frankfurt", display_name: "Oper Frankfurt", events };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

async function enrichShows(perfs: RawPerf[]): Promise<Map<string, ShowEnrichment>> {
  const out = new Map<string, ShowEnrichment>();
  const seen = new Set<string>();
  for (const p of perfs) {
    if (seen.has(p.showSlug)) continue;
    seen.add(p.showSlug);
    if (!p.providerEventId) continue;
    try {
      const html = await fetchHtml(`${BASE}/de/spielplan/${p.showSlug}/?id_datum=${p.providerEventId}`);
      out.set(p.showSlug, parseDetail(html));
    } catch (err) {
      console.warn(`oper-frankfurt detail enrichment failed for ${p.showSlug}:`, err);
    }
  }
  return out;
}

function parseDetail(html: string): ShowEnrichment {
  const priceText = match1(html, /<dt>\s*Preise\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i);
  const priceMatch = priceText?.match(/(\d{1,3})\s*Euro/i);
  const priceEuro = priceMatch ? parseInt(priceMatch[1], 10) : null;

  let description: string | null = null;
  const articleStart = html.search(/<div\s+class="article-header"/i);
  if (articleStart !== -1) {
    const region = html.slice(articleStart);
    const firstLongP = [...region.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripHtml(m[1]))
      .find((t) => t.length >= 120 && !/cookie|datenschutz|google|analyse/i.test(t));
    if (firstLongP) description = firstLongP.length > 800 ? `${firstLongP.slice(0, 800).trimEnd()}…` : firstLongP;
  }

  const imageHref = match1(html, /<a\s+class="item slide"[^>]*data-src="([^"]+)"/);
  const image = imageHref ? normalizeUrl(imageHref, BASE) : null;

  return { priceEuro, description, image };
}

function parseSpielplan(html: string): RawPerf[] {
  const today = todayIso();
  const datesAvailable = extractDatesAvailable(html);
  const blocks = extractRepertoireBlocks(html);

  const out: RawPerf[] = [];
  const seen = new Set<string>();
  let dateCursor = 0;
  let prevDay: number | null = null;

  for (const block of blocks) {
    const day = parseDay(block);
    if (day === null) continue;
    if (prevDay !== null && day !== prevDay) {
      dateCursor = advanceCursor(datesAvailable, dateCursor, day);
    }
    prevDay = day;

    const date = datesAvailable[dateCursor];
    if (!date) continue;
    if (date < today) continue;

    const parsed = parseElement(block, date);
    if (!parsed) continue;

    const dedup = `${parsed.showSlug}|${parsed.date}|${parsed.time ?? ""}|${parsed.venueRoom ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    out.push(parsed);
  }
  return out;
}

function extractDatesAvailable(html: string): string[] {
  const m = html.match(/var\s+dates_available\s*=\s*new\s+Array\(([^)]*)\)/);
  if (!m) return [];
  return [...m[1].matchAll(/"(\d{4}-\d{2}-\d{2})"/g)].map((mm) => mm[1]);
}

const REPERTOIRE_OPEN = /<div class="repertoire-element[^"]*">/g;

function extractRepertoireBlocks(html: string): string[] {
  const blocks: string[] = [];
  for (const match of html.matchAll(REPERTOIRE_OPEN)) {
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

function parseDay(block: string): number | null {
  const m = block.match(/<div class="col col-date[^"]*">[^<]*<span>(\d{1,2})<\/span>/);
  return m ? parseInt(m[1], 10) : null;
}

function advanceCursor(dates: string[], from: number, targetDay: number): number {
  for (let i = from + 1; i < dates.length; i++) {
    if (parseInt(dates[i].slice(8, 10), 10) === targetDay) return i;
  }
  return from;
}

function parseElement(block: string, date: string): RawPerf | null {
  const linkMatch = block.match(/<a\b[^>]*\bhref="([^"]+)"[^>]*class="[^"]*\bseason-hover-text\b/);
  const titleMatch = block.match(/<h3[^>]*>([^<]+)<\/h3>/);
  if (!linkMatch || !titleMatch) return null;

  const href = decodeEntities(linkMatch[1]);
  const showSlug = deriveSlug(href);
  const title = stripHtml(titleMatch[1]);
  const composer = textOf(block, /<h4[^>]*>([\s\S]*?)<\/h4>/);

  const meta = textOf(block, /<span\s+class="meta"[^>]*>([\s\S]*?)<\/span>/);
  const { time, venueRoom } = parseMeta(meta);

  const idDatum = match1(href, /[?&]id_datum=(\d+)/);
  const detailUrl = normalizeUrl(`/de/spielplan/${href.replace(/^\/+/, "").split("?")[0]}`, BASE);
  const ticketUrl = idDatum ? normalizeUrl(`/de/spielplan/${href.replace(/^\/+/, "")}`, BASE) : null;

  const isSoldOut = /label-blank">\s*Ausverkauft/.test(block);
  const isFewLeft = /label-blank">\s*Restkarten/.test(block);
  const isCancelled = /\b(?:Abgesagt|Entfällt|Ausgefallen)\b/i.test(block);
  const status = isCancelled
    ? "cancelled"
    : isSoldOut
      ? "sold_out"
      : isFewLeft
        ? "few_left"
        : ticketUrl
          ? "available"
          : "unknown";

  return {
    showSlug,
    title,
    composer: composer || null,
    date,
    time,
    venueRoom,
    detailUrl,
    ticketUrl,
    providerEventId: idDatum,
    status,
  };
}

function parseMeta(meta: string | null): { time: string | null; venueRoom: string | null } {
  if (!meta) return { time: null, venueRoom: null };
  const timeMatch = meta.match(/(\d{1,2})[.:](\d{2})\s*Uhr/);
  const time = timeMatch ? nullIfMidnight(`${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`) : null;
  const afterTime = timeMatch ? meta.slice(meta.indexOf(timeMatch[0]) + timeMatch[0].length) : meta;
  const venueRoom = afterTime.replace(/^[\s,]+|[\s,]+$/g, "").trim() || null;
  return { time, venueRoom };
}

function deriveSlug(href: string): string {
  const m = href.match(/^([^/?#]+)/);
  return m ? m[1] : href;
}

function match1(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1] : null;
}

function textOf(block: string, re: RegExp): string | null {
  const m = block.match(re);
  return m ? stripHtml(m[1]) : null;
}
