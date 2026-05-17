import { classifyMusic } from "@museumsufer/classify";
import {
  dateOffset,
  decodeEntities,
  GERMAN_MONTHS,
  nullIfMidnight,
  slugify,
  stripHtml,
  todayIso,
  truncate,
} from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Bad Soden chamber music = Gesellschaft der Musikfreunde Bad Soden e.V.
 * (GDM). The city operates a separate Angular events calendar at
 * bad-soden.de but its API is unauthenticated/undocumented and the chamber
 * concerts of interest live on the GDM site, which is plain
 * server-rendered HTML — three "Hauskonzerte" plus two guest concerts
 * per season. We parse the /konzerte/programm/ page directly.
 *
 * Each .purple span starts a new event; everything between two purple
 * spans (or until the closing </div>) is metadata for the preceding one.
 */

const BASE = "https://www.gdm-online.de";
const PROGRAM_URL = `${BASE}/konzerte/programm/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const EVENT_HEADER_RE = /<p[^>]*>\s*<span class="purple">([\s\S]*?)<\/span>\s*<\/p>/gi;
const HEADER_DATE_RE = /^(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})\s*[-–—]\s*(.+)$/;
const PARAGRAPH_RE = /<p[^>]*>([\s\S]*?)<\/p>/gi;
const UL_RE = /<ul[^>]*>([\s\S]*?)<\/ul>/i;
const LI_RE = /<li[^>]*>([\s\S]*?)<\/li>/gi;
const COPY_OPEN_RE = /<div\s+class="copy"\s*>/i;
const COPY_CLOSE_RE = /<\/div>\s*<div[^>]+class="right"/i;
const TIME_RE = /(?:Beginn|Begin|Beginn:|Start)[^0-9]*(\d{1,2})[:.](\d{2})/i;
const TICKET_RE = /<a[^>]+href="([^"]+)"[^>]*>\s*(?:Online-?Ticketverkauf|Tickets?|Kartenverkauf)/i;
const SKIP_LINE_RE = /online-?ticketverkauf|^drucken$/i;
const VENUE_HINT_RE = /(saal|hotel|kirche|haus|halle|straße|strasse|gasse|platz|kurpark|park)/i;
const PENDING_VENUE_RE = /ort und zeit werden noch bekannt/i;
const QUOTE_TRIM_RE = /^["„“'‚‘]+|["„“'‚‘]+$/g;

export async function scrapeBadSoden(): Promise<VenueScrapeResult> {
  const res = await fetch(PROGRAM_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`bad-soden fetch failed: ${PROGRAM_URL} → ${res.status}`);
  return {
    source_slug: "bad-soden",
    display_name: "Bad Sodener Kammerkonzerte",
    events: parseGdmProgram(await res.text()),
  };
}

function parseGdmProgram(html: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const horizon = dateOffset(300);
  const events: CanonicalScrapedEvent[] = [];

  const content = extractContentArea(html);
  const headers = [...content.matchAll(EVENT_HEADER_RE)];
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const parsed = parseHeader(stripHtml(decodeEntities(header[1])));
    if (!parsed) continue;
    const { date, title } = parsed;
    if (date < today || date > horizon) continue;

    const blockStart = (header.index ?? 0) + header[0].length;
    const blockEnd = i + 1 < headers.length ? (headers[i + 1].index ?? content.length) : content.length;
    const block = content.slice(blockStart, blockEnd);

    const fields = extractFields(block);
    const description = fields.descriptionLines.length ? truncate(fields.descriptionLines.join(" "), 800) : null;
    const subtitle = fields.descriptionLines[0] ? truncate(fields.descriptionLines[0], 200) : null;
    const genre = classifyMusic(title, subtitle, description, "chamber");

    events.push({
      source_event_id: slugify(`${date}-${title}`),
      title,
      subtitle,
      description,
      date,
      time: nullIfMidnight(fields.time),
      end_time: null,
      detail_url: PROGRAM_URL,
      ticket_url: fields.ticketUrl,
      image_url: null,
      price_min: null,
      price_max: null,
      performers: fields.performers,
      venue_room: fields.venueRoom,
      labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return events;
}

interface BlockFields {
  time: string | null;
  venueRoom: string | null;
  ticketUrl: string | null;
  performers: string | null;
  descriptionLines: string[];
}

function extractFields(block: string): BlockFields {
  const paragraphs = [...block.matchAll(PARAGRAPH_RE)].map((m) => stripHtml(decodeEntities(m[1]))).filter(Boolean);

  let time: string | null = null;
  let venueRoom: string | null = null;
  const descriptionLines: string[] = [];

  for (const para of paragraphs) {
    const timeMatch = para.match(TIME_RE);
    if (timeMatch) {
      time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
      continue;
    }
    if (!venueRoom && looksLikeVenue(para)) {
      venueRoom = para;
      continue;
    }
    if (SKIP_LINE_RE.test(para)) continue;
    descriptionLines.push(para);
  }

  const ticketMatch = block.match(TICKET_RE);
  return {
    time,
    venueRoom,
    ticketUrl: ticketMatch ? decodeEntities(ticketMatch[1]) : null,
    performers: extractPerformers(block),
    descriptionLines,
  };
}

function extractPerformers(block: string): string | null {
  const ul = block.match(UL_RE);
  if (!ul) return null;
  const items = [...ul[1].matchAll(LI_RE)].map((m) => stripHtml(decodeEntities(m[1]))).filter(Boolean);
  if (!items.length) return null;
  return truncate(items.join(", "), 300);
}

/**
 * "Ort und Zeit werden noch bekanntgegeben" is the one common false
 * positive that contains "Zeit" but isn't an address — skip it
 * explicitly so it falls into the description bucket instead.
 */
function looksLikeVenue(text: string): boolean {
  if (PENDING_VENUE_RE.test(text)) return false;
  if (text.length > 160) return false;
  return VENUE_HINT_RE.test(text);
}

function extractContentArea(html: string): string {
  const open = html.match(COPY_OPEN_RE);
  if (!open || open.index == null) return html;
  const after = html.slice(open.index + open[0].length);
  const close = after.search(COPY_CLOSE_RE);
  return close >= 0 ? after.slice(0, close) : after;
}

function parseHeader(text: string): { date: string; title: string } | null {
  const m = text.trim().match(HEADER_DATE_RE);
  if (!m) return null;
  const [, day, monthName, year, rawTitle] = m;
  const month = GERMAN_MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  const title = rawTitle.trim().replace(QUOTE_TRIM_RE, "").trim();
  if (!title) return null;
  return { date: `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`, title };
}
