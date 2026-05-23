import { classifyDance } from "@museumsufer/classify";
import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.hessisches-staatsballett.de";
const SPIELPLAN_URL = `${BASE}/de/spielplan/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

/**
 * Hessisches Staatsballett — the joint company of Wiesbaden and Darmstadt.
 * Their WordPress spielplan emits one `.calendar-teaser` per performance
 * with stable selectors for date/time/city/venue/title. Per-event coords are
 * resolved from the city chip (Wiesbaden vs Darmstadt Staatstheater) because
 * the two houses are 60 km apart — a single source-default centroid would
 * misplace half the events on the map. Darmstadt sits outside
 * `FRANKFURT_BBOX` so those events land in the hub but only surface in
 * apps with a wider geofence (e.g. lichtspiel-haus, future Rhein-Main).
 */

const CITY_COORDS: Record<string, readonly [number, number]> = {
  Wiesbaden: [50.0823, 8.2417],
  Darmstadt: [49.8716, 8.6502],
};

interface RawTeaser {
  day: string;
  hour: string;
  city: string;
  venue: string | null;
  slug: string;
  detailUrl: string;
  title: string;
  programme: string[];
  caption: string | null;
  ticketUrl: string | null;
}

export async function scrapeHessischesStaatsballett(): Promise<VenueScrapeResult> {
  const html = await fetchText(SPIELPLAN_URL);
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const raw of parseTeasers(html)) {
    const date = parseDate(raw.day);
    if (!date || date < today) continue;
    const time = parseTime(raw.hour);
    const coords = CITY_COORDS[raw.city];

    const sourceEventId = `${raw.slug}|${date}|${time ?? ""}|${raw.city}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const subtitle = raw.caption ?? raw.programme[0] ?? null;
    const description =
      raw.programme.length > 0 ? [raw.caption, raw.programme.join(" · ")].filter(Boolean).join(" — ") : raw.caption;
    const genre = classifyDance(raw.title, subtitle, description, "contemporary");

    events.push({
      source_event_id: sourceEventId,
      title: raw.title,
      subtitle,
      description: description || null,
      date,
      time,
      detail_url: raw.detailUrl,
      ticket_url: raw.ticketUrl,
      image_url: null,
      language: "de",
      venue_room: raw.venue ? `${raw.city} — ${raw.venue}` : raw.city,
      lat: coords?.[0] ?? null,
      lon: coords?.[1] ?? null,
      labels: [{ label: `dance:${genre}`, confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "hessisches-staatsballett", display_name: "Hessisches Staatsballett", events };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`hessisches-staatsballett fetch ${url} failed: ${res.status}`);
  return res.text();
}

function parseTeasers(html: string): RawTeaser[] {
  const out: RawTeaser[] = [];
  const blockRe =
    /<div\s+class="calendar-teaser"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*(?=<div class="calendar-teaser"|<\/div>\s*<\/div>\s*<\/div>)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const teaser = parseOne(m[1]);
    if (teaser) out.push(teaser);
  }
  return out;
}

function parseOne(block: string): RawTeaser | null {
  const day = pickText(block, /<span\s+class="teaser-date-day">([\s\S]*?)<\/span>/);
  const hour = pickText(block, /<span\s+class="teaser-date-hour">([\s\S]*?)<\/span>/);
  const city = pickText(block, /<span\s+class="city-long">([\s\S]*?)<\/span>/);
  if (!day || !hour || !city) return null;

  const venue = pickText(block, /<span\s+class="teaser-location-venue">([\s\S]*?)<\/span>/);
  const detailUrl = pickAttr(block, /<a\s+href="([^"]+)"\s+class="teaser-detail-link"/);
  if (!detailUrl) return null;
  const slug = slugFromUrl(detailUrl);
  const title = pickText(block, /<h3\s+class="teaser-title">[\s\S]*?<em>([\s\S]*?)<\/em>/);
  if (!title) return null;

  const programme: string[] = [];
  const progRe = /<span\s+class="teaser-event-type">([\s\S]*?)<\/span>/g;
  let pm: RegExpExecArray | null;
  while ((pm = progRe.exec(block)) !== null) {
    const t = cleanText(pm[1]);
    if (t) programme.push(t);
  }

  const caption = pickText(block, /<p\s+class="teaser-caption">([\s\S]*?)<\/p>/);
  const ticketUrl = pickAttr(block, /<a\s+href="([^"]+)"[^>]*class="cta-primary-small"/);

  return {
    day,
    hour,
    city,
    venue: venue || null,
    slug,
    detailUrl,
    title,
    programme,
    caption: caption || null,
    ticketUrl,
  };
}

function pickText(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? cleanText(m[1]) : null;
}

function pickAttr(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}

function slugFromUrl(url: string): string {
  const m = url.match(/\/stuecke\/([^/]+)\/?$/);
  return (m?.[1] ?? url).replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
}

/**
 * Teaser dates come as "27.5.26," — d.m.yy with trailing comma. Anchor the
 * year on the current century; the spielplan is forward-looking so 26 → 2026.
 */
function parseDate(raw: string): string | null {
  const m = raw.replace(/,\s*$/, "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const yearRaw = parseInt(m[3], 10);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Time chips are either "20 Uhr" or "19.30 Uhr"; period is the decimal. */
function parseTime(raw: string): string | null {
  const m = raw.match(/(\d{1,2})(?:\.(\d{1,2}))?\s*Uhr/i);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
