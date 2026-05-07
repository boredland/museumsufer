import { berlinNow, todayIso } from "../date";
import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml } from "../shared";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://www.mousonturm.de";
const SPIELPLAN_URL = `${BASE}/de/programm/spielplan`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Mousonturm groups its spielplan by day under
 * `<div class="calendar-group">` with a screen-reader heading like
 * "Donnerstag, 07. Mai" — no year, but groups appear in chronological
 * order so we walk them with a rolling year cursor. Each
 * `<article class="calendar-entry">` carries title, single or
 * range start time, location (room), Reservix ticket link, and a
 * `calendar-entry--disabled` modifier when the performance is cancelled.
 */

const GERMAN_MONTHS: Record<string, number> = {
  Januar: 1,
  Februar: 2,
  März: 3,
  April: 4,
  Mai: 5,
  Juni: 6,
  Juli: 7,
  August: 8,
  September: 9,
  Oktober: 10,
  November: 11,
  Dezember: 12,
};

export async function scrapeMousonturm(): Promise<ScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`Mousonturm spielplan fetch failed: ${res.status}`);
  const html = await res.text();
  return parseMousonturmHtml(html);
}

const GROUP_RE = /<div\s+class="calendar-group">([\s\S]*?)(?=<div\s+class="calendar-group">|<\/main\b|<footer\b)/g;
const GROUP_DATE_RE = /<h2\s+class="calendar-group__screenreader">\s*([^<]+?)\s*<\/h2>/i;
const ARTICLE_RE = /<article\s+class="calendar-entry\b[^"]*"[^>]*>([\s\S]*?)<\/article>/g;

export function parseMousonturmHtml(html: string): ScrapeResult {
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  let year = berlinNow().year();
  let prevMonth: number | null = null;

  for (const groupMatch of html.matchAll(GROUP_RE)) {
    const group = groupMatch[1];
    const dayLabel = group.match(GROUP_DATE_RE)?.[1];
    if (!dayLabel) continue;

    const parsed = parseDayLabel(dayLabel);
    if (!parsed) continue;
    const { month, day } = parsed;

    if (prevMonth !== null && month < prevMonth - 6) year++;
    prevMonth = month;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date < today) continue;

    for (const articleMatch of group.matchAll(ARTICLE_RE)) {
      const article = articleMatch[0];
      const innerBlock = articleMatch[1];
      const event = parseArticle(article, innerBlock);
      if (!event) continue;

      const dedup = `${event.show.slug}|${date}|${event.perf.time ?? ""}|${event.perf.venue_room ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      if (!showsBySlug.has(event.show.slug)) showsBySlug.set(event.show.slug, event.show);
      performances.push({ ...event.perf, show_slug: event.show.slug, date });
    }
  }

  return {
    theater_slug: "mousonturm",
    shows: [...showsBySlug.values()],
    performances,
  };
}

function parseDayLabel(label: string): { month: number; day: number } | null {
  // "Donnerstag, 07. Mai"
  const m = label.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = GERMAN_MONTHS[m[2]];
  if (!month) return null;
  return { month, day };
}

interface ParsedArticle {
  show: ScrapedShow;
  perf: Omit<ScrapedPerformance, "show_slug" | "date">;
}

function parseArticle(article: string, _inner: string): ParsedArticle | null {
  const titleMatch = article.match(
    /<h3\s+class="calendar-entry__title">\s*<a[^>]*href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i,
  );
  if (!titleMatch) return null;
  const detailHref = decodeEntities(titleMatch[1]).replace(/\?back=1$/, "");
  const title = stripHtml(titleMatch[2]);
  if (!title) return null;

  const idMatch = detailHref.match(/\/veranstaltungen\/(\d+)\//);
  const providerEventId = idMatch?.[1] ?? null;

  const timeRaw = article.match(/<div\s+class="calendar-entry__time">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "";
  const { time, endTime } = parseTime(timeRaw);

  const subtitle =
    stripHtml(article.match(/<div\s+class="calendar-entry__subtitle">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "") || null;
  const venueRoom =
    stripHtml(article.match(/<span\s+class="calendar-entry__location">\s*([\s\S]*?)\s*<\/span>/i)?.[1] ?? "") || null;

  // Reservix or other ticket link inside the entry's footer
  const ticketHref = article.match(/<a\s+href="([^"]+)"[^>]*class="calendar-entry__tickt-button"/i)?.[1];
  const ticketUrl = ticketHref ? decodeEntities(ticketHref) : null;

  const isCancelled =
    /\bcalendar-entry--disabled\b/.test(article) ||
    /<div\s+class="article-event__button">\s*<span>\s*Entfällt\s*<\/span>/i.test(article);
  const status = isCancelled ? "cancelled" : ticketUrl ? "available" : "unknown";

  const slug = slugify(title);
  const detailUrl = normalizeUrl(detailHref, BASE);

  return {
    show: {
      slug,
      title,
      subtitle,
      description: subtitle,
      detail_url: detailUrl,
      image_url: null,
    },
    perf: {
      time,
      end_time: endTime,
      venue_room: venueRoom,
      provider_event_id: providerEventId,
      ticket_url: ticketUrl,
      status,
    },
  };
}

function parseTime(raw: string): { time: string | null; endTime: string | null } {
  const txt = stripHtml(raw).replace(/\s+/g, " ");
  // "20:00 Uhr"  or  "16:30 – 18:30 Uhr"
  const m = txt.match(/(\d{1,2}):(\d{2})(?:\s*[–-]\s*(\d{1,2}):(\d{2}))?\s*Uhr/);
  if (!m) return { time: null, endTime: null };
  const start = nullIfMidnight(`${m[1].padStart(2, "0")}:${m[2]}`);
  const end = m[3] ? nullIfMidnight(`${m[3].padStart(2, "0")}:${m[4]}`) : null;
  return { time: start, endTime: end };
}
