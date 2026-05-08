/**
 * In-memory query layer over the bundled SCRAPE_DATA. The daily
 * GitHub Action regenerates `src/scrape-data.ts` and a Cloudflare
 * redeploy picks it up — the worker no longer hits D1 for events,
 * exhibitions, museums, or translations.
 *
 * The signatures keep the previous async + DayPerformance-style joined
 * shape so consumer code (api.ts, render paths, feeds) doesn't have to
 * change. Filtering is array.filter — a few hundred rows, trivial.
 *
 * `likes` is the only D1 path left (user-submitted, mutable).
 */
import { berlinHourMinute, todayIso } from "./date";
import { SCRAPE_DATA } from "./scrape-data";
import type { Event, Exhibition, Museum, Translation } from "./types";

const MUSEUMS_BY_ID = new Map<number, Museum>(SCRAPE_DATA.museums.map((m) => [m.id, m]));

const TRANSLATIONS_BY_KEY = new Map<string, string>(
  SCRAPE_DATA.translations.map((t) => [`${t.source_hash}|${t.target_lang}`, t.translated_text]),
);

export function getTranslation(sourceHash: string, targetLang: string): string | undefined {
  return TRANSLATIONS_BY_KEY.get(`${sourceHash}|${targetLang}`);
}

export function getAllMuseums(): Museum[] {
  return [...SCRAPE_DATA.museums].sort((a, b) => a.name.localeCompare(b.name));
}

export function getMuseumById(id: number): Museum | null {
  return MUSEUMS_BY_ID.get(id) ?? null;
}

function joinMuseum<T extends { museum_id: number }>(
  item: T,
):
  | (T & {
      museum_name: string;
      museum_slug: string;
      museum_image_url: string | null;
    })
  | null {
  const m = MUSEUMS_BY_ID.get(item.museum_id);
  if (!m) return null;
  return {
    ...item,
    museum_name: m.name,
    museum_slug: m.slug,
    museum_image_url: m.image_url ?? null,
  };
}

const CLOSURE_KEYWORDS = /geschlossen|feiertag|holiday|closed|fermeture|ruhetag/i;

export async function getEventsForDate(date: string): Promise<Event[]> {
  const out: ReturnType<typeof joinMuseum<Event>>[] = [];
  for (const ev of SCRAPE_DATA.events) {
    if (ev.date !== date) continue;
    if (CLOSURE_KEYWORDS.test(ev.title)) continue;
    const joined = joinMuseum(ev);
    if (joined) out.push(joined);
  }
  out.sort((a, b) => {
    if (!a || !b) return 0;
    return compareTime(a.time, b.time) || a.museum_name.localeCompare(b.museum_name);
  });
  const filtered = (out.filter(Boolean) as NonNullable<(typeof out)[number]>[]).map(fallbackImage);
  const deduped = deduplicateEvents(filtered);
  if (date === todayIso()) return filterPastEvents(deduped);
  return deduped;
}

export async function getEventsForRange(startDate: string, endDate: string): Promise<Event[]> {
  const out: ReturnType<typeof joinMuseum<Event>>[] = [];
  for (const ev of SCRAPE_DATA.events) {
    if (ev.date < startDate || ev.date > endDate) continue;
    if (CLOSURE_KEYWORDS.test(ev.title)) continue;
    const joined = joinMuseum(ev);
    if (joined) out.push(joined);
  }
  out.sort((a, b) => {
    if (!a || !b) return 0;
    return a.date.localeCompare(b.date) || compareTime(a.time, b.time) || a.museum_name.localeCompare(b.museum_name);
  });
  const filtered = (out.filter(Boolean) as NonNullable<(typeof out)[number]>[]).map(fallbackImage);
  const deduped = deduplicateEvents(filtered);
  const today = todayIso();
  if (startDate <= today && today <= endDate) {
    const past = deduped.filter((ev) => ev.date < today);
    const todayEvents = filterPastEvents(deduped.filter((ev) => ev.date === today));
    const future = deduped.filter((ev) => ev.date > today);
    return [...past, ...todayEvents, ...future];
  }
  return deduped;
}

export async function getEventById(id: number): Promise<(Event & { museum_name: string }) | null> {
  for (const ev of SCRAPE_DATA.events) {
    if (ev.id !== id) continue;
    const joined = joinMuseum(ev);
    if (!joined) return null;
    return joined;
  }
  return null;
}

export async function getExhibitionsForDate(date: string): Promise<Exhibition[]> {
  const out: ReturnType<typeof joinMuseum<Exhibition>>[] = [];
  for (const ex of SCRAPE_DATA.exhibitions) {
    if (!ex.start_date || !ex.end_date) continue;
    if (ex.start_date > date) continue;
    if (ex.end_date < date) continue;
    const joined = joinMuseum(ex);
    if (joined) out.push(joined);
  }
  out.sort((a, b) => {
    if (!a || !b) return 0;
    return a.museum_slug.localeCompare(b.museum_slug) || a.title.localeCompare(b.title);
  });
  const filtered = (out.filter(Boolean) as NonNullable<(typeof out)[number]>[]).map(fallbackImage);
  return deduplicateByTitle(filtered);
}

export function listTranslations(): Translation[] {
  return SCRAPE_DATA.translations;
}

// ─── helpers ────────────────────────────────────────────────────────

function compareTime(a: string | null | undefined, b: string | null | undefined): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a.localeCompare(b);
}

/** Use the museum's own image as a fallback when the row didn't carry one. */
function fallbackImage<T extends { image_url?: string | null; museum_image_url: string | null }>(
  item: T,
): Omit<T, "museum_image_url"> {
  const { museum_image_url, ...rest } = item;
  return {
    ...rest,
    image_url: rest.image_url ?? museum_image_url ?? null,
  } as Omit<T, "museum_image_url">;
}

function normalizeForDedup(title: string): string {
  return title
    .toLowerCase()
    .replace(/[:.,;!?()[\]{}""„"''‚'«»‹›]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deduplicateByTitle<T extends { museum_id: number; title: string; id: number }>(items: T[]): T[] {
  const result: T[] = [];
  for (const item of items) {
    const norm = normalizeForDedup(item.title);
    const dupeIdx = result.findIndex((e) => e.museum_id === item.museum_id && normalizeForDedup(e.title) === norm);
    if (dupeIdx !== -1) {
      if (item.id > result[dupeIdx].id) result[dupeIdx] = item;
      continue;
    }
    result.push(item);
  }
  return result;
}

function deduplicateEvents<T extends { museum_id: number; title: string; id: number; time?: string | null }>(
  events: T[],
): T[] {
  const afterTitleDedup = deduplicateByTitle(events);
  const result: T[] = [];
  for (const ev of afterTitleDedup) {
    if (ev.time) {
      const timeDupeIdx = result.findIndex(
        (e) => e.museum_id === ev.museum_id && e.time === ev.time && wordsOverlap(e.title, ev.title),
      );
      if (timeDupeIdx !== -1) {
        if (ev.id > result[timeDupeIdx].id) result[timeDupeIdx] = ev;
        continue;
      }
    }
    result.push(ev);
  }
  return result;
}

function wordsOverlap(a: string, b: string): boolean {
  const na = normalizeForDedup(a);
  const nb = normalizeForDedup(b);
  if (na === nb) return true;
  const wordsA = na.split(" ").filter((w) => w.length > 2);
  const wordsB = nb.split(" ").filter((w) => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  const [shorter, longerStr] = wordsA.length <= wordsB.length ? [wordsA, nb] : [wordsB, na];
  return shorter.every((w) => longerStr.includes(w));
}

function filterPastEvents<T extends { time?: string | null; end_time?: string | null }>(events: T[]): T[] {
  const { hour, minute } = berlinHourMinute();
  let nowMinutes = hour * 60 + minute;
  if (nowMinutes < 360) nowMinutes += 24 * 60;

  return events.filter((ev) => {
    if (!ev.time) return true;

    if (ev.end_time) {
      const [eh, em] = ev.end_time.split(":").map(Number);
      let endMinutes = eh * 60 + em;
      if (endMinutes < 360) endMinutes += 24 * 60;
      return nowMinutes < endMinutes;
    }

    const [h, m] = ev.time.split(":").map(Number);
    const assumedEnd = h * 60 + m + 180;
    return nowMinutes < assumedEnd;
  });
}
