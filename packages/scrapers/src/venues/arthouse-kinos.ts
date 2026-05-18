import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.arthouse-kinos.de";
const LISTING_URL = `${BASE}/programm-tickets/`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const CINEMA_SLUG: Record<string, { slug: string; name: string }> = {
  "kino-frankfurt-am-main/cinema-frankfurt": { slug: "cinema-frankfurt", name: "Cinéma Frankfurt" },
  "kino-frankfurt-am-main/eldorado-arthouse-kino": { slug: "eldorado-frankfurt", name: "Eldorado Arthouse Kino" },
  "kino-frankfurt-am-main/harmonie-theater-frankfurt": {
    slug: "harmonie-frankfurt",
    name: "Harmonie Theater Frankfurt",
  },
};

// Top-level film tiles carry `js-filter-movie-date`; this anchor avoids
// false hits on the nested *-data / *-showtimes child divs that share the
// `programme-table-main-grid-movieitem` class prefix.
const TILE_RE =
  /<div class="programme-table-main-grid-movieitem js-filter-movie-date[^"]*"[^>]*>([\s\S]*?)(?=<div class="programme-table-main-grid-movieitem js-filter-movie-date|<div id="programme-table-bottom)/g;

/**
 * Scrapes the shared programme page for the three Frankfurt arthouse cinemas
 * (Cinéma, Eldorado, Harmonie). Returns one result per cinema since each has
 * its own venue identity even though they publish their schedule in one place.
 */
export async function scrapeArthouseKinos(): Promise<VenueScrapeResult[]> {
  const today = todayIso();
  const res = await fetch(LISTING_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`arthouse-kinos fetch failed: ${res.status}`);
  const html = await res.text();

  const byCinema = new Map<string, CanonicalScrapedEvent[]>();
  for (const c of Object.values(CINEMA_SLUG)) byCinema.set(c.slug, []);

  for (const tileMatch of html.matchAll(TILE_RE)) {
    const tile = tileMatch[0];

    const titleMatch = tile.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    if (!titleMatch) continue;
    const title = stripHtml(titleMatch[1]).trim();
    if (!title) continue;

    const detailMatch = tile.match(/<a[^>]+href="(\/filme\/[^"]+)"/);
    const detail_url = detailMatch ? `${BASE}${detailMatch[1]}` : null;

    const filterDates = Array.from(tile.matchAll(/filter-date-(\d{4}-\d{2}-\d{2})/g), (m) => m[1]);
    const dateLookup = new Map<string, string>();
    for (const iso of filterDates) {
      const [, mm, dd] = iso.split("-");
      dateLookup.set(`${dd}.${mm}`, iso);
    }

    const colDates = parseHeaderRow(tile, today, dateLookup);
    if (colDates.length === 0) continue;

    const showtimes = parseShowtimes(tile, colDates);
    for (const s of showtimes) {
      if (s.date < today) continue;
      const cinema = CINEMA_SLUG[s.cinemaPath];
      if (!cinema) continue;
      const bucket = byCinema.get(cinema.slug);
      if (!bucket) continue;
      bucket.push({
        source_event_id: `${s.showid}`,
        title,
        date: s.date,
        time: s.time,
        detail_url,
        ticket_url: s.ticket_url,
        labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
      });
    }
  }

  return [...byCinema.entries()].map(([slug, events]) => ({
    source_slug: slug,
    display_name: Object.values(CINEMA_SLUG).find((c) => c.slug === slug)?.name,
    events,
  }));
}

interface Showtime {
  cinemaPath: string;
  showid: string;
  date: string;
  time: string;
  ticket_url: string | null;
}

function parseHeaderRow(tile: string, today: string, dateLookup: Map<string, string>): string[] {
  // The first <tr> in each tile's table is the column-header row. We map each
  // <th> to an ISO date so the cells below can pick the right column index.
  const trMatch = tile.match(/<table[^>]*>\s*<thead[^>]*>?\s*<tr[^>]*>([\s\S]*?)<\/tr>/);
  const tr = trMatch ? trMatch[1] : tile.match(/<tr[^>]*>([\s\S]*?)<\/tr>/)?.[1];
  if (!tr) return [];
  const dates: string[] = [];
  for (const m of tr.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)) {
    const label = stripHtml(m[1]).trim();
    if (!label) {
      dates.push(""); // grid-divider column — keep position alignment
      continue;
    }
    if (/heute/i.test(label)) {
      dates.push(today);
      continue;
    }
    const dm = label.match(/(\d{1,2})\.(\d{1,2})/);
    if (!dm) {
      dates.push("");
      continue;
    }
    const key = `${dm[1].padStart(2, "0")}.${dm[2].padStart(2, "0")}`;
    dates.push(dateLookup.get(key) ?? inferDate(key, today));
  }
  return dates;
}

function inferDate(ddmm: string, today: string): string {
  const [dd, mm] = ddmm.split(".");
  const currentYear = parseInt(today.slice(0, 4), 10);
  const currentMonth = parseInt(today.slice(5, 7), 10);
  const month = parseInt(mm, 10);
  const year = month < currentMonth ? currentYear + 1 : currentYear;
  return `${year}-${mm}-${dd}`;
}

function parseShowtimes(tile: string, colDates: string[]): Showtime[] {
  // The body <tr> mirrors the header column order; each <td> is either empty
  // (rendered as "—") or a showtime link with data-cinema-path/data-showid.
  const trs = Array.from(tile.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g));
  if (trs.length < 2) return [];
  const bodyTr = trs[1][1];
  const cells: string[] = [];
  for (const m of bodyTr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)) cells.push(m[1]);

  const showtimes: Showtime[] = [];
  for (let i = 0; i < cells.length && i < colDates.length; i++) {
    const cell = cells[i];
    const date = colDates[i];
    if (!date) continue;
    for (const link of cell.matchAll(
      /<a\s+href="([^"]+)"[^>]*data-cinema-path="([^"]+)"[^>]*data-showid="(\d+)"[^>]*>[\s\S]*?<span class="movie-itemshowtime-linktext">(\d{1,2}:\d{2})<\/span>/g,
    )) {
      const [, ticketUrl, cinemaPath, showid, time] = link;
      showtimes.push({ cinemaPath, showid, date, time, ticket_url: ticketUrl.replace(/&amp;/g, "&") });
    }
  }
  return showtimes;
}
