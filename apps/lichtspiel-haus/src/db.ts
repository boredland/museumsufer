import { compareNullsLast } from "@museumsufer/core";
import { CINEMAS, type CinemaConfig } from "./cinema-config";
import { SCRAPE_DATA } from "./scrape-data";
import type { Screening } from "./types";

export interface DateWithCount {
  date: string;
  n: number;
}

export type DayScreening = Screening & {
  cinema: {
    slug: string;
    name: string;
    short_name?: string;
    address: string;
    city: string;
    website_url: string;
  };
};

export interface ScreeningFilter {
  city?: string | null;
  cinema?: string | null;
  series?: string | null;
}

const SCREENINGS_BY_ID = new Map<number, Screening>(SCRAPE_DATA.screenings.map((s) => [s.id, s]));
const CINEMAS_BY_SLUG = new Map<string, CinemaConfig>(CINEMAS.map((c) => [c.slug, c]));

const SCREENINGS_BY_DATE = (() => {
  const map = new Map<string, Screening[]>();
  for (const s of SCRAPE_DATA.screenings) {
    const arr = map.get(s.date);
    if (arr) arr.push(s);
    else map.set(s.date, [s]);
  }
  for (const arr of map.values()) {
    arr.sort(
      (a, b) =>
        compareNullsLast(a.time, b.time) ||
        a.cinema_slug.localeCompare(b.cinema_slug) ||
        a.title.localeCompare(b.title),
    );
  }
  return map;
})();

const SCREENINGS_BY_SERIES = (() => {
  const map = new Map<string, Screening[]>();
  for (const s of SCRAPE_DATA.screenings) {
    if (!s.series) continue;
    const arr = map.get(s.series.slug);
    if (arr) arr.push(s);
    else map.set(s.series.slug, [s]);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.date.localeCompare(b.date) || compareNullsLast(a.time, b.time));
  }
  return map;
})();

function joinScreening(s: Screening): DayScreening | null {
  const cinema = CINEMAS_BY_SLUG.get(s.cinema_slug);
  if (!cinema) return null;
  return {
    ...s,
    cinema: {
      slug: cinema.slug,
      name: cinema.name,
      short_name: cinema.short_name,
      address: cinema.address,
      city: cinema.city,
      website_url: cinema.website_url,
    },
  };
}

function matchesFilter(s: Screening, cinema: CinemaConfig, filter?: ScreeningFilter): boolean {
  if (!filter) return true;
  if (filter.city && cinema.city !== filter.city) return false;
  if (filter.cinema && s.cinema_slug !== filter.cinema) return false;
  if (filter.series && s.series?.slug !== filter.series) return false;
  return true;
}

export function getScreeningsForDate(date: string, filter?: ScreeningFilter): DayScreening[] {
  const screenings = SCREENINGS_BY_DATE.get(date);
  if (!screenings) return [];
  const out: DayScreening[] = [];
  for (const s of screenings) {
    const cinema = CINEMAS_BY_SLUG.get(s.cinema_slug);
    if (!cinema) continue;
    if (!matchesFilter(s, cinema, filter)) continue;
    const joined = joinScreening(s);
    if (joined) out.push(joined);
  }
  return out;
}

export function getScreeningsInRange(from: string, to: string, filter?: ScreeningFilter): DayScreening[] {
  const out: DayScreening[] = [];
  for (const s of SCRAPE_DATA.screenings) {
    if (s.date < from || s.date > to) continue;
    const cinema = CINEMAS_BY_SLUG.get(s.cinema_slug);
    if (!cinema) continue;
    if (!matchesFilter(s, cinema, filter)) continue;
    const joined = joinScreening(s);
    if (joined) out.push(joined);
  }
  return out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      compareNullsLast(a.time, b.time) ||
      a.cinema.name.localeCompare(b.cinema.name) ||
      a.title.localeCompare(b.title),
  );
}

export function getScreeningById(id: number): DayScreening | null {
  const s = SCREENINGS_BY_ID.get(id);
  return s ? joinScreening(s) : null;
}

export function getCinemaBySlug(slug: string): CinemaConfig | null {
  return CINEMAS_BY_SLUG.get(slug) ?? null;
}

export function getDatesWithScreenings(from: string, to: string, filter?: ScreeningFilter): DateWithCount[] {
  const counts = new Map<string, number>();
  for (const s of SCRAPE_DATA.screenings) {
    if (s.date < from || s.date > to) continue;
    const cinema = CINEMAS_BY_SLUG.get(s.cinema_slug);
    if (!cinema) continue;
    if (!matchesFilter(s, cinema, filter)) continue;
    counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, n]) => ({ date, n })).sort((a, b) => a.date.localeCompare(b.date));
}

export interface SeriesSummary {
  slug: string;
  name: string;
  count: number;
  first_date: string;
  last_date: string;
}

export function getAllSeries(from?: string): SeriesSummary[] {
  const summaries: SeriesSummary[] = [];
  for (const [slug, screenings] of SCREENINGS_BY_SERIES) {
    const filtered = from ? screenings.filter((s) => s.date >= from) : screenings;
    if (filtered.length === 0) continue;
    const name = filtered[0].series?.name ?? slug;
    summaries.push({
      slug,
      name,
      count: filtered.length,
      first_date: filtered[0].date,
      last_date: filtered[filtered.length - 1].date,
    });
  }
  return summaries.sort((a, b) => a.first_date.localeCompare(b.first_date) || a.name.localeCompare(b.name));
}

export function getSeriesScreenings(slug: string, from?: string): DayScreening[] {
  const screenings = SCREENINGS_BY_SERIES.get(slug) ?? [];
  const out: DayScreening[] = [];
  for (const s of screenings) {
    if (from && s.date < from) continue;
    const joined = joinScreening(s);
    if (joined) out.push(joined);
  }
  return out;
}
