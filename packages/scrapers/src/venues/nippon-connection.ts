import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://db.nipponconnection.com";
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";
const FESTIVAL_YEAR = new Date().getFullYear();

const TILE_RE =
  /<div data-key="(\d+)">\s*<div class="new-tile">\s*<a href="(\/de\/event\/\d+\/[^"]+)">([\s\S]+?)<\/a>\s*<\/div>\s*<\/div>/g;
const DIRECTOR_RE = /<h4>\s*([\s\S]*?)\s*<\/h4>/;
const TITLE_RE = /<h2>([\s\S]+?)<\/h2>/;
const META_RE = /<p>\s*([\s\S]{0,200}?)\s*<\/p>/;
const DATE_RE =
  /<b>\s*([A-Za-z]+\.?,?\s*\d{1,2}\.\s*[A-Za-zäöü]+\s*\d{4}),\s*(\d{1,2}:\d{2})\s*Uhr\s*<\/b>(?:\s*<br\s*\/?>)?\s*([^<]*)/;
const FLAG_RE = /<span class="small">([^<]+)<\/span>/;
const IMG_RE = /<img[^>]+src="([^"]+)"/;

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

/**
 * Nippon Connection — Frankfurt's annual Japanese film festival. Its
 * public database (db.nipponconnection.com) renders every screening
 * + event as a `data-key` tile with a /de/event/{id}/{slug} URL, full
 * date in "Wo., DD. Monat YYYY, HH:MM Uhr" form, and a venue line.
 */
export async function scrapeNipponConnection(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const url = `${BASE}/de/${FESTIVAL_YEAR}/event/film`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    // Festival is annual; if this year's listing is missing fall back to next year.
    const fallback = await fetch(`${BASE}/de/${FESTIVAL_YEAR + 1}/event/film`, { headers: { "User-Agent": UA } });
    if (!fallback.ok) throw new Error(`nippon-connection fetch failed: ${res.status} / ${fallback.status}`);
    return parseEvents(await fallback.text(), today, FESTIVAL_YEAR + 1);
  }
  return parseEvents(await res.text(), today, FESTIVAL_YEAR);
}

function parseEvents(html: string, today: string, year: number): VenueScrapeResult {
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(TILE_RE)) {
    const [, dataKey, href, body] = m;
    const titleMatch = body.match(TITLE_RE);
    if (!titleMatch) continue;
    const rawTitle = stripHtml(titleMatch[1])
      .replace(/<br\s*\/?>(?:\s|&nbsp;)*/gi, " · ")
      .replace(/\s+/g, " ")
      .trim();
    const title = rawTitle.split(" · ")[0] ?? rawTitle;
    if (!title) continue;
    const originalTitle = rawTitle.includes(" · ") ? rawTitle.split(" · ").slice(1).join(" · ") : null;

    const dateMatch = body.match(DATE_RE);
    if (!dateMatch) continue;
    const date = parseGermanDate(dateMatch[1], year);
    if (!date || date < today) continue;
    const time = dateMatch[2];
    const venue =
      dateMatch[3]
        .trim()
        .replace(/<br\s*\/?>$/, "")
        .trim() || null;

    const director = body.match(DIRECTOR_RE)?.[1]?.trim() ?? null;
    const meta = body.match(META_RE)?.[1]
      ? stripHtml(body.match(META_RE)?.[1] ?? "")
          .replace(/\s+/g, " ")
          .trim()
      : null;
    const flag = body.match(FLAG_RE)?.[1]?.trim() ?? null;
    const img = body.match(IMG_RE)?.[1];

    const subtitleParts: string[] = [];
    if (originalTitle) subtitleParts.push(originalTitle);
    if (director) subtitleParts.push(`R: ${director}`);
    if (flag) subtitleParts.push(flag);

    if (seen.has(dataKey)) continue;
    seen.add(dataKey);

    events.push({
      source_event_id: dataKey,
      title,
      subtitle: subtitleParts.length ? subtitleParts.join(" · ") : null,
      description: meta,
      date,
      time,
      detail_url: href.startsWith("http") ? href : `${BASE}${href}`,
      ticket_url: null,
      image_url: img ? (img.startsWith("http") ? img : `${BASE}${img}`) : null,
      venue_room: venue,
      labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "nippon-connection", display_name: "Nippon Connection", events };
}

function parseGermanDate(s: string, year: number): string | null {
  // Sample: "Mi., 3. Juni 2026" — weekday optional, then day. month yr
  const m = s.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)\s*(\d{4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTHS_DE[m[2].toLowerCase()];
  const yr = parseInt(m[3], 10) || year;
  if (!month) return null;
  return `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
