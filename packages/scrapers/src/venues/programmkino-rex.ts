import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.kinopolis.de";
const LISTING_URL = `${BASE}/rx/programm`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const SLIDER_SPLIT = /<div class="slider slider-6 prog-nav"/;
const TITLE_RE = /<h2[^>]*class="[^"]*hl[^"]*"[^>]*>([\s\S]{0,200}?)<\/h2>/g;
const NAV_ITEM_RE =
  /data-performance-ids=\[([A-Z0-9, ]+)\][\s\S]*?<div class="prog-nav__day">\s*[A-Za-z]+\.?\s*(\d{1,2}\.\d{1,2})\.?\s*<\/div>/g;
const SHOWTIME_RE =
  /<a[^>]+class="prog2__time[^"]*"[^>]+href="(\/rx\/programm\/vorstellung\/([A-Z0-9]+))"[^>]*>\s*(\d{1,2}:\d{2})/g;
const FILMDETAIL_RE = /href="\/rx\/filmdetail\/([a-z0-9-]+)\/[A-Z0-9]+"/;

/**
 * programmkino rex — Kinopolis-operated arthouse cinema in Darmstadt
 * (Wilhelminenstraße). The Kinopolis CMS renders one film per "slider"
 * section: a header table maps each day to the list of performance IDs
 * that play that day; the showtime buttons live in the body table.
 * We zip both by performance ID.
 */
export async function scrapeProgrammkinoRex(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(LISTING_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`programmkino-rex fetch failed: ${res.status}`);
  const html = await res.text();

  const sections = html.split(SLIDER_SPLIT);
  // The first split chunk is the page header — skip it. Each subsequent
  // chunk starts inside a slider, and the film's <h2> heading is in the
  // *preceding* chunk (just before the split). Pair them up.
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < sections.length; i++) {
    const preceding = sections[i - 1];
    const slider = sections[i];

    const title = lastFilmTitle(preceding);
    if (!title) continue;
    const filmdetailSlug = preceding.match(FILMDETAIL_RE)?.[1] ?? null;

    // Build performance-ID → date map from prog-nav__item headers.
    const dateByPerfId = new Map<string, string>();
    for (const m of slider.matchAll(NAV_ITEM_RE)) {
      const ids = m[1].split(",").map((s) => s.trim());
      const [, dd, mm] = m[2].match(/(\d{1,2})\.(\d{1,2})/) ?? [];
      if (!dd || !mm) continue;
      const date = `${inferYear(parseInt(mm, 10), today)}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
      for (const id of ids) dateByPerfId.set(id, date);
    }
    if (dateByPerfId.size === 0) continue;

    for (const sm of slider.matchAll(SHOWTIME_RE)) {
      const [, path, perfId, time] = sm;
      const date = dateByPerfId.get(perfId);
      if (!date || date < today) continue;
      const sourceId = perfId;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);

      events.push({
        source_event_id: sourceId,
        title,
        date,
        time,
        detail_url: filmdetailSlug ? `${BASE}/rx/filmdetail/${filmdetailSlug}/${perfId}` : `${BASE}${path}`,
        ticket_url: `${BASE}${path}`,
        labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
      });
    }
  }

  return { source_slug: "programmkino-rex", display_name: "programmkino rex Darmstadt", events };
}

function lastFilmTitle(chunk: string): string | null {
  let last: RegExpExecArray | null = null;
  for (const m of chunk.matchAll(TITLE_RE)) {
    last = m as unknown as RegExpExecArray;
  }
  if (!last) return null;
  const raw = stripHtml(last[1])
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/, " / ")
    .trim();
  // Skip the global "Wann möchtest Du ins Kino gehen?" header above the first slider.
  if (!raw || /möchtest|möchtest/i.test(raw)) return null;
  return raw;
}

function inferYear(month: number, today: string): number {
  const currentYear = parseInt(today.slice(0, 4), 10);
  const currentMonth = parseInt(today.slice(5, 7), 10);
  return month < currentMonth ? currentYear + 1 : currentYear;
}
