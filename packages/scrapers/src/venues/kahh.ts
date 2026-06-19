import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const LIST_URL = "https://www.kahh.de/programm/";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const WRAPPER_RE = /<div\s+id="veranstaltung-(\d+)"[^>]*>([\s\S]*?)<div\s+class="kahh-kalender-chevron-wrapper">/g;
const DATE_RE = /<div\s+class="kahh-kalender-datum[^>]*>\s*(\d{1,2})\.(\d{1,2})\.\s*<\/div>/;
const TIME_ORT_RE = /<div\s+class="kahh-kalender-zeit-ort[^>]*>\s*([\s\S]*?)\s*<\/div>/;
const TITLE_RE = /<div\s+class="kahh-kalender-titel[^>]*>\s*([\s\S]*?)\s*<\/div>/;
const DESC_RE = /<div\s+class="kahh-kalender-content"[^>]*>([\s\S]*?)<\/div>/;
const URL_RE = /<a\s+href="(https:\/\/www\.kahh\.de\/programm\/veranstaltungen\/[^"]+)"/;

export async function scrapeKahh(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`kahh fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];

  // Events are chronological.
  let currentYear = new Date().getFullYear();
  let lastMonth = 0;

  for (const m of html.matchAll(WRAPPER_RE)) {
    const eventId = m[1];
    const block = m[2];

    const dateMatch = block.match(DATE_RE);
    if (!dateMatch) continue;

    const day = dateMatch[1].padStart(2, "0");
    const month = parseInt(dateMatch[2], 10);

    if (lastMonth > 0 && month < lastMonth) currentYear++;
    lastMonth = month;

    const date = `${currentYear}-${month.toString().padStart(2, "0")}-${day}`;
    if (date < today) continue;

    const title = stripHtml(decodeEntities(block.match(TITLE_RE)?.[1] ?? "")).trim();
    if (!title) continue;

    const timeOrtText = stripHtml(decodeEntities(block.match(TIME_ORT_RE)?.[1] ?? ""));
    const timeMatch = timeOrtText.match(/(\d{1,2})[.:](\d{2})\s*Uhr/);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

    const descriptionHtml = block.match(DESC_RE)?.[1] ?? "";
    const description = stripHtml(decodeEntities(descriptionHtml)).trim() || null;

    const urlMatch = block.match(URL_RE);
    const detailUrl = urlMatch ? urlMatch[1] : `${LIST_URL}#veranstaltung-${eventId}`;

    const type = classifyEvent(title, description);
    const mapped = type ? eventTypeToLabel(type) : null;
    const labels: ScrapedLabel[] = mapped
      ? [{ label: mapped, confidence: 0.8, classifier: "keyword:event" }]
      : [{ label: "talk:vortrag", confidence: 0.7, classifier: "scraper-hardcoded" }];

    events.push({
      source_event_id: `kahh-${eventId}`,
      title,
      description,
      date,
      time,
      end_date: null,
      end_time: null,
      detail_url: detailUrl,
      ticket_url: urlMatch ? detailUrl : null,
      image_url: null,
      raw_category: null,
      labels,
    });
  }

  return { source_slug: "kahh", display_name: "Katholische Akademie Hamburg", events };
}
