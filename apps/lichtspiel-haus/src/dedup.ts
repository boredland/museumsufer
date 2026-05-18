import { fnv1aInt } from "@museumsufer/core";
import type { Screening } from "./types";

/** Aggregator slugs that re-list films screened at direct venues. Their copies
 *  lose to the venue's own listing when they collide. None known yet for the
 *  film vocabulary — left as an extension point. */
const AGGREGATOR_CINEMA_SLUGS = new Set<string>([]);

const RICHNESS_FIELDS = [
  "description",
  "image_url",
  "ticket_url",
  "credits",
  "price_min",
  "venue_room",
  "version",
  "format",
  "series",
] as const satisfies readonly (keyof Screening)[];

function canonicalTitleHash(title: string): number {
  return fnv1aInt(title.toLowerCase().replace(/[^a-z0-9]+/g, ""));
}

function matchKey(s: Screening): string {
  return `${s.date}|${s.time ?? ""}|${canonicalTitleHash(s.title)}`;
}

function richness(s: Screening): number {
  let n = 0;
  for (const f of RICHNESS_FIELDS) {
    const v = s[f];
    if (v != null && v !== "") n++;
  }
  return n;
}

function isAggregator(s: Screening): boolean {
  return AGGREGATOR_CINEMA_SLUGS.has(s.cinema_slug);
}

/**
 * Collapses duplicate screenings that the same physical screening surfaces under
 * via multiple cinemas (aggregators re-list direct-cinema programs). Prefers
 * direct sources; among same-tier candidates, keeps the entry with the
 * richest field coverage.
 */
export function dedupScreenings(screenings: Screening[]): Screening[] {
  const groups = new Map<string, Screening[]>();
  for (const s of screenings) {
    const key = matchKey(s);
    const bucket = groups.get(key);
    if (bucket) bucket.push(s);
    else groups.set(key, [s]);
  }

  const out: Screening[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length === 1) {
      out.push(bucket[0]);
      continue;
    }
    const direct = bucket.filter((s) => !isAggregator(s));
    const candidates = direct.length > 0 ? direct : bucket;
    const winner = candidates.reduce((best, cur) => (richness(cur) > richness(best) ? cur : best));
    out.push(winner);
  }
  return out;
}
