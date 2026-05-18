import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.murnau-stiftung.de";
const LISTING_URL = `${BASE}/filmtheater`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const ROW_RE = /<div class="views-row">([\s\S]*?)(?=<div class="views-row">|<\/div>\s*<\/div>\s*<\/div>\s*<nav)/g;
const DATE_RE =
  /views-field-field-cinema-show-date[\s\S]*?<div class="field-content">\s*([A-ZÄÖÜa-zäöü]{2,3}\.?\s*)?(\d{1,2})\.(\d{1,2})\.(\d{4})/;
const TIME_RE = /views-field-field-cinema-show-date-1[\s\S]*?<span class="field-content">\s*(\d{1,2}:\d{2})/;
const MOVIE_RE = /views-field-field-cinema-show-movie[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
const SERIES_RE = /views-field-field-cinema-movie-series[\s\S]*?<a href="[^"]+"[^>]*>([\s\S]*?)<\/a>/;
const IMG_RE = /views-field-field-cinema-movie-img[\s\S]*?<img[^>]+src="([^"]+)"/;
const TICKET_RE = /views-field-field-dd-cinema-show-ticket[\s\S]*?<a href="([^"]+)"/;

/**
 * Friedrich-Wilhelm-Murnau-Stiftung's Wiesbaden archive cinema. The
 * /filmtheater page is rendered by Drupal Views with stable CSS class
 * names (views-field-field-cinema-show-date etc.) — each views-row is
 * one screening with date, time, movie title, optional series, and a
 * cinetixx ticket URL.
 */
export async function scrapeMurnauFilmtheater(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(LISTING_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`murnau fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  for (const m of html.matchAll(ROW_RE)) {
    const row = m[1];

    const dateMatch = row.match(DATE_RE);
    const timeMatch = row.match(TIME_RE);
    const movieMatch = row.match(MOVIE_RE);
    if (!dateMatch || !movieMatch) continue;

    const [, , day, month, year] = dateMatch;
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (date < today) continue;

    const time = timeMatch ? timeMatch[1] : null;
    const detailPath = movieMatch[1];
    const title = stripHtml(movieMatch[2]).trim();
    if (!title) continue;

    const series = row.match(SERIES_RE)?.[1];
    const subtitle = series ? stripHtml(series).trim() : null;
    const img = row.match(IMG_RE)?.[1];
    const ticket = row.match(TICKET_RE)?.[1];

    events.push({
      source_event_id: `${detailPath}|${date}|${time ?? ""}`,
      title,
      subtitle,
      date,
      time,
      detail_url: detailPath.startsWith("http") ? detailPath : `${BASE}${detailPath}`,
      ticket_url: ticket ?? null,
      image_url: img ? (img.startsWith("http") ? img : `${BASE}${img}`) : null,
      raw_category: subtitle,
      labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "murnau-filmtheater", display_name: "Murnau-Filmtheater Wiesbaden", events };
}
