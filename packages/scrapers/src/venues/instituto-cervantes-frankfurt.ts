import { todayIso } from "@museumsufer/core/date";
import { fnv1a } from "@museumsufer/core/hash";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Instituto Cervantes Frankfurt — the homepage links no machine-readable
 * event listing, but the library's four recurring programmes each publish
 * a year-calendar table. We scrape those four pages: Leseclub (monthly
 * book club), Märchenstunde (kids storytelling), Lírica & Duende
 * (poetry open mic), Gesprächsclub (Spanish conversation club).
 *
 * The bigger cultural programme (Vorträge, Konzerte, Ausstellungen) ships
 * as a Kulturprogramm PDF, which we don't parse here. Detail pages on
 * cultura.cervantes.es exist but aren't discoverable from any listing.
 */
const BASE = "https://frankfurt.cervantes.es";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const MONTHS_DE: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

interface Programme {
  path: string;
  /** Berlin-local HH:MM start time, fixed across the year for the programme. */
  time: string;
  /** Berlin-local HH:MM end time. Null when the page only gives a start time. */
  endTime: string | null;
  label: string;
  category: string;
  titleSuffix: string;
}

const PROGRAMMES: Programme[] = [
  {
    path: "/de/bibliothek/veranstaltungen/leseclub.htm",
    time: "19:00",
    endTime: "21:00",
    label: "talk:lesung",
    category: "Leseclub",
    titleSuffix: "Leseclub",
  },
  {
    path: "/de/bibliothek/veranstaltungen/maerchenstunde.htm",
    time: "13:00",
    endTime: null,
    label: "museum:familie",
    category: "Märchenstunde",
    titleSuffix: "Märchenstunde",
  },
  {
    path: "/de/bibliothek/veranstaltungen/lirica_duende.htm",
    time: "19:00",
    endTime: null,
    label: "talk:lesung",
    category: "Lírica & Duende",
    titleSuffix: "Lírica & Duende",
  },
  {
    path: "/de/bibliothek/veranstaltungen/gespraechs_club.htm",
    time: "11:00",
    endTime: "12:00",
    label: "talk:vortrag",
    category: "Gesprächsclub",
    titleSuffix: "Gesprächsclub",
  },
];

// Captures "DD. Month" with optional inline title after a separator (": " | ", " |
// "<td>Title</td>"). Year is implicit — these calendars cover one calendar year.
const ENTRY_RE =
  /(\d{1,2})\.\s*(januar|februar|m[aä]rz|april|mai|juni|juli|august|september|oktober|november|dezember)\b([^<\n]*)/gi;
const TABLE_ROW_RE =
  /<td>\s*(\d{1,2})\.\s*(januar|februar|m[aä]rz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>(?:\s*<td>\s*([\s\S]*?)\s*<\/td>)?/gi;

export async function scrapeInstitutoCervantesFrankfurt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const year = parseInt(today.slice(0, 4), 10);
  const events: CanonicalScrapedEvent[] = [];

  const results = await Promise.allSettled(PROGRAMMES.map((p) => scrapeProgramme(p, year, today)));
  for (const r of results) {
    if (r.status === "fulfilled") events.push(...r.value);
    else console.warn(`instituto-cervantes-frankfurt programme failed: ${r.reason}`);
  }

  return { source_slug: "instituto-cervantes-frankfurt", display_name: "Instituto Cervantes Frankfurt", events };
}

async function scrapeProgramme(programme: Programme, year: number, today: string): Promise<CanonicalScrapedEvent[]> {
  const url = `${BASE}${programme.path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`${programme.path} → ${res.status}`);
  const html = await res.text();

  const entries = collectEntries(html, programme.titleSuffix);
  const out: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const month = MONTHS_DE[entry.month.toLowerCase().normalize("NFC")];
    if (!month) continue;
    const date = `${year}-${String(month).padStart(2, "0")}-${entry.day.padStart(2, "0")}`;
    if (date < today) continue;
    if (seen.has(date)) continue;
    seen.add(date);

    const eventId = fnv1a(`cervantes|${programme.titleSuffix}|${date}`);
    out.push({
      source_event_id: eventId,
      title: entry.title ? `${programme.titleSuffix}: ${entry.title}` : programme.titleSuffix,
      description: entry.byline,
      date,
      time: programme.time,
      end_date: null,
      end_time: programme.endTime,
      detail_url: url,
      ticket_url: null,
      image_url: null,
      raw_category: programme.category,
      language: "es",
      labels: [{ label: programme.label, confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }
  return out;
}

interface ParsedEntry {
  day: string;
  month: string;
  title: string | null;
  byline: string | null;
}

/** Parse dated entries from a Cervantes calendar page. Tries the HTML-table
 *  shape first (Leseclub uses a 3-column "Datum | Titel | Autor" table);
 *  falls back to the inline-list shape (Märchenstunde / Lírica & Duende /
 *  Gesprächsclub all use "DD. Month: title" patterns in <ul><li> or <p>). */
function collectEntries(html: string, _programme: string): ParsedEntry[] {
  const out: ParsedEntry[] = [];

  for (const m of html.matchAll(TABLE_ROW_RE)) {
    const title = stripHtml(decodeEntities(m[3] ?? "")).trim() || null;
    const byline = m[4] ? stripHtml(decodeEntities(m[4])).trim() || null : null;
    out.push({ day: m[1], month: m[2], title, byline });
  }
  if (out.length > 0) return out;

  for (const m of html.matchAll(ENTRY_RE)) {
    const tail = m[3] ?? "";
    const titleMatch = tail.match(/^\s*[:,]\s*(.+?)\s*$/);
    const title = titleMatch ? stripHtml(decodeEntities(titleMatch[1])).trim() || null : null;
    out.push({ day: m[1], month: m[2], title, byline: null });
  }
  return out;
}
