#!/usr/bin/env bun
/**
 * landau.today scrape pipeline. Drives all source scrapers in parallel
 * and writes a typed `src/scrape-data.ts` bundle. Designed for the GitHub
 * Action and for local one-off runs.
 *
 *   1. scrapeKulturnetz()        — kulturnetz-landau.de (Django, schema.org microdata)
 *   2. scrapeLandauDe()          — www.landau.de (Advantic CMS, ICS feed + HTML cards)
 *   3. scrapeHambacherSchloss()  — hambacher-schloss.de (WP / MEC RSS)
 *   4. scrapeRptu()              — rptu.de (university RSS, Landau-filtered)
 *   5. scrapeSuew()              — suedlicheweinstrasse.de (TYPO3 sfcontenthub)
 *
 * Stable ids are FNV-1a hashes of `(source | source_uid)`. Past events are
 * pruned at scrape time so the worker never has to.
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSection, fnv1aInt, todayIso } from "@museumsufer/core";
import { scrapeHambacherSchloss } from "../src/scrapers/hambacher-schloss";
import { scrapeKulturnetz } from "../src/scrapers/kulturnetz";
import { scrapeLandauDe } from "../src/scrapers/landau-de";
import { scrapePfalzDe } from "../src/scrapers/pfalz-de";
import { scrapeRptu } from "../src/scrapers/rptu";
import { scrapeSuew } from "../src/scrapers/suew";
import type { Event, ScrapeData } from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dataPath = resolve(root, "src/scrape-data.ts");

/** Source priority for cross-source dedup. Lower wins. Kulturnetz first
 *  because its categorisation is most reliable; landau.de second because
 *  its ICS feed has the cleanest time data. Defined here (above the
 *  top-level call to `mergeAndId`) to avoid TDZ — `const` bindings are
 *  hoisted lexically but not initialised. */
const SOURCE_RANK: Record<Event["source"], number> = {
  kulturnetz: 0,
  "landau-de": 1,
  "hambacher-schloss": 2,
  "rptu-campuskultur": 3,
  suew: 4,
  "pfalz-de": 5,
  stiftskirche: 6,
};

const startMain = Date.now();

const [knl, lde, hbs, rptu, suew, pfalz] = await Promise.all([
  stage("kulturnetz", () => scrapeKulturnetz()),
  stage("landau.de", () => scrapeLandauDe()),
  stage("hambacher-schloss", () => scrapeHambacherSchloss()),
  stage("rptu", () => scrapeRptu()),
  stage("suew", () => scrapeSuew()),
  stage("pfalz-de", () => scrapePfalzDe()),
]);

const merged = mergeAndId([...knl, ...lde, ...hbs, ...rptu, ...suew, ...pfalz]);
const today = todayIso();
const future = merged.filter((ev) => (ev.end_date ?? ev.date) >= today);
future.sort(eventSort);

await writeBundle(future);

const elapsed = ((Date.now() - startMain) / 1000).toFixed(1);
log(`done in ${elapsed}s — wrote ${future.length} events to ${dataPath}`);

// ─── helpers ────────────────────────────────────────────────────────

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

function mergeAndId(events: Omit<Event, "id">[]): Event[] {
  // Four-pass dedup. The same event surfaces in different shapes across
  // sources, so we try increasingly tolerant matches:
  //
  // Pass 1: bit-identical submissions — group by (date, strict-normalised
  //         title). E.g., the same press release ingested by both
  //         Kulturnetz and the city calendar.
  // Pass 2: prefix collapse — group by (date, "core" title). Catches the
  //         common SÜW pattern of prefixing a venue or series name to the
  //         title, e.g., "atelier29: Thalamus" vs Kulturnetz's "Thalamus".
  // Pass 3: multi-day vs per-occurrence — landau.de records a long-running
  //         Ausstellung once with `end_date`, while SÜW emits one record
  //         per day. We drop the single-day records whose title matches a
  //         multi-day record covering the same date.
  // Pass 4: title-prefix overlap on same (date, time) — one source uses
  //         the title only, another appends "- Subtitle" with extra detail.
  //         Drop the longer-titled duplicate and keep the canonical short
  //         form; merge end_time / image_url / city up if missing.
  //
  // Within each group the lowest-ranked source wins (see SOURCE_RANK).
  const stamped = events.map((ev) => ({ ...ev, id: fnv1aInt(`${ev.source}|${ev.source_uid}`) }));
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
    // Prefer the shorter title (likely "X" over "Venue: X"); break ties by source rank.
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

/** Pass 4: when two events share the same date AND time AND one's
 *  normalised title is a strict prefix of the other's, treat them as the
 *  same event. The shorter title is canonical (e.g., Kulturnetz's
 *  "Dialog statt Rache" vs landau.de's "Dialog statt Rache - Eine
 *  Israelin und eine Palästinenserin in Trauer …"); merge missing
 *  end_time / image_url / city / description from the longer record so
 *  no upstream detail is lost. */
function collapseTitlePrefixDuplicates(events: Event[]): Event[] {
  // Group by (date, time?). No time → treat as "all-day" bucket.
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
    // Sort shortest title first so prefix checks run from canonical → variant.
    const sorted = [...list].sort((a, b) => a.title.length - b.title.length);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const shorter = sorted[i];
        const longer = sorted[j];
        if (dropped.has(longer.id) || dropped.has(shorter.id)) continue;
        if (!isTitlePrefixOf(shorter.title, longer.title)) continue;
        // Keep the shorter; merge any field the shorter is missing from the
        // longer. Mutating the value in-map keeps the iteration stable.
        const enriched = mergeMissingFields(merged.get(shorter.id) ?? shorter, longer);
        merged.set(shorter.id, enriched);
        dropped.add(longer.id);
      }
    }
  }
  return events.filter((ev) => !dropped.has(ev.id)).map((ev) => merged.get(ev.id) ?? ev);
}

/** True when normalize(short) is a strict prefix of normalize(long) AND
 *  the long has at least one extra word. Avoids merging unrelated events
 *  whose titles happen to start with the same word. */
function isTitlePrefixOf(short: string, long: string): boolean {
  const s = normalizeTitle(short);
  const l = normalizeTitle(long);
  if (s.length === 0 || l.length === 0 || s.length >= l.length) return false;
  if (!l.startsWith(s)) return false;
  // Demand a word boundary right after the short title; "abend" must not
  // match "abendlich".
  const next = l[s.length];
  return next === " ";
}

/** Copy `extra` fields onto `base` only when `base` has them undefined.
 *  We never overwrite — the canonical short-titled record stays in charge
 *  of its primary fields. */
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

/** When a multi-day event (with `end_date`) and a per-day event share the
 *  same core title and the per-day event falls within the multi-day range,
 *  drop the per-day duplicate — the multi-day record already lights the
 *  per-day strip via queries.ts:eventCoversDate. */
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

/** Strip a leading "Venue:" / "Series —" prefix so cross-source dedup can
 *  collapse the two title variants that show up when a venue prefixes its
 *  own programming on the SÜW listing (e.g., "atelier29: Thalamus" vs
 *  "Thalamus"). The prefix-strip runs on the raw string BEFORE
 *  normalisation, otherwise the normaliser flattens `:` → space and the
 *  regex can't anchor on it. */
function coreTitle(s: string): string {
  const m = s.match(/^([\p{L}\d ]{2,30})\s*[:—–-]\s+(.+)$/u);
  if (m) return normalizeTitle(m[2]);
  return normalizeTitle(s);
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
