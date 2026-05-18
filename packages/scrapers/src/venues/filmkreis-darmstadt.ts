import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://filmkreis.de";
const LISTING_URL = `${BASE}/programm/aktuell`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const CARD_RE =
  /<a class="movielink" href="(programm\/vorstellung\/(\d+)[^"]+)"[\s\S]*?<span class="Sdate">\s*([\s\S]*?)<\/span>[\s\S]*?<span class="Svenue">([\s\S]*?)<\/span>[\s\S]*?<span class="Stime">\s*([\s\S]*?)<\/span>[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<span class="StitleTitle">([\s\S]*?)<\/span>(?:[\s\S]*?<span class="StitleLang">([\s\S]*?)<\/span>)?/g;

const DATE_RE = /([A-Za-zäöüÄÖÜ]{2,4})\.?\s*(\d{1,2})\.(\d{1,2})/;

/**
 * Studentischer Filmkreis Darmstadt e.V. — student-run cinema at the TU
 * Audimax + cooperation screenings at programmkino rex. Listing page has
 * clean per-screening cards with .Sdate / .Stime / .Svenue / .StitleTitle.
 */
export async function scrapeFilmkreisDarmstadt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(LISTING_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`filmkreis fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  for (const m of html.matchAll(CARD_RE)) {
    const [, path, vorstellungId, sdateHtml, svenueHtml, stimeHtml, imgSrc, titleHtml, langHtml] = m;

    const sdate = stripHtml(sdateHtml).trim();
    const dateMatch = sdate.match(DATE_RE);
    if (!dateMatch) continue;
    const [, , day, month] = dateMatch;

    // Year missing in source — infer from today, rolling forward if the
    // parsed month is earlier than the current month.
    const year = inferYear(parseInt(month, 10), today);
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (date < today) continue;

    const time = stripHtml(stimeHtml).match(/(\d{1,2}):(\d{2})/);
    const timeStr = time ? `${time[1].padStart(2, "0")}:${time[2]}` : null;

    const venue = stripHtml(svenueHtml).trim() || null;
    const lang = langHtml
      ? stripHtml(langHtml)
          .trim()
          .replace(/^\(|\)$/g, "")
      : null;
    const title = stripHtml(titleHtml).trim();
    if (!title) continue;

    events.push({
      source_event_id: vorstellungId,
      title,
      subtitle: lang || null,
      date,
      time: timeStr,
      detail_url: `${BASE}/${path}`,
      image_url: imgSrc.startsWith("http") ? imgSrc : `${BASE}${imgSrc}`,
      venue_room: venue,
      labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "filmkreis-darmstadt", display_name: "Studentischer Filmkreis Darmstadt", events };
}

function inferYear(month: number, today: string): number {
  const currentYear = parseInt(today.slice(0, 4), 10);
  const currentMonth = parseInt(today.slice(5, 7), 10);
  return month < currentMonth ? currentYear + 1 : currentYear;
}
