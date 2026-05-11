import { fnv1aInt } from "@museumsufer/core";
import type { Event } from "./types";

const AGGREGATOR_VENUE_SLUGS = new Set<string>(["jazz-frankfurt"]);

const RICHNESS_FIELDS = [
  "description",
  "image_url",
  "ticket_url",
  "performers",
  "price_min",
  "venue_room",
] as const satisfies readonly (keyof Event)[];

function canonicalTitleHash(title: string): number {
  return fnv1aInt(title.toLowerCase().replace(/[^a-z0-9]+/g, ""));
}

function matchKey(e: Event): string {
  return `${e.date}|${e.time ?? ""}|${canonicalTitleHash(e.title)}`;
}

function richness(e: Event): number {
  let n = 0;
  for (const f of RICHNESS_FIELDS) {
    const v = e[f];
    if (v != null && v !== "") n++;
  }
  return n;
}

function isAggregator(e: Event): boolean {
  return AGGREGATOR_VENUE_SLUGS.has(e.venue_slug);
}

/**
 * Collapses duplicate concerts that the same physical event surfaces under
 * via multiple venues (aggregators re-list direct-venue programs). Prefers
 * direct sources; among same-tier candidates, keeps the entry with the
 * richest field coverage.
 */
export function dedupEvents(events: Event[]): Event[] {
  const groups = new Map<string, Event[]>();
  for (const e of events) {
    const key = matchKey(e);
    const bucket = groups.get(key);
    if (bucket) bucket.push(e);
    else groups.set(key, [e]);
  }

  const out: Event[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length === 1) {
      out.push(bucket[0]);
      continue;
    }
    const direct = bucket.filter((e) => !isAggregator(e));
    const candidates = direct.length > 0 ? direct : bucket;
    const winner = candidates.reduce((best, cur) => (richness(cur) > richness(best) ? cur : best));
    out.push(winner);
  }
  return out;
}
