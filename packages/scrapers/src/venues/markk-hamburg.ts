import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * MARKK — Museum am Rothenbaum, Kulturen und Künste der Welt (ethnographic
 * museum, Rothenbaumchaussee). `/ausstellungen/` server-renders one
 * `exhibition_teaser` anchor per current exhibition, each headed by a
 * "bis <date>" run-out line; we emit those as `museum:ausstellung`, matching
 * the Hamburger Kunsthalle scraper.
 *
 * Events live in the `/kalender/` calendar (the old `/veranstaltungen/`
 * redirects there). It renders one month at a time and pages via a WordPress
 * admin-ajax action whose `date` is a Unix timestamp inside the wanted month.
 * The action is nonce-guarded (403 without it), so we lift `data-ajax-nonce`
 * off the calendar page and replay it — month 1 is the page we already have.
 */
const BASE = "https://markk-hamburg.de";
const AUSSTELLUNGEN_URL = `${BASE}/ausstellungen/`;
const KALENDER_URL = `${BASE}/kalender/`;
const AJAX_URL = `${BASE}/wp-admin/admin-ajax.php`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

/** Months of calendar to walk beyond the current one. The house publishes
 *  roughly a quarter ahead; the walk stops early once a month comes back empty. */
const CALENDAR_MONTHS = 6;

const MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

const EXHIBITION_RE =
  /<a href="(https:\/\/markk-hamburg\.de\/ausstellungen\/[^"]+)"[^>]*class="[^"]*\bexhibition_teaser\b[^"]*"[\s\S]*?<\/a>/g;
const CALENDAR_CARD_RE =
  /<a class="calendar_date[^"]*"[^>]*href="(https:\/\/markk-hamburg\.de\/date\/[^"]+)"[\s\S]*?(?=<a class="calendar_date|$)/g;
// The date slug ends in "-YYYY-MM-DD-HHMM", the only machine-readable datetime
// on the card — the visible line ("3. September – 19:00 Uhr") omits the year.
const SLUG_DATETIME_RE = /-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})\/?$/;

/** Calendar category line → museum:* label; anything else stays neutral. */
const CATEGORY_LABEL: Record<string, string> = {
  "öffentliche führung": "museum:fuehrung",
  "öffentliche veranstaltung": "museum:veranstaltung",
  sonderveranstaltung: "museum:veranstaltung",
  workshop: "museum:workshop",
  "kinder im museum": "museum:familie",
};

export async function scrapeMarkkHamburg(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  collectExhibitions(await fetchText(AUSSTELLUNGEN_URL), today, seen, events);

  const calendarHtml = await fetchText(KALENDER_URL);
  collectCalendarDates(calendarHtml, today, seen, events);

  const nonce = calendarHtml.match(/data-ajax-nonce="([^"]+)"/)?.[1];
  if (nonce) {
    const month = new Date(`${today}T12:00:00Z`);
    for (let ahead = 1; ahead <= CALENDAR_MONTHS; ahead++) {
      month.setUTCMonth(month.getUTCMonth() + 1);
      const before = events.length;
      collectCalendarDates(await fetchCalendarMonth(nonce, month), today, seen, events);
      if (events.length === before) break;
    }
  }

  return { source_slug: "markk", display_name: "MARKK – Museum am Rothenbaum", events };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`MARKK fetch failed: ${res.status} ${url}`);
  return res.text();
}

async function fetchCalendarMonth(nonce: string, month: Date): Promise<string> {
  const params = new URLSearchParams({
    action: "markk_render_calendar",
    ajax: "true",
    date: String(Math.floor(month.getTime() / 1000)),
    ajax_nonce: nonce,
    selected_term: "all",
    selected_language: "all",
    selected_exhibition: "all",
  });
  const res = await fetch(`${AJAX_URL}?${params}`, {
    headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest" },
  });
  // A rotated nonce or a month past the published programme answers non-200;
  // treat it as "nothing more to read" rather than failing the whole venue.
  return res.ok ? res.text() : "";
}

function collectExhibitions(html: string, today: string, seen: Set<string>, events: CanonicalScrapedEvent[]): void {
  for (const m of html.matchAll(EXHIBITION_RE)) {
    const detailUrl = decodeEntities(m[1]);
    const block = m[0];

    const title = cleanText(block.match(/class="content dib">([\s\S]*?)<\/span>/)?.[1]);
    if (!title) continue;

    const slug = detailUrl.match(/\/ausstellungen\/([^/]+)\//)?.[1] ?? slugify(title);
    const sourceEventId = `markk|exhibition|${slug}`;
    if (seen.has(sourceEventId)) continue;

    const { start, end } = parseDateRange(cleanText(block.match(/class="subheadline[^"]*">([\s\S]*?)<\/span>/)?.[1]));
    // Mirror the Kunsthalle rule: only scrape exhibitions with a real end date.
    if (!end || end < today) continue;
    seen.add(sourceEventId);

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle: null,
      description: cleanText(block.match(/id="exhibition-teaser-\d+-description"[^>]*>([\s\S]*?)<\/p>/)?.[1]),
      date: start ?? today,
      end_date: end,
      time: null,
      end_time: null,
      detail_url: detailUrl,
      image_url: block.match(/<img[^>]*\bsrc="([^"]+)"/)?.[1] ?? null,
      labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }
}

function collectCalendarDates(html: string, today: string, seen: Set<string>, events: CanonicalScrapedEvent[]): void {
  for (const m of html.matchAll(CALENDAR_CARD_RE)) {
    const detailUrl = decodeEntities(m[1]);
    const block = m[0];

    const stamp = detailUrl.match(SLUG_DATETIME_RE);
    if (!stamp) continue;
    const date = stamp[1];
    if (date < today) continue;

    const title = cleanText(block.match(/class="event_title[^"]*">([\s\S]*?)<\/span>/)?.[1]);
    if (!title) continue;

    const sourceEventId = `markk|event|${detailUrl.match(/\/date\/([^/]+)\//)?.[1] ?? `${date}|${title}`}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const category = cleanText(block.match(/class="event_category[^"]*">([\s\S]*?)<\/span>/)?.[1]);
    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle: cleanText(block.match(/id="calendar-date-\d+-subtitle"[^>]*>([\s\S]*?)<\/div>/)?.[1]),
      description: cleanText(block.match(/class="date_description_teaser[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1]),
      date,
      time: `${stamp[2]}:${stamp[3]}`,
      detail_url: detailUrl,
      image_url: block.match(/<img[^>]*\bsrc="([^"]+)"/)?.[1] ?? null,
      raw_category: category,
      labels: [
        {
          label: CATEGORY_LABEL[(category ?? "").toLowerCase()] ?? "museum:veranstaltung",
          confidence: 0.8,
          classifier: category ? "upstream-category" : "scraper-hardcoded",
        },
      ],
    });
  }
}

/** Parse the teaser run-out line: "bis 27. JUNI 2027", and the two-ended
 *  "5. Juni 2026 – 27. Juni 2027" / "3. Juli – 15. November 2026" forms. */
function parseDateRange(raw: string | null): { start: string | null; end: string | null } {
  if (!raw) return { start: null, end: null };
  const full = raw.match(/(\d{1,2})\.\s*([A-Za-zä]+)\s+(\d{4})\s*[–-]\s*(\d{1,2})\.\s*([A-Za-zä]+)\s+(\d{4})/);
  if (full) {
    return { start: iso(full[1], full[2], full[3]), end: iso(full[4], full[5], full[6]) };
  }
  const short = raw.match(/(\d{1,2})\.\s*([A-Za-zä]+)\s*[–-]\s*(\d{1,2})\.\s*([A-Za-zä]+)\s+(\d{4})/);
  if (short) {
    return { start: iso(short[1], short[2], short[5]), end: iso(short[3], short[4], short[5]) };
  }
  const until = raw.match(/bis\s+(\d{1,2})\.\s*([A-Za-zä]+)\s+(\d{4})/i);
  if (until) return { start: null, end: iso(until[1], until[2], until[3]) };
  return { start: null, end: null };
}

function iso(day: string, monthName: string, year: string): string | null {
  const month = MONTHS[monthName.toLowerCase()];
  return month ? `${year}-${month}-${day.padStart(2, "0")}` : null;
}

function cleanText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim() || null;
}
