import { classifyTalk, detectTalkLanguage } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, normalizeUrl, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.sigmund-freud-institut.de";
const LIST_URL = `${BASE}/aktuelles/veranstaltungen`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

/** The TYPO3 agenda prints the month as an English three-letter abbreviation. */
const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

const ITEM_RE = /<div class="agenda-item">([\s\S]*?)<\/a>\s*<\/div>/g;

/**
 * Sigmund-Freud-Institut — lectures, symposia and reading series. The site moved
 * from WordPress to TYPO3, so there is no REST feed any more: the agenda page lists
 * upcoming events and, below "Vergangene Veranstaltungen", past ones in the same
 * markup. Each item carries day / month / 2-digit year / optional time inline.
 */
export async function scrapeSigmundFreudInstitut(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`sigmund-freud-institut fetch failed: ${res.status}`);
  const html = await res.text();

  const items = [...html.matchAll(ITEM_RE)];
  if (items.length === 0) throw new Error("sigmund-freud-institut: no agenda items found (markup changed?)");

  const events: CanonicalScrapedEvent[] = [];
  for (const [, body] of items) {
    const day = body.match(/class="day">\s*(\d{1,2})/)?.[1];
    const month = MONTHS[(body.match(/class="month">\s*([A-Za-z]+)/)?.[1] ?? "").toLowerCase()];
    const year = body.match(/class="year">\s*(\d{2})\b/)?.[1];
    const href = body.match(/href="([^"]+)"/)?.[1];
    const title = stripHtml(body.match(/<h3 class="agenda-title">([\s\S]*?)<\/h3>/)?.[1] ?? "");
    if (!day || !month || !year || !href || !title) continue;

    const date = `20${year}-${month}-${day.padStart(2, "0")}`;
    if (date < today) continue;

    const time = body.match(/class="time">\s*(\d{1,2}:\d{2})/)?.[1] ?? null;
    const place = stripHtml(body.match(/<p class="agenda-meta[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? "");
    const teaser = stripHtml(body.match(/<p class="agenda-teaser">([\s\S]*?)<\/p>/)?.[1] ?? "");
    const description = teaser ? decodeEntities(teaser) : null;

    events.push({
      source_event_id: decodeEntities(href).replace(/\/+$/, "").split("/").pop() ?? href,
      title,
      description,
      date,
      time: time ? time.padStart(5, "0") : null,
      detail_url: normalizeUrl(decodeEntities(href), BASE),
      venue_room: place || null,
      language: detectTalkLanguage(title, description),
      labels: [
        {
          label: `talk:${classifyTalk(title, description).toLowerCase()}`,
          confidence: 0.9,
          classifier: "upstream-category",
        },
      ],
    });
  }

  return { source_slug: "sigmund-freud-institut", display_name: "Sigmund-Freud-Institut Frankfurt", events };
}
