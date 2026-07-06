import { classifyMusic } from "@museumsufer/classify";
import {
  dateOffset,
  decodeEntities,
  normalizeUrl,
  sanitizeImageUrl,
  slugify,
  stripHtml,
  todayIso,
  truncate,
} from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.club-voltaire.de";
const LISTING_URL = `${BASE}/veranstaltungen/alle`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const TERMIN_RE = /<h4 class="termin">\s*([\s\S]*?)<\/h4>/;
const REIHE_RE = /<h4 class="reihe">\s*([\s\S]*?)<\/h4>/;
const ROOM_RE = /<h5>\s*([\s\S]*?)<\/h5>/;
const TITLE_RE = /<h2>\s*([\s\S]*?)<\/h2>/;
const SUBTITLE_RE = /<h3>\s*([\s\S]*?)<\/h3>/;
const DESC_RE = /<p>([\s\S]*?)<\/p>\s*<p\s+class="quelle"/;
const DATE_RE =
  /(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)?,?\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*\*\s*(\d{1,2})(?::(\d{2}))?\s*Uhr/i;
const IMG_RE = /<img[^>]+src="((?:img\/|https?:\/\/)[^"]+)"/;
const TICKET_RE =
  /href="(https?:\/\/[^"]*(?:rausgegangen|eventim|reservix|adticket|frankfurtticket|ra\.co|dice\.fm)[^"]+)"/i;

/**
 * Club Voltaire publishes the full programme inline on /veranstaltungen/alle
 * — each event is a `<div class="inhalt" …>` block with the date in
 * `<h4 class="termin">`, optional series in `<h4 class="reihe">`, room
 * in `<h5>`, title in `<h2>`, subtitle in `<h3>`, and description in
 * the leading `<p>` before the `<p class="quelle">` "last edited"
 * footer.
 *
 * The page is encoded as ISO-8859-1, which `Response.text()` would
 * mojibake — we decode the raw bytes ourselves.
 *
 * `ClubJazz` is the in-house jazz series; other events range from
 * politics talks to film screenings. The scraper emits all of them
 * and lets the hub classifier route by content; the `reihe` field is
 * preserved as an upstream-tag label so downstream filters can lean
 * on it directly.
 */
export async function scrapeClubVoltaire(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(180);
  const html = await fetchHtml();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const block of html.split(/<div class="inhalt"[^>]*>/).slice(1)) {
    const parsed = parseBlock(block);
    if (!parsed) continue;
    if (parsed.date < today || parsed.date > horizon) continue;
    const key = slugify(`${parsed.date}-${parsed.title}`);
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(toCanonical(parsed, key));
  }

  return { source_slug: "club-voltaire", display_name: "Club Voltaire Frankfurt", events };
}

async function fetchHtml(): Promise<string> {
  const res = await fetch(LISTING_URL, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) throw new Error(`club-voltaire fetch failed: ${LISTING_URL} → ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder("iso-8859-1").decode(buf);
}

interface Parsed {
  date: string;
  time: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  room: string | null;
  series: string | null;
  imageUrl: string | null;
  ticketUrl: string | null;
}

function parseBlock(block: string): Parsed | null {
  const termin = TERMIN_RE.exec(block);
  if (!termin) return null;
  const dateMatch = DATE_RE.exec(termin[1]);
  if (!dateMatch) return null;
  const day = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const year = parseInt(dateMatch[3], 10);
  const hour = parseInt(dateMatch[4], 10);
  const minute = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const titleMatch = TITLE_RE.exec(block);
  const title = titleMatch ? clean(titleMatch[1]) : "";
  if (!title) return null;

  const subtitleMatch = SUBTITLE_RE.exec(block);
  const subtitle = subtitleMatch ? clean(subtitleMatch[1]) || null : null;

  const roomMatch = ROOM_RE.exec(block);
  const room = roomMatch ? clean(roomMatch[1]) || null : null;

  const reiheMatch = REIHE_RE.exec(block);
  const series = reiheMatch ? clean(reiheMatch[1]) || null : null;

  const imgMatch = IMG_RE.exec(block);
  const imageUrl = imgMatch ? sanitizeImageUrl(normalizeUrl(imgMatch[1], `${BASE}/veranstaltungen/`)) : null;

  const ticketMatch = TICKET_RE.exec(block);
  const ticketUrl = ticketMatch ? decodeEntities(ticketMatch[1]) : null;

  const descMatch = DESC_RE.exec(block);
  const description = descMatch ? truncate(stripHtml(decodeEntities(descMatch[1])), 600) : null;

  return { date, time, title, subtitle, description, room, series, imageUrl, ticketUrl };
}

function clean(html: string): string {
  return stripHtml(decodeEntities(html)).replace(/\s+/g, " ").trim();
}

function toCanonical(p: Parsed, key: string): CanonicalScrapedEvent {
  const labels: ScrapedLabel[] = [];
  const hay = `${p.title} ${p.subtitle ?? ""} ${p.series ?? ""} ${p.description ?? ""}`;
  const looksJazz = /\bjazz\b/i.test(hay) || p.series?.toLowerCase().includes("clubjazz");
  if (looksJazz) {
    const genre = classifyMusic(p.title, p.subtitle, p.description, "jazz");
    labels.push({ label: `music:${genre}`, confidence: 0.85, classifier: "scraper-hardcoded" });
  }
  if (p.series) {
    labels.push({ label: `upstream-tag:${slugify(p.series)}`, confidence: 0.7, classifier: "upstream-tag" });
  }

  return {
    source_event_id: key,
    title: p.title,
    subtitle: p.subtitle,
    description: p.description,
    date: p.date,
    time: p.time,
    end_time: null,
    detail_url: LISTING_URL,
    ticket_url: p.ticketUrl,
    image_url: p.imageUrl,
    price_min: null,
    price_max: null,
    performers: p.title,
    venue_room: p.room,
    raw_category: p.series,
    labels,
  };
}
