import { compareNullsLast } from "@museumsufer/core";
import { VENUES, type VenueConfig } from "./concert-config";
import { SCRAPE_DATA } from "./scrape-data";
import type { Event, Genre } from "./types";

export interface DateWithCount {
  date: string;
  n: number;
}

export type DayEvent = Event & {
  venue: {
    slug: string;
    name: string;
    short_name?: string;
    address: string;
    city: string;
    website_url: string;
  };
};

export interface EventFilter {
  city?: string | null;
  venue?: string | null;
  genre?: Genre | null;
}

const EVENTS_BY_ID = new Map<number, Event>(SCRAPE_DATA.events.map((e) => [e.id, e]));
const VENUES_BY_SLUG = new Map<string, VenueConfig>(VENUES.map((v) => [v.slug, v]));

const EVENTS_BY_DATE = (() => {
  const map = new Map<string, Event[]>();
  for (const e of SCRAPE_DATA.events) {
    const arr = map.get(e.date);
    if (arr) arr.push(e);
    else map.set(e.date, [e]);
  }
  for (const arr of map.values()) {
    arr.sort(
      (a, b) =>
        compareNullsLast(a.time, b.time) || a.venue_slug.localeCompare(b.venue_slug) || a.title.localeCompare(b.title),
    );
  }
  return map;
})();

function joinEvent(e: Event): DayEvent | null {
  const venue = VENUES_BY_SLUG.get(e.venue_slug);
  if (!venue) return null;
  return {
    ...e,
    venue: {
      slug: venue.slug,
      name: venue.name,
      short_name: venue.short_name,
      address: venue.address,
      city: venue.city,
      website_url: venue.website_url,
    },
  };
}

function matchesFilter(e: Event, venue: VenueConfig, filter?: EventFilter): boolean {
  if (!filter) return true;
  if (filter.city && venue.city !== filter.city) return false;
  if (filter.venue && e.venue_slug !== filter.venue) return false;
  if (filter.genre && e.genre !== filter.genre) return false;
  return true;
}

export function getEventsForDate(date: string, filter?: EventFilter): DayEvent[] {
  const events = EVENTS_BY_DATE.get(date);
  if (!events) return [];
  const out: DayEvent[] = [];
  for (const e of events) {
    const venue = VENUES_BY_SLUG.get(e.venue_slug);
    if (!venue) continue;
    if (!matchesFilter(e, venue, filter)) continue;
    const joined = joinEvent(e);
    if (joined) out.push(joined);
  }
  return out;
}

export function getEventsInRange(from: string, to: string, filter?: EventFilter): DayEvent[] {
  const out: DayEvent[] = [];
  for (const e of SCRAPE_DATA.events) {
    if (e.date < from || e.date > to) continue;
    const venue = VENUES_BY_SLUG.get(e.venue_slug);
    if (!venue) continue;
    if (!matchesFilter(e, venue, filter)) continue;
    const joined = joinEvent(e);
    if (joined) out.push(joined);
  }
  return out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      compareNullsLast(a.time, b.time) ||
      a.venue.name.localeCompare(b.venue.name) ||
      a.title.localeCompare(b.title),
  );
}

export function getEventById(id: number): DayEvent | null {
  const e = EVENTS_BY_ID.get(id);
  return e ? joinEvent(e) : null;
}

export function getVenueBySlug(slug: string): VenueConfig | null {
  return VENUES_BY_SLUG.get(slug) ?? null;
}

export function getDatesWithEvents(from: string, to: string, filter?: EventFilter): DateWithCount[] {
  const counts = new Map<string, number>();
  for (const e of SCRAPE_DATA.events) {
    if (e.date < from || e.date > to) continue;
    const venue = VENUES_BY_SLUG.get(e.venue_slug);
    if (!venue) continue;
    if (!matchesFilter(e, venue, filter)) continue;
    counts.set(e.date, (counts.get(e.date) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, n]) => ({ date, n })).sort((a, b) => a.date.localeCompare(b.date));
}

export function getGenreCounts(date: string, filter?: Omit<EventFilter, "genre">): Map<Genre, number> {
  const counts = new Map<Genre, number>();
  for (const e of EVENTS_BY_DATE.get(date) ?? []) {
    const venue = VENUES_BY_SLUG.get(e.venue_slug);
    if (!venue) continue;
    if (!matchesFilter(e, venue, filter)) continue;
    counts.set(e.genre, (counts.get(e.genre) ?? 0) + 1);
  }
  return counts;
}
