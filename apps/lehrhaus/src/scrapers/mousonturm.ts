import { detectTalkLanguage } from "@museumsufer/core/classify";
import { todayIso } from "@museumsufer/core/date";
import type { Category, ScrapedEvent } from "../types";

/**
 * Mousonturm has a built-in "Lesung & Diskurs" category (filter id 12934)
 * that already separates lectures and discussions from the theatre/dance/
 * music programme. We hit that filtered Spielplan view and parse the
 * server-rendered list — Mousonturm uses jQuery-era PHP, not a client-side
 * SPA, so events are in the initial HTML response.
 *
 * Structure:
 *   <div class="calendar-month-wrapper" data-month="2026-09">
 *     <h2 class="calendar-group__screenreader">Dienstag, 22. September</h2>
 *     <article class="calendar-entry" data-href="/de/programm/veranstaltungen/15890/...">
 *       <div class="calendar-entry__time">20:00 Uhr</div>
 *       <h3 class="calendar-entry__title"><a>Title</a></h3>
 *       <span class="entry-tag entry-tag--category">Lesung</span>
 *       <span class="calendar-entry__location">Mousonturm Saal</span>
 *     </article>
 *
 * We use the German URL (`/de/`) — the English version uses "8 pm" times
 * which is annoying to parse; the German one is `20:00 Uhr`.
 */

const LISTING_URL = "https://www.mousonturm.de/de/programm/spielplan/?k[]=12934";
const ORIGIN = "https://www.mousonturm.de";
const UA = "lehrhaus crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

const MONTHS_DE: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

const MONTH_WRAPPER_RE =
  /<div[^>]*class="[^"]*calendar-month-wrapper[^"]*"[^>]*data-month="(20\d{2}-\d{2})"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*calendar-month-wrapper|<\/main|<\/section)/g;
const DAY_HEADER_RE = /<h2[^>]*class="[^"]*calendar-group__screenreader[^"]*"[^>]*>\s*([^<]+?)\s*<\/h2>/g;
const ENTRY_RE = /<article[^>]*class="[^"]*calendar-entry[^"]*"[\s\S]*?<\/article>/g;
const TIME_RE = /<div[^>]*class="[^"]*calendar-entry__time[^"]*"[^>]*>([\s\S]*?)<\/div>/;
const TITLE_RE = /<h3[^>]*class="[^"]*calendar-entry__title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/;
const HREF_RE = /data-href="([^"]+)"/;
const LOCATION_RE = /<span[^>]*class="[^"]*calendar-entry__location[^"]*"[^>]*>([\s\S]*?)<\/span>/;
const TAG_RE = /<span[^>]*class="[^"]*entry-tag[^"]*"[^>]*>([\s\S]*?)<\/span>/g;

export async function scrapeMousonturm(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml(LISTING_URL);
  const today = todayIso();
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const monthMatch of html.matchAll(MONTH_WRAPPER_RE)) {
    const yearMonth = monthMatch[1]; // "2026-09"
    const block = monthMatch[2];
    const [yearStr] = yearMonth.split("-");
    const year = parseInt(yearStr, 10);

    // Split the month block by day-headers so each <article> gets paired
    // with the day-of-month parsed from its preceding <h2>.
    const dayPositions: Array<{ idx: number; day: number }> = [];
    for (const dh of block.matchAll(DAY_HEADER_RE)) {
      const text = dh[1].replace(/\s+/g, " ").trim();
      // "Dienstag, 22. September" → 22
      const dm = text.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)/);
      if (!dm) continue;
      const day = parseInt(dm[1], 10);
      const monthName = dm[2].toLowerCase();
      // Sanity-check that the named month matches data-month; otherwise the
      // group spans a month boundary and we skip rather than mis-date.
      const namedMonth = MONTHS_DE[monthName];
      if (!namedMonth || namedMonth !== parseInt(yearMonth.split("-")[1], 10)) continue;
      dayPositions.push({ idx: dh.index!, day });
    }

    for (const articleMatch of block.matchAll(ENTRY_RE)) {
      const article = articleMatch[0];
      const articleIdx = articleMatch.index!;
      // The article belongs to the most recent day header before it.
      let day: number | null = null;
      for (const pos of dayPositions) {
        if (pos.idx <= articleIdx) day = pos.day;
        else break;
      }
      if (!day) continue;

      const hrefMatch = article.match(HREF_RE);
      const detailPath = hrefMatch?.[1];
      if (!detailPath) continue;
      const detailUrl = detailPath.startsWith("http") ? detailPath : `${ORIGIN}${detailPath}`;
      if (seen.has(detailUrl)) continue;
      seen.add(detailUrl);

      const title = cleanText(article.match(TITLE_RE)?.[1] ?? "");
      if (!title) continue;

      const timeStr = cleanText(article.match(TIME_RE)?.[1] ?? "");
      const time = parseTime(timeStr);

      const location = cleanText(article.match(LOCATION_RE)?.[1] ?? "");
      // Mousonturm renders the same tag list twice (desktop + mobile columns),
      // so dedupe before showing them in the description.
      const tags = Array.from(new Set([...article.matchAll(TAG_RE)].map((m) => cleanText(m[1])).filter(Boolean)));

      const date = `${year}-${String(MONTHS_DE[lookupNamedMonth(block, articleIdx) ?? ""] ?? parseInt(yearMonth.split("-")[1], 10)).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (date < today) continue;

      const description = [location, tags.length ? tags.join(" · ") : null].filter(Boolean).join(" — ") || null;
      events.push({
        title,
        date,
        time,
        detail_url: detailUrl,
        description,
        category: classifyByTags(tags, title),
        language: detectTalkLanguage(title, description),
      });
    }
  }

  return events;
}

/** Find the German month name that precedes the given article index. */
function lookupNamedMonth(block: string, articleIdx: number): string | null {
  let last: string | null = null;
  for (const dh of block.matchAll(DAY_HEADER_RE)) {
    if (dh.index! > articleIdx) break;
    const m = dh[1].match(/\d{1,2}\.\s*([A-Za-zäöüÄÖÜ]+)/);
    if (m) last = m[1].toLowerCase();
  }
  return last;
}

function parseTime(s: string): string | null {
  // "20:00 Uhr" → "20:00"; "20.00 Uhr" → "20:00"
  const m = s.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function classifyByTags(tags: string[], title: string): Category {
  const haystack = (tags.join(" ") + " " + title).toLowerCase();
  // Tags from Mousonturm's filter category "Lesung & Diskurs" — Diskurs
  // means discussion in the academic-panel sense.
  if (/diskurs|diskussion|gespräch|podium|debatte/.test(haystack)) return "Diskussion";
  if (/lesung|buchpräsentation|buchvorstellung|buchpremiere/.test(haystack)) return "Lesung";
  return "Vortrag";
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`mousonturm fetch failed: ${res.status}`);
  return res.text();
}

function cleanText(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8222;/g, "„")
    .replace(/&#8220;/g, "„")
    .replace(/&#8221;/g, "“")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "’");
}
