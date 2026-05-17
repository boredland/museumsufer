import { classifyMusic, classifyTalk, detectTalkLanguage, looksLikeMusic } from "@museumsufer/classify";
import { berlinNow, decodeEntities, normalizeUrl, nullIfMidnight, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.mousonturm.de";
const SPIELPLAN_URL = `${BASE}/de/programm/spielplan`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

/**
 * Walks Mousonturm's full spielplan (no category filter) and labels each
 * performance from its `entry-tag entry-tag--category` chips. The venue's
 * own taxonomy is finer than ours (Tanz, Theater, Performance, Konzert,
 * Lesung, Diskurs, Familie…), mapped to our prefix-namespaced labels.
 *
 * Performance-level rows are emitted as separate canonical events keyed on
 * (slug + date + time + room) — Mousonturm runs the same show across
 * multiple nights and rooms.
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

const GROUP_RE = /<div\s+class="calendar-group">([\s\S]*?)(?=<div\s+class="calendar-group">|<\/main\b|<footer\b)/g;
const GROUP_DATE_RE = /<h2\s+class="calendar-group__screenreader">\s*([^<]+?)\s*<\/h2>/i;
const ARTICLE_RE = /<article\s+class="calendar-entry\b[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
const TITLE_LINK_RE = /<h3\s+class="calendar-entry__title">\s*<a[^>]*href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i;
const TIME_RE = /<div\s+class="calendar-entry__time">\s*([\s\S]*?)\s*<\/div>/i;
const SUBTITLE_RE = /<div\s+class="calendar-entry__subtitle">\s*([\s\S]*?)\s*<\/div>/i;
const LOCATION_RE = /<span\s+class="calendar-entry__location">\s*([\s\S]*?)\s*<\/span>/i;
const TAG_RE = /<span[^>]*class="[^"]*entry-tag[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
const TICKET_RE = /<a\s+href="([^"]+)"[^>]*class="calendar-entry__tickt-button"/i;

export async function scrapeMousonturm(): Promise<VenueScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`mousonturm fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  let year = berlinNow().year();
  let prevMonth: number | null = null;

  for (const groupMatch of html.matchAll(GROUP_RE)) {
    const group = groupMatch[1];
    const dayLabel = group.match(GROUP_DATE_RE)?.[1];
    if (!dayLabel) continue;

    const parsedDay = parseDayLabel(dayLabel);
    if (!parsedDay) continue;
    if (prevMonth !== null && parsedDay.month < prevMonth - 6) year++;
    prevMonth = parsedDay.month;
    const date = `${year}-${String(parsedDay.month).padStart(2, "0")}-${String(parsedDay.day).padStart(2, "0")}`;
    if (date < today) continue;

    for (const articleMatch of group.matchAll(ARTICLE_RE)) {
      const article = articleMatch[0];
      const parsed = parseEntry(article, date);
      if (!parsed) continue;

      const dedup = `${parsed.source_event_id}|${parsed.date}|${parsed.time ?? ""}|${parsed.venue_room ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      events.push(parsed);
    }
  }

  return { source_slug: "mousonturm", display_name: "Künstler*innenhaus Mousonturm", events };
}

function parseEntry(article: string, date: string): CanonicalScrapedEvent | null {
  const titleMatch = article.match(TITLE_LINK_RE);
  if (!titleMatch) return null;
  const detailHref = decodeEntities(titleMatch[1]).replace(/\?back=1$/, "");
  const title = stripHtml(titleMatch[2]);
  if (!title) return null;

  const idMatch = detailHref.match(/\/veranstaltungen\/(\d+)\//);
  const sourceEventId = idMatch?.[1] ?? detailHref.replace(/[^a-z0-9]/gi, "-");

  const timeRaw = article.match(TIME_RE)?.[1] ?? "";
  const { time, endTime } = parseTime(timeRaw);

  const subtitle = stripHtml(article.match(SUBTITLE_RE)?.[1] ?? "") || null;
  const venueRoom = stripHtml(article.match(LOCATION_RE)?.[1] ?? "") || null;
  const ticketHref = article.match(TICKET_RE)?.[1];
  const ticketUrl = ticketHref ? decodeEntities(ticketHref) : null;
  const detailUrl = normalizeUrl(detailHref, BASE);

  const tags = Array.from(new Set([...article.matchAll(TAG_RE)].map((m) => stripHtml(m[1])).filter(Boolean)));
  const labels = labelsFromTags(tags, title, subtitle);

  return {
    source_event_id: sourceEventId,
    title,
    subtitle,
    description: subtitle,
    date,
    time,
    end_time: endTime,
    detail_url: detailUrl,
    ticket_url: ticketUrl,
    image_url: null,
    language: detectTalkLanguage(title, subtitle),
    price_min: null,
    price_max: null,
    performers: null,
    venue_room: venueRoom,
    raw_category: tags.join(" · ") || null,
    labels,
  };
}

function labelsFromTags(tags: readonly string[], title: string, subtitle: string | null): ScrapedLabel[] {
  const haystack = `${tags.join(" ")} ${title} ${subtitle ?? ""}`.toLowerCase();
  const labels: ScrapedLabel[] = [];

  if (/konzert|musik/.test(haystack) || looksLikeMusic(title, subtitle)) {
    labels.push({
      label: `music:${classifyMusic(title, subtitle, null, "experimental")}`,
      confidence: 0.95,
      classifier: "upstream-tag",
    });
  }
  if (/lesung|buchpräsentation|buchvorstellung|diskurs|diskussion|gespräch|podium|debatte/.test(haystack)) {
    labels.push({
      label: `talk:${classifyTalk(title, subtitle).toLowerCase()}`,
      confidence: 0.95,
      classifier: "upstream-tag",
    });
  }
  if (/tanz|performance/.test(haystack)) {
    labels.push({ label: "stage:dance", confidence: 0.9, classifier: "upstream-tag" });
  }
  if (/theater|schauspiel/.test(haystack)) {
    labels.push({ label: "stage:theater", confidence: 0.9, classifier: "upstream-tag" });
  }
  if (/familie|kinder/.test(haystack)) {
    labels.push({ label: "museum:familie", confidence: 0.85, classifier: "upstream-tag" });
  }
  return labels;
}

function parseDayLabel(label: string): { month: number; day: number } | null {
  const m = label.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = GERMAN_MONTHS[m[2]];
  if (!month) return null;
  return { month, day };
}

function parseTime(raw: string): { time: string | null; endTime: string | null } {
  const txt = stripHtml(raw).replace(/\s+/g, " ");
  const m = txt.match(/(\d{1,2}):(\d{2})(?:\s*[–-]\s*(\d{1,2}):(\d{2}))?\s*Uhr/);
  if (!m) return { time: null, endTime: null };
  const start = nullIfMidnight(`${m[1].padStart(2, "0")}:${m[2]}`);
  const end = m[3] ? nullIfMidnight(`${m[3].padStart(2, "0")}:${m[4]}`) : null;
  return { time: start, endTime: end };
}
