import { fnv1aInt } from "@museumsufer/core";
import type { Screening } from "./types";

/** Aggregator slugs that re-list films screened at direct venues. Their copies
 *  lose to the venue's own listing when they collide. The Nippon Connection
 *  festival schedule lists screenings hosted at partner cinemas (Mal Seh'n,
 *  naxos, Eldorado, DFF), which scrape those same screenings directly; the
 *  hub already cross-tags those with the festival's series label, so the
 *  festival copy can lose the collision without losing the Nippon badge. */
const AGGREGATOR_CINEMA_SLUGS = new Set<string>(["nippon-connection"]);

const RICHNESS_FIELDS = [
  "description",
  "description_en",
  "image_url",
  "ticket_url",
  "credits",
  "price_min",
  "venue_room",
  "version",
  "format",
  "series",
  "subtitle",
  "end_time",
  // TMDb/IMDb enrichment marks the canonical listing; the bare re-list
  // (e.g. "OV: Backrooms" with no metadata) should lose to it.
  "tmdb_id",
  "imdb_id",
] as const satisfies readonly (keyof Screening)[];

/** Version chrome the source bakes into the title — as a leading prefix
 *  ("OV: Backrooms", "OmU – …") or a trailing tag (" (OV)"). The version is
 *  carried separately in `version`, so it must not split the match key: two
 *  listings of one screening that differ only by this chrome are the same film. */
const LEADING_VERSION_RE = /^\s*(?:om[a-zäöü]*u|omeu|ov|of|df|stumm)\s*[:·–-]\s*/i;
const TRAILING_VERSION_RE = /\s*\((?:om[a-zäöü]*u|ov|df|stumm)\)\s*$/i;

function canonicalTitleHash(title: string): number {
  const stripped = title.replace(LEADING_VERSION_RE, "").replace(TRAILING_VERSION_RE, "");
  return fnv1aInt(stripped.toLowerCase().replace(/[^a-z0-9]+/g, ""));
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
