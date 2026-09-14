import { classifyMusic } from "@museumsufer/classify";
import { decodeEntities, GERMAN_MONTHS, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Musikschule Frankfurt (Städtische Musikschule). The site was relaunched onto
 * ProcessWire: the old TYPO3 `?article_id=130` accordion is gone (that URL now
 * serves a generic landing page with no dates at all) and the programme lives
 * at /events-termine/ as one card per event:
 *
 *   <div class="event unveil-item …">
 *     <a href="/veranstaltung/klassenvorspiel-10/" …>
 *       <h4>Klassenvorspiel Kontrabass</h4>
 *       <p><strong>Sonntag, 13. September, <nobr>11:00 Uhr</nobr></strong></p>
 *       <div class="truncate"><p>&gt; Musikschule Zentrale, Space<br>…</p></div>
 *       <img src="/site/assets/files/…jpg">
 *
 * An Alpine `events: [...]` array alongside the cards carries each event's
 * category and month labels ("September 2026"), in card order. The cards are
 * fully server-rendered, so the array is only needed for the category and the
 * year: card dates are year-less, and its first month label is the event's
 * start month — which also disambiguates spans that cross a month or a
 * year boundary ("Mittwoch, 23. Dezember - Dienstag, 12. Januar").
 *
 * Non-public entries (school holidays, teacher-only Fortbildungen) come tagged
 * as "Unterrichtsfreie Tage" and are dropped; everything else is a concert,
 * workshop or info evening the public can attend.
 */

const LIST_URL = "https://www.musikschule-frankfurt.de/events-termine/";
const SITE_BASE = "https://www.musikschule-frankfurt.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const CARD_RE = /<div class="event unveil-item[\s\S]{0,3000}?<\/a>/g;
const TITLE_RE = /<h4>([\s\S]*?)<\/h4>/;
const WHEN_RE = /<p><strong>([\s\S]*?)<\/strong><\/p>/;
const HREF_RE = /href="([^"]+)"/;
const IMAGE_RE = /<img src="([^"]+)"/;
const BODY_RE = /<div class="truncate">([\s\S]*?)<\/div>/;
/** Leading "Sonntag, 13. September" — weekday, day, year-less month. A span's
 *  trailing half is ignored: the hub keeps the start, and the start month comes
 *  from the Alpine label. */
const WHEN_DAY_RE = /(\d{1,2})\.\s*(?:[–-]\s*\d{1,2}\.)?\s*([A-Za-zäöü]+)?/;
/** First "HH:MM" is the start; a second one on the same card is the end time
 *  ("18:00 - 19:30 Uhr"). */
const WHEN_TIME_RE = /(\d{1,2}):(\d{2})/g;

/** Entries that are not public events: closure notices and teacher-only dates. */
const NON_PUBLIC_CATEGORIES = new Set(["Unterrichtsfreie Tage"]);

export async function scrapeMusikschuleFrankfurt(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`musikschule-frankfurt fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const categories = parseCategories(html);
  const startMonths = parseStartMonths(html);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const [i, m] of [...html.matchAll(CARD_RE)].entries()) {
    const card = m[0];
    const title = cleanInline(card.match(TITLE_RE)?.[1] ?? "");
    if (!title) continue;

    const category = categories[i] ?? null;
    if (category && NON_PUBLIC_CATEGORIES.has(category)) continue;

    const when = cleanInline(card.match(WHEN_RE)?.[1] ?? "");
    const parsed = parseWhen(when, startMonths[i]);
    if (!parsed) continue;
    if (parsed.date < today) continue;

    const href = card.match(HREF_RE)?.[1];
    const detailUrl = href ? (href.startsWith("http") ? href : `${SITE_BASE}${href}`) : LIST_URL;
    const image = card.match(IMAGE_RE)?.[1];
    const body = cleanInline(card.match(BODY_RE)?.[1] ?? "");
    const description = body.length > 4 ? body.slice(0, 400) : null;

    // The detail slug is per-event and stable; the date qualifies the recurring
    // formats (Vorspielwerkstatt, Klassenvorspiel) that share one page.
    const sourceEventId = `${slugify(href ?? title)}|${parsed.date}|${parsed.time}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    events.push({
      source_event_id: sourceEventId,
      title,
      description,
      date: parsed.date,
      time: parsed.time,
      end_time: parsed.endTime,
      detail_url: detailUrl,
      ticket_url: null,
      image_url: image ? (image.startsWith("http") ? image : `${SITE_BASE}${image}`) : null,
      raw_category: category,
      labels: labelsFor(title, description, category),
    });
  }

  return { source_slug: "musikschule-frankfurt", display_name: "Städtische Musikschule Frankfurt", events };
}

/** Per-card categories from the Alpine `events: [...]` array, in card order.
 *  The trailing entry is the filter widget's own "Alle Kategorien" row. */
function parseCategories(html: string): Array<string | null> {
  const start = html.indexOf("events: [");
  if (start === -1) return [];
  return [...html.slice(start).matchAll(/cats: \[([\s\S]*?)\]/g)].map((m) => {
    const first = m[1].match(/'((?:[^']|\\')+)'/)?.[1];
    return first && first !== "Alle Kategorien" ? decodeEntities(first) : null;
  });
}

interface ParsedWhen {
  date: string;
  time: string | null;
  endTime: string | null;
}

function parseWhen(text: string, startMonth: StartMonth | undefined): ParsedWhen | null {
  if (!startMonth) return null;
  const day = text.match(WHEN_DAY_RE)?.[1];
  if (!day) return null;
  const dd = day.padStart(2, "0");
  const date = `${startMonth.year}-${startMonth.month}-${dd}`;

  const times = [...text.matchAll(WHEN_TIME_RE)];
  const start = times[0];
  // Whole-day entries (holiday spans, application deadlines) advertise 00:00.
  const time = !start || (start[1] === "00" && start[2] === "00") ? null : `${start[1].padStart(2, "0")}:${start[2]}`;
  const end = times[1];
  const endTime = time && end ? `${end[1].padStart(2, "0")}:${end[2]}` : null;
  return { date, time, endTime };
}

interface StartMonth {
  year: string;
  month: string;
}

/** Each card's first Alpine month label ("September 2026") → year + month. */
function parseStartMonths(html: string): Array<StartMonth | undefined> {
  const start = html.indexOf("events: [");
  if (start === -1) return [];
  return [...html.slice(start).matchAll(/months: \[([\s\S]*?)\]/g)].map((m) => {
    for (const label of m[1].matchAll(/'([A-Za-zäöü]+) (20\d\d)'/g)) {
      const month = GERMAN_MONTHS[label[1].toLowerCase()];
      if (month) return { year: label[2], month: String(month).padStart(2, "0") };
    }
    return undefined;
  });
}

function labelsFor(title: string, description: string | null, category: string | null): ScrapedLabel[] {
  if (category === "Workshop") {
    return [{ label: "museum:workshop", confidence: 1.0, classifier: "upstream-category" }];
  }
  if (category === "Info-Veranstaltung") {
    return [{ label: "talk:vortrag", confidence: 1.0, classifier: "upstream-category" }];
  }
  const genre = classifyMusic(title, null, description, "classical");
  return [
    {
      label: `music:${genre}`,
      confidence: category === "Konzert" ? 1.0 : 0.9,
      classifier: category === "Konzert" ? "upstream-category" : "scraper-hardcoded",
    },
  ];
}

function cleanInline(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
