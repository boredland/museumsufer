import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.staatstheater.saarland";
const KALENDARIUM_URL = `${BASE}/kalendarium/`;
const SPIELZEIT_URL = `${BASE}/spielzeit-2026-27/kalendarium/`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const LAT = 49.234;
const LON = 6.996;

/**
 * Saarländisches Staatstheater Saarbrücken — multi-genre house (opera,
 * drama, ballet, concerts, puppet theatre). The schedule lives on two
 * TYPO3-powered Kalendarium pages:
 *   • `/kalendarium/` — current season tail (remaining dates)
 *   • `/spielzeit-2026-27/kalendarium/` — next season
 *
 * Both render server-side `<div class="date-item …" data-month="MM-YYYY">`
 * blocks with `.timetableDate`, `.timetableTime`, `.timetableTitle h2 a`,
 * `.timetableSpielstaette`, `.timetableTicket a.ticketLink`, and an ICS
 * link carrying the `termin` id. Cancelled performances carry a `danger`
 * CSS class on the wrapper and a `<label class="… eventCanceled">Fällt
 * aus</label>`.
 */
export async function scrapeStaatstheaterSaarland(): Promise<VenueScrapeResult> {
  const today = todayIso();

  const [currentHtml, spielzeitHtml] = await Promise.all([
    fetchPage(KALENDARIUM_URL),
    fetchPage(SPIELZEIT_URL),
  ]);

  const seen = new Set<string>();
  const events: CanonicalScrapedEvent[] = [];

  for (const html of [currentHtml, spielzeitHtml]) {
    for (const ev of parseKalendarium(html, today)) {
      if (!seen.has(ev.source_event_id)) {
        seen.add(ev.source_event_id);
        events.push(ev);
      }
    }
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return {
    source_slug: "staatstheater-saarland",
    display_name: "Saarländisches Staatstheater",
    events,
  };
}

function fetchPage(url: string): Promise<string> {
  return fetch(url, { headers: { "User-Agent": UA } }).then((r) => {
    if (!r.ok) throw new Error(`Staatstheater Saarland fetch failed: ${r.status} ${url}`);
    return r.text();
  });
}

function parseKalendarium(html: string, today: string): CanonicalScrapedEvent[] {
  const results: CanonicalScrapedEvent[] = [];
  const blockRe =
    /<div\s+data-date-type="\d+"\s+data-month="(\d{2})-(\d{4})"[^>]*>([\s\S]*?)(?=<div\s+data-date-type=|$)/g;
  let m: RegExpExecArray | null;

  while ((m = blockRe.exec(html)) !== null) {
    const month = parseInt(m[1], 10);
    const year = parseInt(m[2], 10);
    const block = m[3];

    const dayStr = extractFirst(block, /timetableDate">\s*(\d{1,2})\./);
    if (!dayStr) continue;
    const day = parseInt(dayStr, 10);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date < today) continue;

    if (/eventCanceled/.test(block)) continue;

    const timeRaw = extractFirst(block, /timetableTime">([\s\S]*?)<\/div>/);
    const time = parseStartTime(timeRaw);

    const titleMatch = block.match(
      /timetableTitle">\s*<h2>\s*<a\s+href="([^"]*)">\s*([\s\S]*?)\s*<\/a>/,
    );
    if (!titleMatch) continue;
    const detailPath = titleMatch[1];
    const title = stripHtml(titleMatch[2]);
    if (!title) continue;

    const subtitle =
      extractFirst(block, /<h3>([\s\S]*?)<\/h3>/) ||
      extractFirst(block, /timetableshortTeaser">([\s\S]*?)<\/span>/);

    const venue =
      extractFirst(block, /timetableSpielstaette">\s*<a[^>]*>([\s\S]*?)<\/a>/) ||
      extractFirst(block, /timetableSpielstaette">\s*([^\n<]+)/);

    const ticketMatch = block.match(/timetableTicket[\s\S]*?<a\s+href="([^"]*eventim[^"]*)"/);
    const ticketUrl = ticketMatch?.[1] ?? null;

    const terminMatch = block.match(/termin(?:%5D|])=(\d+)/);
    const terminId =
      terminMatch?.[1] ?? `${date}-${title.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const detailUrl = detailPath.startsWith("http") ? detailPath : `${BASE}${detailPath}`;

    const eventType = extractFirst(block, /timetableEventType[^"]*">([\s\S]*?)<\/div>/);
    const freeEntry = /Eintritt\s+frei/i.test(eventType ?? "");

    results.push({
      source_event_id: terminId,
      title,
      subtitle: subtitle || null,
      date,
      time: time || null,
      detail_url: detailUrl,
      ticket_url: ticketUrl,
      venue_room: venue || null,
      city: "saarbruecken",
      lat: LAT,
      lon: LON,
      labels: resolveStageLabels({
        title,
        subtitle: subtitle || null,
        hint: eventType || null,
      }),
      price_min: freeEntry ? 0 : null,
      price_max: null,
    });
  }

  return results;
}

function extractFirst(html: string, re: RegExp): string | null {
  const m = html.match(re);
  if (!m?.[1]) return null;
  return stripHtml(m[1]);
}

function parseStartTime(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2}:\d{2})/);
  return m?.[1] ?? null;
}
