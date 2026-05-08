import { compareNullsLast } from "@museumsufer/core";
import { SCRAPE_DATA } from "./scrape-data";
import { THEATERS, type TheaterConfig } from "./theater-config";
import type { Performance, Show } from "./types";

/**
 * In-memory query layer over the bundled SCRAPE_DATA. The hourly GH
 * Action regenerates `src/scrape-data.ts` and a Cloudflare redeploy
 * picks it up — there's no D1 path for performances/shows anymore.
 *
 * Theater metadata (name/address/lat/lon) lives in `theater-config.ts`
 * and is joined in here, mirroring the old SQL JOIN shape so consumer
 * routes (api.ts, feeds.ts, theater.tsx, frontend.tsx) keep their
 * existing DayPerformance contract.
 */

const SHOWS_BY_ID = new Map<number, Show>(SCRAPE_DATA.shows.map((s) => [s.id, s]));
const PERFORMANCES_BY_ID = new Map<number, Performance>(SCRAPE_DATA.performances.map((p) => [p.id, p]));
const THEATERS_BY_SLUG = new Map<string, TheaterConfig>(THEATERS.map((t) => [t.slug, t]));

export interface DateWithCount {
  date: string;
  n: number;
}

export type DayPerformance = Performance & {
  show: Show;
  theater: { name: string; slug: string; website_url: string | null };
};

function joinPerformance(p: Performance): DayPerformance | null {
  const show = SHOWS_BY_ID.get(p.show_id);
  if (!show) return null;
  const t = THEATERS_BY_SLUG.get(show.theater_slug);
  if (!t) return null;
  return {
    ...p,
    show,
    theater: { name: t.name, slug: t.slug, website_url: t.website_url },
  };
}

/** Performances on a given ISO date, sorted by start time then theater/show. */
export async function getPerformancesForDate(date: string): Promise<DayPerformance[]> {
  const out: DayPerformance[] = [];
  for (const p of SCRAPE_DATA.performances) {
    if (p.date !== date) continue;
    const joined = joinPerformance(p);
    if (joined) out.push(joined);
  }
  return out.sort(
    (a, b) =>
      compareNullsLast(a.time, b.time) ||
      a.theater.name.localeCompare(b.theater.name) ||
      a.show.title.localeCompare(b.show.title),
  );
}

/** Performances inside `[fromDate, toDate]`, optionally filtered by theater slug. */
export async function getPerformancesInRange(
  fromDate: string,
  toDate: string,
  theaterSlug?: string | null,
): Promise<DayPerformance[]> {
  const wantedSlug = theaterSlug ?? null;
  const out: DayPerformance[] = [];
  for (const p of SCRAPE_DATA.performances) {
    if (p.date < fromDate || p.date > toDate) continue;
    const joined = joinPerformance(p);
    if (!joined) continue;
    if (wantedSlug && joined.theater.slug !== wantedSlug) continue;
    out.push(joined);
  }
  return out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      compareNullsLast(a.time, b.time) ||
      a.theater.name.localeCompare(b.theater.name) ||
      a.show.title.localeCompare(b.show.title),
  );
}

/** A single performance by its synthetic ID — used by `/api/performance/{id}`,
 *  `/performance/{id}/feed.ics`, deep-link share URLs, and JSON-LD output. */
export async function getPerformanceById(id: number): Promise<DayPerformance | null> {
  const p = PERFORMANCES_BY_ID.get(id);
  return p ? joinPerformance(p) : null;
}

/** Theater by slug. Returns the TheaterConfig directly — no DB. */
export async function getTheaterBySlug(slug: string): Promise<TheaterConfig | null> {
  return THEATERS_BY_SLUG.get(slug) ?? null;
}

/** Date histogram for the date strip — counts active (non-cancelled)
 *  performances per ISO date in the inclusive range. */
export async function getDatesWithPerformances(fromDate: string, toDate: string): Promise<DateWithCount[]> {
  const counts = new Map<string, number>();
  for (const p of SCRAPE_DATA.performances) {
    if (p.date < fromDate || p.date > toDate) continue;
    if (p.status === "cancelled") continue;
    counts.set(p.date, (counts.get(p.date) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, n]) => ({ date, n })).sort((a, b) => a.date.localeCompare(b.date));
}
