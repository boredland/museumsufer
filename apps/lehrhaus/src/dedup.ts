import { fnv1aInt } from "@museumsufer/core";
import type { LehrhausEvent } from "./types";

/**
 * Aggregator sources don't run their own events — they re-list someone else's.
 * The two cross-imports fall into this bucket.
 */
const AGGREGATOR_SOURCE_SLUGS = new Set<string>(["frankfurt-museums", "frankfurt-theaters"]);

const RICHNESS_FIELDS = [
  "description",
  "image_url",
  "ticket_url",
  "detail_url",
  "end_time",
  "language",
] as const satisfies readonly (keyof LehrhausEvent)[];

function canonicalTitleHash(title: string): number {
  return fnv1aInt(title.toLowerCase().replace(/[^a-z0-9]+/g, ""));
}

function matchKey(e: LehrhausEvent): string {
  return `${e.date}|${e.time ?? ""}|${canonicalTitleHash(e.title)}`;
}

function richness(e: LehrhausEvent): number {
  let n = 0;
  for (const f of RICHNESS_FIELDS) {
    const v = e[f];
    if (v != null && v !== "") n++;
  }
  return n;
}

function isAggregator(e: LehrhausEvent): boolean {
  return AGGREGATOR_SOURCE_SLUGS.has(e.source_slug);
}

/**
 * Collapses duplicate talks that surface under multiple sources (cross-imported
 * from sibling apps + scraped directly from the host venue). Prefers direct
 * sources over aggregators; among same-tier candidates, keeps the richest entry.
 */
export function dedupEvents(events: LehrhausEvent[]): LehrhausEvent[] {
  const groups = new Map<string, LehrhausEvent[]>();
  for (const e of events) {
    const key = matchKey(e);
    const bucket = groups.get(key);
    if (bucket) bucket.push(e);
    else groups.set(key, [e]);
  }

  const out: LehrhausEvent[] = [];
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
