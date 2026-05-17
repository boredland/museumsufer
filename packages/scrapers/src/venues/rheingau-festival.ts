import { classifyMusic } from "@museumsufer/classify";
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
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.rheingau-musik-festival.de";
const PROGRAM_URL = `${BASE}/programm-karten/programmuebersicht`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;
const MAX_PAGES = 20;

interface MonthYear {
  month: number;
  year: number;
}

interface MonthMarker extends MonthYear {
  offset: number;
}

interface Tile {
  html: string;
  monthYear: MonthYear | null;
}

interface ParsedEvent {
  slug: string;
  title: string;
  category: string | null;
  performers: string | null;
  date: string;
  time: string | null;
  venueRoom: string | null;
  detailUrl: string;
  imageUrl: string | null;
  ticketUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  program: string | null;
}

export async function scrapeRheingauFestival(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(300);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      page === 1
        ? PROGRAM_URL
        : `${PROGRAM_URL}?tx_rmfevent_rmfeventoverview%5B%40widget_0%5D%5BcurrentPage%5D=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "de-DE,de;q=0.9" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`rheingau-festival fetch failed: ${url} → ${res.status}`);
    const html = await res.text();

    const tiles = extractTiles(html);
    if (tiles.length === 0) break;

    let newOnPage = 0;
    for (const tile of tiles) {
      const parsed = parseTile(tile);
      if (!parsed) continue;
      if (parsed.date < today) continue;
      if (parsed.date > horizon) continue;

      const dedup = `${parsed.slug}|${parsed.date}|${parsed.time ?? ""}|${parsed.venueRoom ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      newOnPage++;

      const description = parsed.program ? truncate(parsed.program, 800) : null;
      const genre = classifyMusic(parsed.title, parsed.category, description, "classical");

      events.push({
        source_event_id: parsed.slug,
        title: parsed.title,
        subtitle: parsed.category,
        description,
        date: parsed.date,
        time: parsed.time,
        end_time: null,
        detail_url: parsed.detailUrl,
        ticket_url: parsed.ticketUrl,
        image_url: parsed.imageUrl,
        price_min: parsed.priceMin,
        price_max: parsed.priceMax,
        performers: parsed.performers,
        venue_room: parsed.venueRoom,
        raw_category: parsed.category,
        labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
      });
    }

    if (newOnPage === 0) break;
    if (page < MAX_PAGES) await sleep(THROTTLE_MS);
  }

  return { source_slug: "rheingau-musikfestival", display_name: "Rheingau Musik Festival", events };
}

const TILE_OPENER = /<div class="ahz-event-overview-tile-first-row[^"]*">/g;
const MONTH_HEADER = /<h2 class="mb-0">\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})\s*<\/h2>/g;

function extractTiles(html: string): Tile[] {
  const markers = collectMonthMarkers(html);
  const tiles: Tile[] = [];

  for (const match of html.matchAll(TILE_OPENER)) {
    const start = match.index;
    if (start === undefined) continue;
    const end = findMatchingDivEnd(html, start + match[0].length);
    if (end < 0) continue;
    tiles.push({ html: html.slice(start, end), monthYear: resolveMonth(markers, start) });
  }
  return tiles;
}

function collectMonthMarkers(html: string): MonthMarker[] {
  const markers: MonthMarker[] = [];
  for (const m of html.matchAll(MONTH_HEADER)) {
    if (m.index === undefined) continue;
    const month = GERMAN_MONTHS[m[1].toLowerCase()];
    const year = parseInt(m[2], 10);
    if (!month || !Number.isFinite(year)) continue;
    markers.push({ offset: m.index, month, year });
  }
  return markers;
}

function resolveMonth(markers: MonthMarker[], tileOffset: number): MonthYear | null {
  let current: MonthMarker | null = null;
  for (const marker of markers) {
    if (marker.offset > tileOffset) break;
    current = marker;
  }
  return current ? { month: current.month, year: current.year } : null;
}

function findMatchingDivEnd(html: string, start: number): number {
  const tag = /<\/?div\b[^>]*>/g;
  tag.lastIndex = start;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html)) !== null) {
    if (m[0].startsWith("</")) {
      depth--;
      if (depth === 0) return m.index + m[0].length;
    } else {
      depth++;
    }
  }
  return -1;
}

function parseTile({ html: tile, monthYear }: Tile): ParsedEvent | null {
  const detailMatch = tile.match(/href="(\/programm-karten\/programmuebersicht\/detail\/[^"]+)"/);
  if (!detailMatch) return null;
  const detailPath = decodeEntities(detailMatch[1]);
  const slug = detailPath.split("/").filter(Boolean).pop();
  if (!slug) return null;

  const titleHtml = matchInner(tile, /<h3[^>]*>([\s\S]*?)<\/h3>/);
  const title = titleHtml ? stripHtml(titleHtml) : "";
  if (!title) return null;

  const dateText = matchInner(tile, /<p class="fw-bold">([^<]*\|[^<]*Uhr[^<]*)<\/p>/);
  const parsedDate = parseDateLine(dateText, monthYear);
  if (!parsedDate) return null;

  const category = stripHtmlOrNull(matchInner(tile, /class="[^"]*text-eventdate small[^"]*"[^>]*>([\s\S]*?)<\/p>/));
  const performers = extractPerformers(tile);
  const venueRoom = extractVenueRoom(tile);
  const imageUrl = extractImage(tile);
  const ticketUrl = extractTicketUrl(tile);
  const { priceMin, priceMax } = extractPrices(tile);
  const program = extractProgram(tile);

  return {
    slug,
    title,
    category,
    performers,
    date: parsedDate.date,
    time: parsedDate.time,
    venueRoom,
    detailUrl: `${BASE}${detailPath}`,
    imageUrl,
    ticketUrl,
    priceMin,
    priceMax,
    program,
  };
}

function matchInner(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern);
  return m ? m[1] : null;
}

function stripHtmlOrNull(html: string | null): string | null {
  if (!html) return null;
  return stripHtml(html) || null;
}

interface ParsedDate {
  date: string;
  time: string | null;
}

function parseDateLine(text: string | null, monthYear: MonthYear | null): ParsedDate | null {
  if (!text || !monthYear) return null;
  const clean = stripHtml(text);
  const dateMatch = clean.match(/(\d{1,2})\.(\d{1,2})\.?/);
  if (!dateMatch) return null;
  const day = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  if (month !== monthYear.month) return null;
  const isoDate = `${monthYear.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const timeMatch = clean.match(/(\d{1,2}):(\d{2})\s*Uhr/);
  const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

  return { date: isoDate, time };
}

function extractPerformers(tile: string): string | null {
  const tail = tile.slice(tile.search(/<\/h3>/));
  const performerMatch = tail.match(/<\/h3>\s*[\s\S]*?<p>([\s\S]*?)<\/p>/);
  if (!performerMatch) return null;
  const withSeparators = performerMatch[1].replace(/<br\s*\/?>/gi, ", ");
  return cleanCommaList(stripHtml(withSeparators));
}

function extractVenueRoom(tile: string): string | null {
  const infoMatch = tile.match(/<div class="col-12 col-md-6 event-info"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
  const region = infoMatch ? infoMatch[1] : tile;
  const paragraphs = [...region.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => stripHtml(m[1]));
  const venueText = paragraphs[paragraphs.length - 1];
  if (!venueText || /\bUhr\b/.test(venueText)) return null;
  return cleanCommaList(venueText);
}

function cleanCommaList(text: string): string | null {
  const cleaned = text
    .replace(/\s*,\s*,/g, ",")
    .replace(/,\s*$/, "")
    .trim();
  return cleaned || null;
}

function extractImage(tile: string): string | null {
  const m = tile.match(/<img[^>]*class="[^"]*ahz-event-overview-tile-image[^"]*"[^>]*src="([^"]+)"/);
  if (!m) return null;
  return sanitizeImageUrl(normalizeUrl(decodeEntities(m[1]), BASE));
}

function extractTicketUrl(tile: string): string | null {
  const m = tile.match(/<a\s+href="(https:\/\/trm\.jetticket\.net\/[^"]+webticket\/shop\?event=\d+)"/);
  return m ? decodeEntities(m[1]) : null;
}

function extractPrices(tile: string): { priceMin: number | null; priceMax: number | null } {
  const numbers = [...tile.matchAll(/(\d+(?:[.,]\d+)?)\s*€/g)]
    .map((m) => parseFloat(m[1].replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (numbers.length === 0) return { priceMin: null, priceMax: null };
  const priceMin = Math.min(...numbers);
  const priceMax = Math.max(...numbers);
  return { priceMin, priceMax: priceMax > priceMin ? priceMax : null };
}

function extractProgram(tile: string): string | null {
  const m = tile.match(
    /class="[^"]*ahz-event-overview-expanded-programm[^"]*"[^>]*>\s*<p class="fw-bold">[^<]*<\/p>\s*<p>([\s\S]*?)<\/p>/,
  );
  return m ? stripHtml(m[1]) || null : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
