#!/usr/bin/env bun
/** Bundles src/scrape-data.ts from hub `EVENTS` filtered to LANDAU_BBOX,
 *  then runs the four-pass cross-source dedup and Nominatim geocoding. */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSection, fnv1aInt, todayIso } from "@museumsufer/core";
import { type CanonicalEvent, EVENTS, inBbox, LANDAU_BBOX } from "@museumsufer/event-hub";
import { GEOCODE_CACHE } from "../src/geocode-cache";
import type { Event, EventSource, ScrapeData } from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dataPath = resolve(root, "src/scrape-data.ts");
const geocodeCachePath = resolve(root, "src/geocode-cache.ts");

/** Cross-source dedup priority. Kulturnetz first (most reliable
 *  categorisation), landau.de second (cleanest time data via ICS). */
const SOURCE_RANK: Record<EventSource, number> = {
  "kulturnetz-landau": 0,
  "landau-de": 1,
  "hambacher-schloss": 2,
  "rptu-campuskultur": 3,
  suew: 4,
  "pfalz-de": 5,
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_DELAY_MS = 1100;
const NOMINATIM_USER_AGENT = "landau.today (https://landau.today; hello@landau.today)";

const startMain = Date.now();
const today = todayIso();

const candidates: Omit<Event, "id">[] = [];
for (const ev of EVENTS) {
  if (!inBbox(ev.lat, ev.lon, LANDAU_BBOX)) continue;
  if (!(ev.source_slug in SOURCE_RANK)) continue;
  if ((ev.end_date ?? ev.date) < today) continue;
  candidates.push(toLocalEvent(ev, ev.source_slug as EventSource));
}
log(`hub → landau: ${candidates.length} kept`);

const merged = mergeAndId(candidates);
merged.sort(eventSort);

await stage("geocode", () => geocodeAll(merged));
await writeBundle(merged);

const elapsed = ((Date.now() - startMain) / 1000).toFixed(1);
log(`done in ${elapsed}s — wrote ${merged.length} events to ${dataPath}`);

// ─── helpers ────────────────────────────────────────────────────────

function toLocalEvent(ev: CanonicalEvent, source: EventSource): Omit<Event, "id"> {
  const category = pickCategory(ev);
  return {
    source,
    source_uid: ev.source_event_id,
    title: ev.title,
    date: ev.date,
    ...(ev.time ? { time: ev.time } : {}),
    ...(ev.end_date ? { end_date: ev.end_date } : {}),
    ...(ev.end_time ? { end_time: ev.end_time } : {}),
    category,
    ...(ev.venue_room ? { venue: ev.venue_room } : {}),
    ...(ev.city ? { city: ev.city } : {}),
    ...(ev.performers ? { organizer: ev.performers } : {}),
    ...(ev.description ? { description: ev.description } : {}),
    detail_url: ev.detail_url ?? "",
    ...(ev.image_url ? { image_url: ev.image_url } : {}),
    ...(ev.price_min != null ? { price: `${ev.price_min} €` } : {}),
  };
}

function pickCategory(ev: CanonicalEvent): string {
  let best: { category: string; confidence: number } | null = null;
  for (const l of ev.labels) {
    if (!l.label.startsWith("landau:")) continue;
    const tail = l.label.slice("landau:".length);
    if (!best || l.confidence > best.confidence) best = { category: tail, confidence: l.confidence };
  }
  return best?.category ?? "sonstiges";
}

async function stage<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  log(`▶ ${label}`);
  try {
    const result = await fn();
    const ms = Date.now() - t0;
    if (Array.isArray(result)) log(`  ${label} → ${result.length} items (${ms}ms)`);
    else log(`  ${label} ok (${ms}ms)`);
    return result;
  } catch (err) {
    log(`  ${label} FAILED: ${(err as Error).message}`);
    throw err;
  }
}

/**
 * Four-pass dedup. The same event surfaces in different shapes across
 * sources, so we try increasingly tolerant matches:
 *
 * Pass 1: bit-identical submissions — group by (date, strict-normalised
 *         title). E.g., the same press release ingested by both
 *         Kulturnetz and the city calendar.
 * Pass 2: prefix collapse — group by (date, "core" title). Catches the
 *         common SÜW pattern of prefixing a venue or series name to the
 *         title, e.g., "atelier29: Thalamus" vs Kulturnetz's "Thalamus".
 * Pass 3: multi-day vs per-occurrence — landau.de records a long-running
 *         Ausstellung once with `end_date`, while SÜW emits one record
 *         per day. We drop the single-day records whose title matches a
 *         multi-day record covering the same date.
 * Pass 4: title-prefix overlap on same (date, time) — one source uses
 *         the title only, another appends "- Subtitle" with extra detail.
 *         Drop the longer-titled duplicate and keep the canonical short
 *         form; merge end_time / image_url / city up if missing.
 *
 * Within each group the lowest-ranked source wins (see SOURCE_RANK).
 */
function mergeAndId(events: Omit<Event, "id">[]): Event[] {
  const stamped: Event[] = events.map((ev) => ({ ...ev, id: fnv1aInt(`${ev.source}|${ev.source_uid}`) }));
  const byKey = new Map<string, Event>();
  for (const ev of stamped) {
    const key = `${ev.date}|${normalizeTitle(ev.title)}`;
    const existing = byKey.get(key);
    if (!existing || SOURCE_RANK[ev.source] < SOURCE_RANK[existing.source]) {
      byKey.set(key, ev);
    }
  }
  const byCore = new Map<string, Event>();
  for (const ev of byKey.values()) {
    const core = coreTitle(ev.title);
    const key = `${ev.date}|${core}`;
    const existing = byCore.get(key);
    if (!existing) {
      byCore.set(key, ev);
      continue;
    }
    const evShorter = ev.title.length < existing.title.length;
    const sameRank = SOURCE_RANK[ev.source] === SOURCE_RANK[existing.source];
    const evWinsByRank = SOURCE_RANK[ev.source] < SOURCE_RANK[existing.source];
    if (evWinsByRank || (sameRank && evShorter)) {
      byCore.set(key, ev);
    }
  }
  const afterMultiDay = collapseMultiDayDuplicates([...byCore.values()]);
  return collapseTitlePrefixDuplicates(afterMultiDay);
}

function collapseTitlePrefixDuplicates(events: Event[]): Event[] {
  const groups = new Map<string, Event[]>();
  for (const ev of events) {
    const key = `${ev.date}|${ev.time ?? ""}`;
    const list = groups.get(key);
    if (list) list.push(ev);
    else groups.set(key, [ev]);
  }
  const dropped = new Set<number>();
  const merged = new Map<number, Event>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.title.length - b.title.length);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const shorter = sorted[i];
        const longer = sorted[j];
        if (dropped.has(longer.id) || dropped.has(shorter.id)) continue;
        if (!isTitlePrefixOf(shorter.title, longer.title)) continue;
        const enriched = mergeMissingFields(merged.get(shorter.id) ?? shorter, longer);
        merged.set(shorter.id, enriched);
        dropped.add(longer.id);
      }
    }
  }
  return events.filter((ev) => !dropped.has(ev.id)).map((ev) => merged.get(ev.id) ?? ev);
}

function isTitlePrefixOf(short: string, long: string): boolean {
  const s = normalizeTitle(short);
  const l = normalizeTitle(long);
  if (s.length === 0 || l.length === 0 || s.length >= l.length) return false;
  if (!l.startsWith(s)) return false;
  const next = l[s.length];
  return next === " ";
}

function mergeMissingFields(base: Event, extra: Event): Event {
  const out = { ...base };
  if (!out.end_time && extra.end_time) out.end_time = extra.end_time;
  if (!out.end_date && extra.end_date) out.end_date = extra.end_date;
  if (!out.image_url && extra.image_url) out.image_url = extra.image_url;
  if (!out.city && extra.city) out.city = extra.city;
  if (!out.organizer && extra.organizer) out.organizer = extra.organizer;
  if (!out.price && extra.price) out.price = extra.price;
  if (!out.description && extra.description) out.description = extra.description;
  return out;
}

function collapseMultiDayDuplicates(events: Event[]): Event[] {
  const multiDayByTitle = new Map<string, Event[]>();
  for (const ev of events) {
    if (!ev.end_date || ev.end_date <= ev.date) continue;
    const key = coreTitle(ev.title);
    const list = multiDayByTitle.get(key);
    if (list) list.push(ev);
    else multiDayByTitle.set(key, [ev]);
  }
  if (multiDayByTitle.size === 0) return events;
  return events.filter((ev) => {
    if (ev.end_date && ev.end_date > ev.date) return true;
    const list = multiDayByTitle.get(coreTitle(ev.title));
    if (!list) return true;
    for (const md of list) {
      if (md.id === ev.id) return true;
      const mdEnd = md.end_date ?? md.date;
      if (md.date <= ev.date && ev.date <= mdEnd) return false;
    }
    return true;
  });
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/["„""»«]/g, "")
    .replace(/[^a-z0-9äöüß\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coreTitle(s: string): string {
  const m = s.match(/^([\p{L}\d ]{2,30})\s*[:—–-]\s+(.+)$/u);
  if (m) return normalizeTitle(m[2]);
  return normalizeTitle(s);
}

// ─── geocoding ──────────────────────────────────────────────────────

interface GeocodeResult {
  lat: number;
  lng: number;
}

async function geocodeAll(events: Event[]): Promise<void> {
  const cache = { ...GEOCODE_CACHE };
  let cacheHitCount = 0;
  const seen = new Set<string>();
  const newQueries: { key: string; venue: string; city: string }[] = [];

  for (const ev of events) {
    if (!ev.venue) continue;
    const key = cacheKey(ev.venue, ev.city);
    if (cache[key]) {
      cacheHitCount++;
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    newQueries.push({ key, venue: ev.venue, city: ev.city ?? "Landau in der Pfalz" });
  }

  log(`  geocode cache: ${cacheHitCount} hit, ${newQueries.length} to fetch`);

  for (let i = 0; i < newQueries.length; i++) {
    if (i > 0) await sleep(NOMINATIM_DELAY_MS);
    const q = newQueries[i];
    const result = await geocodeOne(q.venue, q.city);
    cache[q.key] = result ? [round6(result.lat), round6(result.lng)] : [0, 0];
  }

  for (const ev of events) {
    if (!ev.venue) continue;
    const coords = cache[cacheKey(ev.venue, ev.city)];
    if (!coords || (coords[0] === 0 && coords[1] === 0)) continue;
    ev.lat = coords[0];
    ev.lng = coords[1];
  }
  await writeGeocodeCache(cache);
}

async function geocodeOne(venue: string, city: string): Promise<GeocodeResult | null> {
  const queries = [`${venue}, ${city}, Deutschland`, `${city}, Deutschland`];
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(NOMINATIM_DELAY_MS);
    const q = queries[i];
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=de`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_USER_AGENT } });
      if (!res.ok) {
        log(`  nominatim ${res.status} for "${q}"`);
        continue;
      }
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data.length === 0) continue;
      const lat = Number(data[0].lat);
      const lng = Number(data[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      return { lat, lng };
    } catch (err) {
      log(`  nominatim error for "${q}": ${(err as Error).message}`);
    }
  }
  return null;
}

function cacheKey(venue: string, city?: string): string {
  return `${venue.toLowerCase().trim()}|${(city ?? "").toLowerCase().trim()}`;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function writeGeocodeCache(cache: Record<string, [number, number]>): Promise<void> {
  const entries = Object.keys(cache)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: [${cache[k][0]}, ${cache[k][1]}],`);
  const lines = [
    "/* AUTO-GENERATED by scripts/scrape.ts — do not edit by hand. */",
    "",
    "/**",
    ' * Persistent geocode cache: normalised "<venue>|<city>" → [lat, lng].',
    " *",
    " * Geocoding runs against OSM Nominatim, which is free but rate-limited",
    " * (1 req/s). We cache results across scrape runs so a daily run only",
    " * geocodes net-new venues. A [0, 0] tombstone marks venues Nominatim",
    " * couldn't resolve so we don't keep retrying.",
    " */",
    "export const GEOCODE_CACHE: Record<string, [number, number]> = {",
    ...entries,
    "};",
    "",
  ];
  await writeFile(geocodeCachePath, lines.join("\n"), "utf8");
}

function eventSort(a: Event, b: Event): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
    a.title.localeCompare(b.title, "de")
  );
}

async function writeBundle(events: Event[]): Promise<void> {
  const data: ScrapeData = { events, generatedAt: new Date().toISOString() };
  const lines: string[] = [
    "/* AUTO-GENERATED by scripts/scrape.ts — do not edit by hand. */",
    `import type { ScrapeData } from "./types";`,
    "",
    "export const SCRAPE_DATA: ScrapeData = {",
    bundleSection("events", events as unknown as Record<string, unknown>[]),
    `  generatedAt: ${JSON.stringify(data.generatedAt)},`,
    "};",
    "",
  ];
  await writeFile(dataPath, lines.join("\n"), "utf8");
}

function log(msg: string): void {
  console.error(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}
