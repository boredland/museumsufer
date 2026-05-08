/**
 * In-memory query layer over the bundled SCRAPE_DATA. The daily
 * GitHub Action regenerates `src/scrape-data.ts` and a Cloudflare
 * redeploy picks it up — the worker no longer hits D1 for events,
 * exhibitions, museums, or translations.
 *
 * The bundle is pre-cooked: dedup, closure-keyword filter and
 * date-range pruning all happen at scrape time. Read-time work is
 * just (1) date filter, (2) join museum metadata in, (3) sort,
 * (4) the request-time `filterPastEvents` that depends on the current
 * Berlin clock.
 *
 * `likes` is the only D1 path left (user-submitted, mutable).
 */
import { berlinHourMinute } from "./date";
import { SCRAPE_DATA } from "./scrape-data";
import type { Event, Exhibition, Museum, Translation } from "./types";

const MUSEUMS_BY_ID = new Map<number, Museum>(SCRAPE_DATA.museums.map((m) => [m.id, m]));
const EVENTS_BY_ID = new Map<number, Event>(SCRAPE_DATA.events.map((e) => [e.id, e]));
const EXHIBITIONS_BY_ID = new Map<number, Exhibition>(SCRAPE_DATA.exhibitions.map((e) => [e.id, e]));

const TRANSLATIONS_BY_KEY = new Map<string, string>(
  SCRAPE_DATA.translations.map((t) => [`${t.source_hash}|${t.target_lang}`, t.translated_text]),
);

export function getTranslation(sourceHash: string, targetLang: string): string | undefined {
  return TRANSLATIONS_BY_KEY.get(`${sourceHash}|${targetLang}`);
}

export function listTranslations(): Translation[] {
  return SCRAPE_DATA.translations;
}

export function getAllMuseums(): Museum[] {
  return [...SCRAPE_DATA.museums].sort((a, b) => a.name.localeCompare(b.name));
}

export function getMuseumById(id: number): Museum | null {
  return MUSEUMS_BY_ID.get(id) ?? null;
}

type Joined<T> = T & {
  museum_name: string;
  museum_slug: string;
  image_url: string | null;
};

function joinMuseum<T extends { museum_id: number; image_url?: string | null }>(item: T): Joined<T> | null {
  const m = MUSEUMS_BY_ID.get(item.museum_id);
  if (!m) return null;
  return {
    ...item,
    museum_name: m.name,
    museum_slug: m.slug,
    // Fall back to the museum's own image when the row didn't carry one.
    image_url: item.image_url ?? m.image_url ?? null,
  };
}

export async function getEventsForDate(date: string): Promise<Event[]> {
  const out: Joined<Event>[] = [];
  for (const ev of SCRAPE_DATA.events) {
    if (ev.date !== date) continue;
    const joined = joinMuseum(ev);
    if (joined) out.push(joined);
  }
  out.sort((a, b) => compareTime(a.time, b.time) || a.museum_name.localeCompare(b.museum_name));
  return date === todayIsoLocal() ? filterPastEvents(out) : out;
}

export async function getEventsForRange(startDate: string, endDate: string): Promise<Event[]> {
  const out: Joined<Event>[] = [];
  for (const ev of SCRAPE_DATA.events) {
    if (ev.date < startDate || ev.date > endDate) continue;
    const joined = joinMuseum(ev);
    if (joined) out.push(joined);
  }
  out.sort(
    (a, b) => a.date.localeCompare(b.date) || compareTime(a.time, b.time) || a.museum_name.localeCompare(b.museum_name),
  );
  const today = todayIsoLocal();
  if (startDate <= today && today <= endDate) {
    const past = out.filter((ev) => ev.date < today);
    const todayEvents = filterPastEvents(out.filter((ev) => ev.date === today));
    const future = out.filter((ev) => ev.date > today);
    return [...past, ...todayEvents, ...future];
  }
  return out;
}

export async function getEventById(id: number): Promise<(Event & { museum_name: string }) | null> {
  const ev = EVENTS_BY_ID.get(id);
  if (!ev) return null;
  return joinMuseum(ev);
}

export async function getExhibitionsForDate(date: string): Promise<Exhibition[]> {
  const out: Joined<Exhibition>[] = [];
  for (const ex of SCRAPE_DATA.exhibitions) {
    if (!ex.start_date || !ex.end_date) continue;
    if (ex.start_date > date) continue;
    if (ex.end_date < date) continue;
    const joined = joinMuseum(ex);
    if (joined) out.push(joined);
  }
  out.sort((a, b) => a.museum_slug.localeCompare(b.museum_slug) || a.title.localeCompare(b.title));
  return out;
}

export async function getExhibitionById(id: number): Promise<(Exhibition & { museum_name: string }) | null> {
  const ex = EXHIBITIONS_BY_ID.get(id);
  if (!ex) return null;
  return joinMuseum(ex);
}

// ─── helpers ────────────────────────────────────────────────────────

function compareTime(a: string | null | undefined, b: string | null | undefined): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a.localeCompare(b);
}

function todayIsoLocal(): string {
  // Inline to avoid a circular import via ./date — date.ts pulls in
  // i18n which pulls in components; keep this layer dependency-free.
  return new Date().toISOString().slice(0, 10);
}

/** Hide events whose start/end has already passed. Depends on the current
 *  Berlin clock, so it has to live at request time (the bundle is shared
 *  across the day). */
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
