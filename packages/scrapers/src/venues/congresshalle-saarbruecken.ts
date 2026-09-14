import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Congress Centrum Saar — Congresshalle + Saarlandhalle Saarbrücken.
 *
 * The WordPress /events/ listing was rebuilt: the old `event-card` divs are
 * gone, replaced by one `<article class="event …">` per show carrying its own
 * date, time, location, categories and teaser:
 *
 *   <div class="event__date">13. - 14. Sep 2026</div>
 *   <div class="event__time">11:00 Uhr</div>
 *   <div class="event__location"><a …>Congresshalle</a></div>
 *   <h2 class="event__title"><a href="…" class="event__titlelink">1. Sinfoniekonzert</a></h2>
 *   <div class="event__categories">…<span>Klassik</span>…</div>
 *
 * The listing paginates 10 per page (/events/page/N/) — the old parser read
 * only the first page even when it matched, so the whole back half of the
 * season was never seen. We walk the pagination links to the end.
 *
 * Categories are the venue's own, so they label better than a keyword guess:
 * the hall hosts trade fairs and sport alongside concerts, and the previous
 * blanket `music:classical` mislabelled all of them.
 */
const BASE = "https://www.ccsaar.de";
const LIST_URL = `${BASE}/events/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
/** Safety net: the listing advertises its last page, but a markup change that
 *  hides the pager must not turn into an unbounded crawl. */
const MAX_PAGES = 20;

const CARD_RE = /<article[^>]*class="event [\s\S]*?<\/article>/g;
const DATE_RE = /<div class="event__date">([^<]*)<\/div>/;
const TIME_RE = /<div class="event__time">([^<]*)<\/div>/;
const LOCATION_RE = /<div class="event__location">[\s\S]*?>([^<]+)<\/a>/;
const TITLE_RE = /<a href="([^"]+)" class="event__titlelink"[^>]*>([\s\S]*?)<\/a>/;
const TEASER_RE = /<div class="event__content">([\s\S]*?)<\/div>/;
const CATEGORY_RE = /<div class="event__categories">([\s\S]*?)<\/div>/;
/** "13. - 14. Sep 2026" / "25. Sep 2026" — a span keeps its start day. */
const DATE_PARSE_RE = /(\d{1,2})\.\s*(?:[-–]\s*\d{1,2}\.\s*)?([A-Za-zäöü]+)\s+(\d{4})/;

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mär: "03",
  mar: "03",
  apr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  okt: "10",
  nov: "11",
  dez: "12",
};

/** Venue category → hub label. Categories with no cultural-programme meaning
 *  (trade fairs, conferences, corporate parties) map to nothing and drop out. */
const LABEL_BY_CATEGORY: Record<string, string> = {
  ballett: "dance:ballet",
  comedy: "stage:comedy",
  faasenacht: "stage:comedy",
  kabarett: "stage:comedy",
  kinderveranstaltungen: "museum:familie",
  klassik: "music:classical",
  konzerte: "music:pop",
  "musicals & shows": "stage:musical",
  weihnachten: "music:sacred",
  "vorträge & lesungen": "talk:vortrag",
};

export async function scrapeCongresshalleSaarbruecken(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? LIST_URL : `${BASE}/events/page/${page}/`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      if (page === 1) throw new Error(`ccsaar fetch failed: ${res.status}`);
      break;
    }
    const html = await res.text();

    for (const m of html.matchAll(CARD_RE)) {
      const card = m[0];
      const titleMatch = card.match(TITLE_RE);
      if (!titleMatch) continue;
      const title = decodeEntities(stripHtml(titleMatch[2])).replace(/\s+/g, " ").trim();
      if (!title) continue;

      const date = parseDate(card.match(DATE_RE)?.[1] ?? "");
      if (!date || date < today) continue;

      const detailUrl = titleMatch[1].startsWith("http") ? titleMatch[1] : `${BASE}${titleMatch[1]}`;
      // The detail URL is per-production; the date qualifies each performance
      // of a run so they don't collapse onto one id in the hub's merge.
      const sourceEventId = `${detailUrl}|${date}`;
      if (seen.has(sourceEventId)) continue;
      seen.add(sourceEventId);

      const categories = [...(card.match(CATEGORY_RE)?.[1] ?? "").matchAll(/<span>([^<]+)<\/span>/g)].map((c) =>
        decodeEntities(c[1]).trim(),
      );
      const timeRaw = card.match(TIME_RE)?.[1]?.match(/(\d{1,2}):(\d{2})/);
      const teaser = decodeEntities(stripHtml(card.match(TEASER_RE)?.[1] ?? ""))
        .replace(/\s+/g, " ")
        .trim();

      events.push({
        source_event_id: sourceEventId,
        title,
        description: teaser ? teaser.slice(0, 400) : null,
        date,
        time: timeRaw ? `${timeRaw[1].padStart(2, "0")}:${timeRaw[2]}` : null,
        detail_url: detailUrl,
        venue_room: card.match(LOCATION_RE)?.[1]?.trim() ?? null,
        raw_category: categories.join(", ") || null,
        labels: labelsFor(categories),
      });
    }

    if (!html.includes(`/events/page/${page + 1}/`)) break;
  }

  return { source_slug: "congresshalle-saarbruecken", display_name: "Congresshalle Saarbrücken", events };
}

function parseDate(raw: string): string | null {
  const m = raw.match(DATE_PARSE_RE);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase().slice(0, 3)];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
}

function labelsFor(categories: string[]): ScrapedLabel[] {
  const labels: ScrapedLabel[] = [];
  const seen = new Set<string>();
  for (const c of categories) {
    const label = LABEL_BY_CATEGORY[c.toLowerCase()];
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push({ label, confidence: 1.0, classifier: "upstream-category" });
  }
  return labels;
}
