import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.karlstorkino.de";
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const ROW_RE = /<tr\s+(?:class="[^"]*"\s+)?valign="top"[^>]*>([\s\S]*?)<\/tr>/g;
const TIME_RE = /<td\s+valign="top"\s+nowrap>\s*([\d:.]+)\s*Uhr/;
const TICKET_RE = /href="https:\/\/booking\.cinetixx\.de\/[^"]*showId=(\d+)[^"]*"/;
const DATE_RE = /<td\s+nowrap\s+valign="top">\s*([^<]*?)(?:<a\b[^>]*><\/a>\s*)?\s*<\/td>/g;
const TITLE_RE = /<a\s+class="LinkBold"\s+href="\s*([^"]+?)\s*">\s*([\s\S]*?)\s*<\/A>/i;
const VENUE_RE = /<b>([^<]+)<\/b>/;

interface ParsedRow {
  weekday: string | null;
  dateText: string | null;
  time: string | null;
  showId: string | null;
  detailPath: string | null;
  title: string | null;
  language: string | null;
  venue: string | null;
}

/**
 * Karlstorkino Heidelberg — communal art-house cinema at Am Karlstor 1.
 * The server-rendered homepage lists dated screenings in a table; each
 * Karlstorkino (Südstadt) row carries a Cinetixx booking link with a stable
 * showId. We parse the table, carry the current day forward for multi-row
 * days, and emit one event per future showId.
 */
export async function scrapeKarlstorkino(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(BASE, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`karlstorkino fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  let currentDate: string | null = null;

  for (const rm of html.matchAll(ROW_RE)) {
    const row = rm[1];
    const parsed = parseRow(row);

    // A new day header carries a weekday and date; subsequent rows on the same
    // day leave those columns blank (filled with &nbsp;). Only update the
    // carried date when we actually see a dd.mm. pattern.
    const parsedDate = parsed.dateText ? parseGermanDate(parsed.dateText, today) : null;
    if (parsedDate) {
      currentDate = parsedDate;
    }

    if (!currentDate || currentDate < today) continue;
    if (!parsed.time || !parsed.showId || !parsed.title) continue;
    if (!parsed.venue?.includes("Karlstorkino")) continue;

    if (seen.has(parsed.showId)) continue;
    seen.add(parsed.showId);

    events.push({
      source_event_id: parsed.showId,
      city: "heidelberg",
      lat: 49.4106,
      lon: 8.714,
      title: parsed.title,
      subtitle: parsed.language ?? null,
      date: currentDate,
      time: parsed.time,
      detail_url: parsed.detailPath ? `${BASE}${parsed.detailPath}` : null,
      ticket_url: `https://booking.cinetixx.de/frontend/index.html?bgswitch=false&resize=false&cinemaId=1793203565&showId=${parsed.showId}`,
      labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  events.sort((a, b) =>
    a.date !== b.date
      ? a.date.localeCompare(b.date)
      : (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title),
  );
  return { source_slug: "karlstorkino", display_name: "Karlstorkino Heidelberg", events };
}

function parseRow(row: string): ParsedRow {
  const tds = [...row.matchAll(DATE_RE)];
  const weekday = tds[0]?.[1]?.trim().replace(/\.$/, "") || null;
  const dateText = tds[1]?.[1]?.trim().replace(/\/$/, "").trim() || null;

  const time = row.match(TIME_RE)?.[1] ?? null;
  const showId = row.match(TICKET_RE)?.[1] ?? null;

  const titleMatch = row.match(TITLE_RE);
  const rawDetailPath = titleMatch?.[1]?.trim() ?? null;
  const rawTitle = titleMatch?.[2]?.trim() ?? null;

  let title: string | null = null;
  let language: string | null = null;
  if (rawTitle) {
    const cleaned = stripHtml(rawTitle).replace(/\s+/g, " ").trim();
    const parts = cleaned.split(",").map((s) => s.trim());
    if (parts.length > 1) {
      language = parts.pop() ?? null;
      title = parts.join(", ").trim();
    } else {
      title = cleaned;
    }
  }

  const venue = row.match(VENUE_RE)?.[1]?.trim() ?? null;

  return { weekday, dateText, time, showId, detailPath: rawDetailPath, title, language, venue };
}

function parseGermanDate(text: string, today: string): string | null {
  const m = text.match(/(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  const [, dd, mm] = m;
  const year = inferYear(parseInt(mm, 10), today);
  return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function inferYear(month: number, today: string): number {
  const currentYear = parseInt(today.slice(0, 4), 10);
  const currentMonth = parseInt(today.slice(5, 7), 10);
  return month < currentMonth ? currentYear + 1 : currentYear;
}
