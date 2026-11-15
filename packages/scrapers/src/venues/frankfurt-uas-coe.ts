import { decodeEntities, normalizeUrl, stripHtml, truncate } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Frankfurt UAS - Centre of Excellence / U!REKA network calendar
 * (goto.frankfurt-university.de/coe/events). It replaces the dead
 * www.frankfurt-university.de calendar behind `frankfurt-uas`.
 *
 * The site is TYPO3 (tx_news) with no JSON-LD, feed or API: the paginated list
 * only has title + date range, so every event's detail page is fetched for the
 * Location and the clock times. The list covers the whole network (Ostrava,
 * Ghent, Lisbon, online, ...) and reaches back to 2025; only items whose
 * Location names Frankfurt are kept, and events without a Location are dropped
 * because Frankfurt cannot be established for them.
 *
 * The site publishes no event type or category, so events carry no labels.
 * The one exception is the lecture series: its teaser is the organiser's own
 * type ("... Network Lecture Series") and its programme lists one `<h5>`
 * session per lecture, some held in a Frankfurt room while the series as a
 * whole is online. Those Frankfurt sessions become their own events.
 *
 * No wall-clock cutoff here: the list is emitted as published and the hub
 * handles past dates, which keeps two runs on one upstream state identical.
 * The list thumbnails are signed /securedl/ URLs that expire daily, so no
 * image_url is taken from them.
 */
const BASE = "https://goto.frankfurt-university.de";
const LIST_URL = `${BASE}/coe/events/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "en;q=0.9,de;q=0.5" };
const SLUG = "frankfurt-uas-coe";
const DETAIL_CONCURRENCY = 6;
const DESCRIPTION_MAX = 1200;

/** Coordinates looked up once by hand (Nominatim): Nibelungenplatz 1 and Kulturcampus Bockenheim. */
const CAMPUS: [number, number] = [50.1305335, 8.6923331];
const KULTURCAMPUS: [number, number] = [50.1174667, 8.6498444];

const LIST_ITEM_HREF_RE = /class="NewsItemEvent__link"\s+href="([^"]+)"/g;
const PAGE_COUNT_RE = /Page\s+1\s+of\s+(\d+)/;
const FACTS_RE = /NewsDetailEvent__facts">([\s\S]*?)NewsDetailEvent__interactive/;
const FACT_PAIR_RE = /<dt[^>]*>\s*([^<]*?)\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g;
const TIME_TAG_RE = /<time datetime="([^"]+)"/g;
const TITLE_RE = /<h1 class="NewsDetailEvent__heading">([\s\S]*?)<\/h1>/;
const NEWS_ID_RE = /tx_twfrauas_newsexport\[news\]=(\d+)/;
const REGISTER_RE = /<a href="([^"]+)"[^>]*class="NewsDetailEvent__register"/;
const TEASER_RE = /class="NewsItemEvent__teaser">([\s\S]*?)<\/div>/;
const CONTENT_RE = /class="NewsDetailEvent__content">([\s\S]*?)<!--TYPO3SEARCH_end-->/;
const SESSION_RE =
  /<h5>([\s\S]*?)<\/h5>\s*<p><strong>(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})\s*\(CES?T\)(?:&nbsp;|\s)*\(([\s\S]*?)\)\s*<\/strong><\/p>([\s\S]*?)(?=<h5>|$)/g;
const ROOM_RE = /Room(?:\s+number)?\s+([A-Za-z0-9.-]+)/i;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_RE = /^\d{2}:\d{2}$/;

const REMOTE_RE = /^(?:online|remote)\b/i;
const FRANKFURT_RE = /frankfurt|kulturcampus bockenheim/i;
const FRANKFURT_ODER_RE = /frankfurt\s*[/(]\s*oder/i;

const LECTURE_SERIES_RE = /lecture series/i;
const LECTURE_LABEL: ScrapedLabel = { label: "talk:vortrag", confidence: 0.85, classifier: "upstream-tag" };

interface ListEntry {
  url: string;
  teaser: string | null;
}

export async function scrapeFrankfurtUasCoe(): Promise<VenueScrapeResult> {
  const entries = await fetchListing();
  const details = await mapPool(entries, DETAIL_CONCURRENCY, (entry) => fetchHtml(entry.url));

  const events: CanonicalScrapedEvent[] = [];
  entries.forEach((entry, i) => events.push(...parseDetail(entry, details[i])));

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );
  return { source_slug: SLUG, display_name: "Frankfurt UAS - Centre of Excellence", events };
}

async function fetchListing(): Promise<ListEntry[]> {
  const first = await fetchHtml(LIST_URL);
  const pages = Number(first.match(PAGE_COUNT_RE)?.[1]);
  if (!pages) throw new Error(`${SLUG}: pagination ("Page 1 of N") not found, markup changed?`);

  const rest = await mapPool(
    Array.from({ length: pages - 1 }, (_, i) => i + 2),
    DETAIL_CONCURRENCY,
    (n) => fetchHtml(`${LIST_URL}?tx_news_pi1%5BcurrentPage%5D=${n}`),
  );

  const seen = new Set<string>();
  const entries: ListEntry[] = [];
  for (const html of [first, ...rest]) {
    const items = html.split('<li class="NewsList__item NewsList__item--event">').slice(1);
    for (const item of items) {
      const href = [...item.matchAll(LIST_ITEM_HREF_RE)][0]?.[1];
      if (!href) throw new Error(`${SLUG}: list item without a detail link, markup changed?`);
      const url = normalizeUrl(decodeEntities(href), BASE) as string;
      if (seen.has(url)) continue;
      seen.add(url);
      entries.push({ url, teaser: stripHtml(item.match(TEASER_RE)?.[1] ?? "") || null });
    }
  }
  if (entries.length === 0) throw new Error(`${SLUG}: no event items on the list pages, markup changed?`);
  return entries;
}

function parseDetail(entry: ListEntry, html: string): CanonicalScrapedEvent[] {
  const facts = html.match(FACTS_RE)?.[1];
  const title = stripQuotes(stripHtml(html.match(TITLE_RE)?.[1] ?? ""));
  if (!facts || !title) throw new Error(`${SLUG}: detail page ${entry.url} lost its title/facts block`);

  const pairs = new Map<string, string>();
  for (const [, key, value] of facts.matchAll(FACT_PAIR_RE)) pairs.set(key.toLowerCase(), value);

  const dateCell = pairs.get("date");
  if (!dateCell) throw new Error(`${SLUG}: detail page ${entry.url} has no Date fact`);
  const tokens = [...dateCell.matchAll(TIME_TAG_RE)].map((m) => m[1]);
  const dates = tokens.filter((t) => ISO_DATE_RE.test(t));
  const times = tokens.filter((t) => ISO_TIME_RE.test(t));
  if (dates.length === 0) throw new Error(`${SLUG}: detail page ${entry.url} has no parsable date`);

  const location = stripHtml(pairs.get("location") ?? "");
  const id = html.match(NEWS_ID_RE)?.[1] ?? entry.url.split("/").pop() ?? entry.url;
  const description = truncate(html.match(CONTENT_RE)?.[1] ?? "", DESCRIPTION_MAX);

  if (!isFrankfurt(location)) {
    return parseSessions(html, entry, title, id, location);
  }

  // 00:00 as the start is how the CMS stores "no time given"; its end (23:59, 23:03, ...) is equally meaningless.
  const timed = times[0] !== undefined && times[0] !== "00:00";
  const date = dates[0];
  const endDate = dates[1] && dates[1] !== date ? dates[1] : null;
  const [lat, lon] = /kulturcampus/i.test(location) ? KULTURCAMPUS : CAMPUS;

  return [
    {
      source_event_id: id,
      title,
      description,
      date,
      time: timed ? times[0] : null,
      end_date: endDate,
      end_time: timed && times[1] && (endDate || times[1] > times[0]) ? times[1] : null,
      detail_url: entry.url,
      ticket_url: normalizeUrl(decodeEntities(html.match(REGISTER_RE)?.[1] ?? ""), BASE),
      image_url: null,
      language: "en",
      venue_room: location,
      city: "frankfurt",
      lat,
      lon,
      raw_category: null,
      labels: [],
    },
  ];
}

/** Lecture-series sessions held (also) in Frankfurt, for series whose headline location is "online". */
function parseSessions(
  html: string,
  entry: ListEntry,
  seriesTitle: string,
  id: string,
  location: string,
): CanonicalScrapedEvent[] {
  if (!REMOTE_RE.test(location) || !entry.teaser || !LECTURE_SERIES_RE.test(entry.teaser)) return [];

  const events: CanonicalScrapedEvent[] = [];
  for (const m of html.matchAll(SESSION_RE)) {
    const [, rawTitle, dd, mm, yyyy, h1, m1, h2, m2, where, rest] = m;
    if (!FRANKFURT_RE.test(where) || REMOTE_RE.test(where)) continue;
    const date = `${yyyy}-${mm}-${dd}`;
    const room = where.match(ROOM_RE)?.[1];
    events.push({
      source_event_id: `${id}#${date}`,
      title: stripHtml(rawTitle),
      subtitle: seriesTitle,
      description: truncate(rest, DESCRIPTION_MAX),
      date,
      time: `${h1}:${m1}`,
      end_date: null,
      end_time: `${h2}:${m2}`,
      detail_url: entry.url,
      ticket_url: normalizeUrl(decodeEntities(html.match(REGISTER_RE)?.[1] ?? ""), BASE),
      image_url: null,
      language: "en",
      venue_room: room ? `Room ${room}` : "Frankfurt University of Applied Sciences",
      city: "frankfurt",
      lat: CAMPUS[0],
      lon: CAMPUS[1],
      raw_category: entry.teaser,
      labels: [LECTURE_LABEL],
    });
  }
  return events;
}

function isFrankfurt(location: string): boolean {
  return !!location && !REMOTE_RE.test(location) && !FRANKFURT_ODER_RE.test(location) && FRANKFURT_RE.test(location);
}

function stripQuotes(s: string): string {
  return s.replace(/^[»„"“‚'](.*)[«"”“’']$/, "$1").trim();
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${SLUG} fetch ${url} failed: ${res.status}`);
  return res.text();
}

/** Ordered concurrent map: results keep input order, so output never depends on response timing. */
async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}
