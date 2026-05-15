import { compareNullsLast } from "@museumsufer/core";
import { SCRAPE_DATA } from "./scrape-data";
import { SOURCES } from "./source-config";
import type { Category, LehrhausEvent, LehrhausSource } from "./types";

export interface DateWithCount {
  date: string;
  n: number;
}

export type DayEvent = LehrhausEvent & {
  source: LehrhausSource;
};

export interface EventFilter {
  source?: string | null;
  category?: Category | null;
}

const EVENTS_BY_ID = new Map<number, LehrhausEvent>(SCRAPE_DATA.events.map((e) => [e.id, e]));
const SOURCES_BY_SLUG = new Map<string, LehrhausSource>(SOURCES.map((s) => [s.slug, s]));

const EVENTS_BY_DATE = (() => {
  const map = new Map<string, LehrhausEvent[]>();
  for (const e of SCRAPE_DATA.events) {
    const arr = map.get(e.date);
    if (arr) arr.push(e);
    else map.set(e.date, [e]);
  }
  for (const arr of map.values()) {
    arr.sort(
      (a, b) =>
        compareNullsLast(a.time, b.time) ||
        a.source_slug.localeCompare(b.source_slug) ||
        a.title.localeCompare(b.title),
    );
  }
  return map;
})();

function joinEvent(e: LehrhausEvent): DayEvent | null {
  const source = SOURCES_BY_SLUG.get(e.source_slug);
  if (!source) return null;
  return { ...e, source };
}

function matchesFilter(e: LehrhausEvent, filter?: EventFilter): boolean {
  if (!filter) return true;
  if (filter.source && e.source_slug !== filter.source) return false;
  if (filter.category && e.category !== filter.category) return false;
  return true;
}

export function getEventsForDate(date: string, filter?: EventFilter): DayEvent[] {
  const events = EVENTS_BY_DATE.get(date);
  if (!events) return [];
  const out: DayEvent[] = [];
  for (const e of events) {
    if (!matchesFilter(e, filter)) continue;
    const joined = joinEvent(e);
    if (joined) out.push(joined);
  }
  return out;
}

export function getEventsInRange(from: string, to: string, filter?: EventFilter): DayEvent[] {
  const out: DayEvent[] = [];
  for (const e of SCRAPE_DATA.events) {
    if (e.date < from || e.date > to) continue;
    if (!matchesFilter(e, filter)) continue;
    const joined = joinEvent(e);
    if (joined) out.push(joined);
  }
  return out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      compareNullsLast(a.time, b.time) ||
      a.source.name.localeCompare(b.source.name) ||
      a.title.localeCompare(b.title),
  );
}

export function getEventById(id: number): DayEvent | null {
  const e = EVENTS_BY_ID.get(id);
  return e ? joinEvent(e) : null;
}

export function getSourceBySlug(slug: string): LehrhausSource | null {
  return SOURCES_BY_SLUG.get(slug) ?? null;
}

export function getDatesWithEvents(from: string, to: string, filter?: EventFilter): DateWithCount[] {
  const counts = new Map<string, number>();
  for (const e of SCRAPE_DATA.events) {
    if (e.date < from || e.date > to) continue;
    if (!matchesFilter(e, filter)) continue;
    counts.set(e.date, (counts.get(e.date) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, n]) => ({ date, n })).sort((a, b) => a.date.localeCompare(b.date));
}

export function getCategoryCounts(date: string, filter?: Omit<EventFilter, "category">): Map<Category, number> {
  const counts = new Map<Category, number>();
  for (const e of EVENTS_BY_DATE.get(date) ?? []) {
    if (!matchesFilter(e, filter)) continue;
    counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  }
  return counts;
}
