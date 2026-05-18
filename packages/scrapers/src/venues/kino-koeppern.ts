import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.kinokoeppern.de";
const LISTING_URL = `${BASE}/`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const FILM_RE = /<article class="film">([\s\S]*?)<\/article>/g;
const TITLE_RE = /<h3>([^<]+)<\/h3>/;
const POSTER_RE = /<img class=\s*film-poster[^>]+src="([^"]+)"/;
const POSTER_LINK_RE = /<a[^>]+class="poster-link"[^>]+href="([^"]+)"/;
const SHOWTIME_RE = /<li>\s*([A-Za-zäöüÄÖÜ]{2,3})\.?\s*(\d{1,2})\.(\d{1,2})\.?,?\s*(\d{1,2}):(\d{2})\s*Uhr\s*<\/li>/g;
const RUNTIME_RE = /Laufzeit:\s*(\d+)\s*Min/;

/**
 * Family-run traditional Programmkino in Friedrichsdorf-Köppern. Homepage
 * renders each film as <article class="film"> with a <ul class="playtime">
 * listing every screening. Year is missing from the German shorthand
 * dates — we infer from today.
 */
export async function scrapeKinoKoeppern(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(LISTING_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`kinokoeppern fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  for (const fm of html.matchAll(FILM_RE)) {
    const block = fm[1];
    const titleMatch = block.match(TITLE_RE);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    const poster = block.match(POSTER_RE)?.[1];
    const externalLink = block.match(POSTER_LINK_RE)?.[1];
    const runtime = block.match(RUNTIME_RE)?.[1];

    const subtitle = runtime ? `${runtime} min` : null;

    for (const sm of block.matchAll(SHOWTIME_RE)) {
      const [, , day, month, hh, mm] = sm;
      const year = inferYear(parseInt(month, 10), today);
      const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      if (date < today) continue;
      const time = `${hh.padStart(2, "0")}:${mm}`;

      events.push({
        source_event_id: `${title}|${date}|${time}`,
        title,
        subtitle,
        date,
        time,
        detail_url: externalLink ?? LISTING_URL,
        image_url: poster ? (poster.startsWith("http") ? poster : `${BASE}/${poster.replace(/^\.\//, "")}`) : null,
        labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
      });
    }
  }

  return { source_slug: "kino-koeppern", display_name: "Filmtheater Friedrichsdorf-Köppern", events };
}

function inferYear(month: number, today: string): number {
  const currentYear = parseInt(today.slice(0, 4), 10);
  const currentMonth = parseInt(today.slice(5, 7), 10);
  return month < currentMonth ? currentYear + 1 : currentYear;
}
