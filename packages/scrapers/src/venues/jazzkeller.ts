import { classifyMusic } from "@museumsufer/classify";
import {
  decodeEntities,
  normalizeUrl,
  sanitizeImageUrl,
  slugify,
  stripHtml,
  todayIso,
  truncate,
} from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://jazzkeller.com";
const LISTING_URL = `${BASE}/live.html`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

/**
 * Year on the live page is announced as `<title>YYYY Program</title>`.
 * Without it dates would be ambiguous — the program lists DD only and
 * carries no inline year reference.
 */
const TITLE_YEAR_RE = /<title>\s*(\d{4})\s+Program/i;

/**
 * Each month section is announced by a `*_month_*.svg` banner. The lower
 * "Session Opener" and "COMING UP" blocks reuse the same `*_month_*` SVG
 * naming convention, so we anchor on the explicit headliner-section month
 * banners and ignore the preview blocks (their info is a subset of the
 * headliner rows).
 */
const MONTH_SEP_RE = /data-src="img\/([a-z]+)_month_[^"]+\.svg"/g;
const MONTH_NAMES: Record<string, number> = {
  januar: 1,
  january: 1,
  februar: 2,
  february: 2,
  maerz: 3,
  march: 3,
  april: 4,
  mai: 5,
  may: 5,
  juni: 6,
  june: 6,
  juli: 7,
  july: 7,
  august: 8,
  september: 9,
  oktober: 10,
  october: 10,
  november: 11,
  dezember: 12,
  december: 12,
};

const ROW_MARKER = 'class="row voffset-lg mt-0 mt-lg-0 mt-md-0 calendar-row-spacer"';
const DAY_RE = /<h1[^>]*class="[^"]*datum-nummern-style[^"]*"[^>]*>\s*(\d{1,2})\s*<\/h1>/;
const WEEKTIME_RE = /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s+(\d{1,2}):(\d{2})/;
const TITLE_RE = /<div\s+class="col-sm-8\s+col\s+calendar-col-spacer">\s*<h3[^>]*>([\s\S]*?)<\/h3>/;
const SUBTITLE_RE = /<h4[^>]*>([\s\S]*?)<\/h4>/;
const PERFORMERS_RE = /<p[^>]*class="mb-lg-3[^"]*"[^>]*>([\s\S]*?)<\/p>/;
const TICKET_RE = /<a\s+href="(https?:\/\/[^"]*(?:eventim-light|buytickets\.at)[^"]+)"/;
const IMAGE_RE = /<img[^>]+data-src="(img\/[^"]+\.(?:jpg|jpeg|png|webp))"[^>]*alt="ARTIST PICTURE"/i;
const DESC_RE = /data-orig-content="([^"]+)"/;

interface MonthMarker {
  index: number;
  month: number;
}

/**
 * Jazzkeller publishes its monthly programme as a static HTML page
 * (live.html, Brizy CMS). The headliner block — one card per show with
 * date, weekday, time, performers, image and ticket link — is structured
 * enough to parse cleanly; the lower preview blocks are subsets and would
 * just create duplicates if scraped too.
 *
 * The page only shows the current + next month, so we don't have to page.
 * Ticket links point at either eventim-light.com or buytickets.at; both
 * are kept verbatim as ticket_url.
 */
export async function scrapeJazzkeller(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const html = await fetchHtml();
  const yearMatch = TITLE_YEAR_RE.exec(html);
  if (!yearMatch) throw new Error("jazzkeller: year not found in <title>");
  const year = parseInt(yearMatch[1], 10);

  const monthMarkers: MonthMarker[] = [];
  for (const m of html.matchAll(MONTH_SEP_RE)) {
    const month = MONTH_NAMES[m[1].toLowerCase()];
    if (month) monthMarkers.push({ index: m.index ?? 0, month });
  }
  if (monthMarkers.length === 0) {
    return { source_slug: "jazzkeller", display_name: "Jazzkeller Frankfurt", events: [] };
  }

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  let cursor = monthMarkers[0].index;

  while (cursor !== -1) {
    const rowStart = html.indexOf(ROW_MARKER, cursor);
    if (rowStart === -1) break;
    const month = monthFor(rowStart, monthMarkers);
    const rowEnd = html.indexOf(ROW_MARKER, rowStart + 1);
    const slice = html.slice(rowStart, rowEnd === -1 ? rowStart + 8000 : rowEnd);

    const event = parseRow(slice, year, month);
    if (event && event.date >= today && !seen.has(event.source_event_id)) {
      seen.add(event.source_event_id);
      events.push(event);
    }

    cursor = rowEnd;
  }

  return { source_slug: "jazzkeller", display_name: "Jazzkeller Frankfurt", events };
}

function monthFor(index: number, markers: MonthMarker[]): number {
  let current = markers[0].month;
  for (const m of markers) {
    if (m.index <= index) current = m.month;
    else break;
  }
  return current;
}

async function fetchHtml(): Promise<string> {
  const res = await fetch(LISTING_URL, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) throw new Error(`jazzkeller fetch failed: ${LISTING_URL} → ${res.status}`);
  return res.text();
}

function parseRow(slice: string, year: number, month: number): CanonicalScrapedEvent | null {
  const dayMatch = DAY_RE.exec(slice);
  if (!dayMatch) return null;
  const day = parseInt(dayMatch[1], 10);
  if (!day) return null;
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const titleMatch = TITLE_RE.exec(slice);
  const title = titleMatch ? stripHtml(decodeEntities(titleMatch[1])).replace(/\s+/g, " ").trim() : "";
  if (!title) return null;

  const weekTime = WEEKTIME_RE.exec(slice);
  const time = weekTime ? `${weekTime[2].padStart(2, "0")}:${weekTime[3]}` : null;

  const subtitleMatch = SUBTITLE_RE.exec(slice);
  const subtitle = subtitleMatch
    ? stripHtml(decodeEntities(subtitleMatch[1])).replace(/\s+/g, " ").trim() || null
    : null;

  const performersMatch = PERFORMERS_RE.exec(slice);
  const performers = performersMatch
    ? stripHtml(decodeEntities(performersMatch[1])).replace(/\s+/g, " ").trim() || null
    : null;

  const ticketMatch = TICKET_RE.exec(slice);
  const ticketUrl = ticketMatch ? decodeEntities(ticketMatch[1]) : null;

  const imgMatch = IMAGE_RE.exec(slice);
  const imageUrl = imgMatch ? sanitizeImageUrl(normalizeUrl(imgMatch[1], BASE)) : null;

  const descMatch = DESC_RE.exec(slice);
  const description = descMatch ? truncate(stripHtml(decodeEntities(descMatch[1])), 600) : null;

  const genre = classifyMusic(title, subtitle, description, "jazz");

  return {
    source_event_id: slugify(`${date}-${title}`),
    title,
    subtitle,
    description,
    date,
    time,
    end_time: null,
    detail_url: LISTING_URL,
    ticket_url: ticketUrl,
    image_url: imageUrl,
    price_min: null,
    price_max: null,
    performers: performers ?? title,
    venue_room: null,
    raw_category: "music",
    labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
  };
}
