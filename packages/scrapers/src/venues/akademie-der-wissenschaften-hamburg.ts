import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Akademie der Wissenschaften in Hamburg — TYPO3 custom event list
 * URL: https://www.awhamburg.de/veranstaltungen/aktuelle-termine.html
 *
 * Events rendered server-side; each event is a <div class="event-list-item">.
 * Date/time extracted from the <div class="event-homepage-item__location-date">
 * block which contains "Montag, 22. Juni 2026<br> um 09:15".
 */
const BASE = "https://www.awhamburg.de";
const LIST_URL = `${BASE}/veranstaltungen/aktuelle-termine.html`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const BLOCK_RE = /<div\s+class="event-list-item">([\s\S]*?)(?=<div\s+class="event-list-item"|<\/main>)/g;

const TITLE_RE = /<div\s+class="event-list-item__title[^"]*">\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
const DATE_RE =
  /(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*(\d{4})/;
const TIME_RE = /um\s+(\d{1,2}):(\d{2})/;
const TEASER_RE = /<div\s+class="event-list-item__teaser">\s*([\s\S]*?)\s*<\/div>/;

const MONTH_MAP: Record<string, string> = {
  Januar: "01",
  Februar: "02",
  März: "03",
  April: "04",
  Mai: "05",
  Juni: "06",
  Juli: "07",
  August: "08",
  September: "09",
  Oktober: "10",
  November: "11",
  Dezember: "12",
};

export async function scrapeAkademieWissenschaftenHamburg(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`awhamburg fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(BLOCK_RE)) {
    const block = m[1];

    const titleMatch = block.match(TITLE_RE);
    if (!titleMatch) continue;

    const href = titleMatch[1];
    const title = stripHtml(decodeEntities(titleMatch[2])).trim();
    if (!title) continue;

    const slug = href.split("/").filter(Boolean).pop() ?? title;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const dateMatch = block.match(DATE_RE);
    if (!dateMatch) continue;

    const day = dateMatch[1].padStart(2, "0");
    const month = MONTH_MAP[dateMatch[2]];
    const year = dateMatch[3];
    const date = `${year}-${month}-${day}`;
    if (date < today) continue;

    const timeMatch = block.match(TIME_RE);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

    const teaserRaw = block.match(TEASER_RE)?.[1] ?? "";
    const description = stripHtml(decodeEntities(teaserRaw)).trim() || null;

    const detailUrl = href.startsWith("http") ? href : `${BASE}${href}`;

    events.push({
      source_event_id: slug,
      title,
      description,
      date,
      time,
      end_date: null,
      end_time: null,
      detail_url: detailUrl,
      ticket_url: null,
      image_url: null,
      raw_category: null,
      labels: [{ label: "talk:vortrag", confidence: 0.7, classifier: "scraper-hardcoded" }],
    });
  }

  return {
    source_slug: "akademie-der-wissenschaften-hamburg",
    display_name: "Akademie der Wissenschaften in Hamburg",
    events,
  };
}
