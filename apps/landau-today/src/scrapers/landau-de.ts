/**
 * Scrape www.landau.de — the city's Advantic CMS exposes a public ICS
 * calendar feed at /output/options.php?ModID=11&call=ical&ext=ics that
 * carries every event with full DTSTART/DTEND/LOCATION/DESCRIPTION. The
 * HTML listing pages are paginated (3 pages × 25 events ≈ 75 total) and
 * carry the bits the ICS lacks: stable FID, hero image, deep-link URL.
 *
 * Pipeline:
 *   1. paginate listing pages → HtmlCard[] (title, fid, image, detail URL)
 *   2. fetch ICS once → IcsEvent[] (title, dtstart, dtend, description,
 *      location, uid)
 *   3. join by lowercased title; prefer ICS for time/desc/location and
 *      HTML for image/detail. Synthesize events that exist on only one
 *      side.
 *
 * The site is ISO-8859-1; we transcode at fetch time before any parsing.
 */

import { classifyEventByText } from "../categories";
import type { Event, EventSource } from "../types";

const BASE = "https://www.landau.de";
const SOURCE: EventSource = "landau-de";

const ICS_URL = `${BASE}/output/options.php?ModID=11&call=ical&ext=ics&La=1`;
const LIST_URL = (offset: number) =>
  `${BASE}/Tourismus-Kultur/Veranstaltungen/index.php?ofs_1=${offset}&La=1&NavID=2644.11&bn=1&kuo=1&ModID=11&object=tx%7C2644.4.1`;

interface HtmlCard {
  title: string;
  fid: string;
  detailUrl: string;
  imageUrl?: string;
  dateText?: string;
}

interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtstart: string;
  dtend?: string;
}

export interface LandauDeScrapeOptions {
  fetchImpl?: typeof fetch;
  /** Cap pagination depth — 3 is the production count; raise if events grow. */
  maxPages?: number;
}

export async function scrapeLandauDe(opts: LandauDeScrapeOptions = {}): Promise<Omit<Event, "id">[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxPages = opts.maxPages ?? 5;

  const [icsEvents, htmlCards] = await Promise.all([fetchIcs(fetchImpl), fetchListing(fetchImpl, maxPages)]);

  const cardByTitle = new Map<string, HtmlCard>(htmlCards.map((c) => [normalizeTitle(c.title), c]));
  const usedTitles = new Set<string>();
  const out: Omit<Event, "id">[] = [];

  for (const ics of icsEvents) {
    const key = normalizeTitle(ics.summary);
    const card = cardByTitle.get(key);
    if (card) usedTitles.add(key);
    out.push(toEvent(ics, card));
  }
  // Cards with no matching ICS — usually because the calendar feed truncated
  // far-future events. Synthesize from the HTML alone.
  for (const card of htmlCards) {
    const key = normalizeTitle(card.title);
    if (usedTitles.has(key)) continue;
    const synthesized = htmlOnlyEvent(card);
    if (synthesized) out.push(synthesized);
  }
  return out;
}

// ─── ICS ──────────────────────────────────────────────────────────────

async function fetchIcs(fetchImpl: typeof fetch): Promise<IcsEvent[]> {
  const res = await fetchImpl(ICS_URL, { headers: { "User-Agent": "landau-today/1.0" } });
  if (!res.ok) {
    console.warn(`landau.de ics: HTTP ${res.status}`);
    return [];
  }
  return parseIcs(await res.text());
}

function parseIcs(ics: string): IcsEvent[] {
  // ICS line continuations: lines beginning with a space/tab are folded
  // into the previous line. Unfold first, then split on VEVENT blocks.
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);
  const out: IcsEvent[] = [];
  for (const block of blocks) {
    const body = block.split("END:VEVENT")[0];
    const ev = parseVevent(body);
    if (ev) out.push(ev);
  }
  return out;
}

function parseVevent(body: string): IcsEvent | null {
  const fields = new Map<string, string>();
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const left = line.slice(0, colon);
    const value = unescapeIcsText(line.slice(colon + 1));
    const semi = left.indexOf(";");
    const name = (semi === -1 ? left : left.slice(0, semi)).toUpperCase();
    fields.set(name, value);
  }
  const uid = fields.get("UID");
  const summary = fields.get("SUMMARY");
  const dtstart = fields.get("DTSTART");
  if (!uid || !summary || !dtstart) return null;
  return {
    uid,
    summary,
    description: fields.get("DESCRIPTION") || undefined,
    location: fields.get("LOCATION") || undefined,
    dtstart,
    dtend: fields.get("DTEND") || undefined,
  };
}

function unescapeIcsText(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseIcsDateTime(raw: string): { date: string; time?: string } {
  // Accepts both 20260523T110000 (with TZID) and 20260523 (DATE-only).
  const cleaned = raw.replace(/Z$/, "");
  const m = cleaned.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return { date: "" };
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (m[4] === undefined) return { date };
  if (m[4] === "00" && m[5] === "00") return { date };
  return { date, time: `${m[4]}:${m[5]}` };
}

// ─── HTML listing ─────────────────────────────────────────────────────

async function fetchListing(fetchImpl: typeof fetch, maxPages: number): Promise<HtmlCard[]> {
  const cards: HtmlCard[] = [];
  for (let i = 0; i < maxPages; i++) {
    const offset = i * 25;
    const html = await fetchUtf8(fetchImpl, LIST_URL(offset));
    if (!html) break;
    const page = parseListing(html);
    if (page.length === 0) break;
    cards.push(...page);
  }
  return cards;
}

async function fetchUtf8(fetchImpl: typeof fetch, url: string): Promise<string | null> {
  try {
    const res = await fetchImpl(url, { headers: { "User-Agent": "landau-today/1.0" } });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return new TextDecoder("iso-8859-1").decode(buf);
  } catch (err) {
    console.warn(`landau.de fetch: ${(err as Error).message}`);
    return null;
  }
}

function parseListing(html: string): HtmlCard[] {
  // Each event row sits between `<div class="trenner">` separators; slicing
  // on that gives us self-contained substrings to regex over.
  const blocks = html.split(/<div\s+class="trenner"/i);
  const cards: HtmlCard[] = [];
  for (const block of blocks) {
    const fid = match(block, /FID=(2644\.\d+\.\d+)/);
    if (!fid) continue;
    const titleAndUrl = block.match(/<div\s+class="liste_titel">\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleAndUrl) continue;
    const detailUrl = decodeEntities(titleAndUrl[1]);
    const title = stripHtml(decodeEntities(titleAndUrl[2])).replace(/»/g, "").trim();
    const imageUrl = match(block, /<div\s+class="liste_bild">[\s\S]*?<img\s+src="([^"]+)"/i);
    const dateText = match(block, /<div\s+class="date">\s*([\s\S]*?)\s*<\/div>/i);
    cards.push({
      title,
      fid,
      detailUrl: detailUrl.startsWith("http") ? detailUrl : `${BASE}${detailUrl}`,
      imageUrl: imageUrl ? (imageUrl.startsWith("http") ? imageUrl : `${BASE}${imageUrl}`) : undefined,
      dateText: dateText ? stripHtml(dateText).trim() : undefined,
    });
  }
  return cards;
}

// ─── Merge → Event ────────────────────────────────────────────────────

function toEvent(ics: IcsEvent, card?: HtmlCard): Omit<Event, "id"> {
  const start = parseIcsDateTime(ics.dtstart);
  const end = ics.dtend ? parseIcsDateTime(ics.dtend) : undefined;
  const description = ics.description?.replace(/\s+/g, " ").trim().slice(0, 500) || undefined;
  const { venue, city } = parseIcsLocation(ics.location);
  const category = classifyEventByText(ics.summary, description);
  const detailUrl = card?.detailUrl ?? `${BASE}/Tourismus-Kultur/Veranstaltungen/`;
  return {
    source: SOURCE,
    source_uid: card?.fid ?? ics.uid,
    title: ics.summary.trim(),
    date: start.date,
    ...(start.time ? { time: start.time } : {}),
    ...(end?.date && end.date !== start.date ? { end_date: end.date } : {}),
    ...(end?.time ? { end_time: end.time } : {}),
    category,
    ...(venue ? { venue } : {}),
    ...(city ? { city } : {}),
    ...(description ? { description } : {}),
    detail_url: detailUrl,
    ...(card?.imageUrl ? { image_url: card.imageUrl } : {}),
  };
}

function htmlOnlyEvent(card: HtmlCard): Omit<Event, "id"> | null {
  const dt = parseGermanDateRange(card.dateText);
  if (!dt) return null;
  return {
    source: SOURCE,
    source_uid: card.fid,
    title: card.title,
    date: dt.start,
    ...(dt.end && dt.end !== dt.start ? { end_date: dt.end } : {}),
    category: classifyEventByText(card.title),
    city: "Landau in der Pfalz",
    detail_url: card.detailUrl,
    ...(card.imageUrl ? { image_url: card.imageUrl } : {}),
  };
}

function parseGermanDateRange(text?: string): { start: string; end?: string } | null {
  if (!text) return null;
  const dates = text.match(/\d{2}\.\d{2}\.\d{4}/g);
  if (!dates || dates.length === 0) return null;
  const toIso = (de: string) => `${de.slice(6, 10)}-${de.slice(3, 5)}-${de.slice(0, 2)}`;
  const start = toIso(dates[0]);
  const end = dates[1] ? toIso(dates[1]) : undefined;
  return { start, end };
}

function parseIcsLocation(loc?: string): { venue?: string; city?: string } {
  if (!loc) return {};
  // Format: "Ortschaft, Veranstaltungsort" — split into both fields so the
  // renderer can show "Stadtbibliothek · Landau" instead of stripping the
  // city away (which used to be fine when this app was Landau-only, but
  // now there are nearby villages from other sources we want to disambiguate
  // against).
  const parts = loc
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { venue: parts[0] };
  // Format is "<city>, <venue>" most of the time. If the leading token
  // starts with "Landau", it's the city; otherwise treat the whole string
  // as venue and leave city empty.
  if (/^Landau/i.test(parts[0])) {
    return { city: parts[0], venue: parts.slice(1).join(", ") };
  }
  return { venue: loc.trim() };
}

// ─── small helpers (avoid pulling DOMParser) ─────────────────────────

function match(haystack: string, re: RegExp): string | undefined {
  return haystack.match(re)?.[1];
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&raquo;/g, "»")
    .replace(/&laquo;/g, "«")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")
    .replace(/&#160;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/["»«]/g, "")
    .replace(/[^a-z0-9äöüß\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
