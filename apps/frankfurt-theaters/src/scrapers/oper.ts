import { decodeEntities, normalizeUrl, nullIfMidnight, stripHtml, todayIso } from "@museumsufer/core";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://oper-frankfurt.de";
const SPIELPLAN_URL = `${BASE}/de/spielplan/`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeOperFrankfurt(): Promise<ScrapeResult> {
  const html = await fetchHtml(SPIELPLAN_URL);
  const result = parseOperHtml(html);
  await enrichShowsFromDetailPages(result);
  return result;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

/**
 * Oper detail pages (`/de/spielplan/<slug>/?id_datum=<id>`) carry the
 * synopsis, the production photo, and a price field — sometimes a flat
 * "18 Euro", sometimes a category code ("S2", "P", "A") which maps to a
 * separate price grid we don't have yet. Parse what we can; leave coded
 * prices null until we wire the mapping.
 *
 * One fetch per unique show — descriptions and prices are constant per
 * production, not per performance.
 */
async function enrichShowsFromDetailPages(result: ScrapeResult): Promise<void> {
  for (const show of result.shows) {
    const sample = result.performances.find((p) => p.show_slug === show.slug);
    if (!sample?.provider_event_id) continue;
    try {
      const detail = await fetchHtml(`${BASE}/de/spielplan/${show.slug}/?id_datum=${sample.provider_event_id}`);
      const parsed = parseOperDetail(detail);
      if (parsed.priceEuro != null) {
        for (const perf of result.performances) {
          if (perf.show_slug === show.slug) {
            perf.price_min = parsed.priceEuro;
            perf.price_max = parsed.priceEuro;
          }
        }
      }
      if (parsed.image) show.image_url = parsed.image;
      if (parsed.description) show.description = parsed.description;
    } catch (err) {
      console.warn(`Oper detail enrichment failed for ${show.slug}:`, err);
    }
  }
}

interface OperDetail {
  priceEuro: number | null;
  description: string | null;
  image: string | null;
}

export function parseOperDetail(html: string): OperDetail {
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

/**
 * Oper Frankfurt's `/de/spielplan/` ships:
 *   - a `var dates_available = new Array("YYYY-MM-DD", ...)` JS list of every
 *     calendar day with at least one performance (covers the full season ahead)
 *   - 30 or so `<div class="repertoire-element">` cards for the current view,
 *     each carrying day-of-month only (`<span>09</span>`), title, composer,
 *     `<span class="meta">19.30 Uhr, Opernhaus</span>`, and an optional
 *     `<span class="label label-blank">Ausverkauft</span>`.
 *
 * We use `dates_available` as the spine: walk both lists in lockstep, advancing
 * the date pointer when an element's day-of-month differs from the previous one.
 */
export function parseOperHtml(html: string): ScrapeResult {
  const datesAvailable = extractDatesAvailable(html);
  const blocks = extractRepertoireBlocks(html);

  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

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

    const parsed = parseElement(block);
    if (!parsed) continue;
    const { show, perf } = parsed;
    perf.date = date;

    if (perf.date < today) continue;

    const dedup = `${show.slug}|${perf.date}|${perf.time ?? ""}|${perf.venue_room ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    if (!showsBySlug.has(show.slug)) showsBySlug.set(show.slug, show);
    performances.push({ ...perf, show_slug: show.slug });
  }

  return { theater_slug: "oper-frankfurt", shows: [...showsBySlug.values()], performances };
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

interface ParsedElement {
  show: ScrapedShow;
  perf: Omit<ScrapedPerformance, "show_slug"> & { date: string };
}

function parseElement(block: string): ParsedElement | null {
  const linkMatch = block.match(/<a\b[^>]*\bhref="([^"]+)"[^>]*class="[^"]*\bseason-hover-text\b/);
  const titleMatch = block.match(/<h3[^>]*>([^<]+)<\/h3>/);
  if (!linkMatch || !titleMatch) return null;

  const href = decodeEntities(linkMatch[1]);
  const slug = deriveSlug(href);
  const title = stripHtml(titleMatch[1]);
  const composer = textOf(block, /<h4[^>]*>([\s\S]*?)<\/h4>/);

  const meta = textOf(block, /<span\s+class="meta"[^>]*>([\s\S]*?)<\/span>/);
  const { time, venueRoom } = parseMeta(meta);

  const idDatum = match1(href, /[?&]id_datum=(\d+)/);
  const detailUrl = normalizeUrl(`/de/spielplan/${href.replace(/^\/+/, "")}`, BASE);
  const ticketUrl = idDatum ? detailUrl : null;

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
    show: {
      slug,
      title,
      subtitle: composer || null,
      description: composer || null,
      detail_url: normalizeUrl(`/de/spielplan/${href.replace(/^\/+/, "").split("?")[0]}`, BASE),
      image_url: null,
    },
    perf: {
      date: "",
      time,
      end_time: null,
      venue_room: venueRoom,
      provider_event_id: idDatum,
      ticket_url: ticketUrl,
      status,
    },
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
