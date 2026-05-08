#!/usr/bin/env bun
/**
 * Drives the museums scrape pipeline as a linear sequence of pure
 * functions and writes the result to src/scrape-data.ts. No D1, no
 * Cloudflare runtime, no SCRAPE_SECRET. Designed for the GitHub Action.
 *
 *   1. scrape()                      — museumsufer.de directory + manual list
 *                                       + Wikipedia images + exhibition descs
 *   2. scrapeMuseumExhibitions()     — per-museum exhibition APIs (only for
 *                                       museums whose exhibitions weren't in
 *                                       the directory result)
 *   3. scrapeMuseumWebsites()        — per-museum event APIs + 7-day enrichment
 *   4. translateEvents()             — DeepL en/fr (only for new strings)
 *
 * Stable IDs are FNV-1a hashes of (museum_slug | title | …) so likes/deep-link
 * URLs survive across runs. The previous bundle is loaded once and used as
 * the seed/cache for sticky fields and DeepL hit-or-miss.
 */
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSection, fnv1aInt, todayIso } from "@museumsufer/core";
import { scrapeMuseumWebsites } from "../src/event-scraper";
import { scrapeMuseumExhibitions } from "../src/exhibition-scraper";
import { type ParsedExhibition, type ParsedMuseum, scrape } from "../src/scraper";
import { translateEvents } from "../src/translate";
import type { Event, Exhibition, Museum, ScrapeData, Translation } from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dataPath = resolve(root, "src/scrape-data.ts");

// Hoisted above the top-level await so `buildScrapeData()` sees them
// initialised — `const` is in TDZ at module-eval start, `function` is not.
const CLOSURE_KEYWORDS = /geschlossen|feiertag|holiday|closed|fermeture|ruhetag/i;

const previous = await loadPreviousBundle(dataPath);
log(
  `seeded from previous bundle: ${previous.museums.length} museums · ${previous.exhibitions.length} exhibitions · ${previous.events.length} events · ${previous.translations.length} translations`,
);

const proxy = process.env.FETCH_PROXY_URL
  ? { url: process.env.FETCH_PROXY_URL, token: process.env.FETCH_PROXY_TOKEN }
  : undefined;

const startMain = Date.now();
const directory = await stage("scrape (museumsufer.de)", () =>
  scrape({
    previous: {
      museums: previous.museums.map(toParsedMuseum),
      exhibitions: previous.exhibitions.map(toParsedExhibition),
    },
  }),
);
const museumsByEslug = new Map<string, ParsedMuseum>(directory.museums.map((m) => [m.slug, m]));

const apiExhibitions = await stage("scrapeMuseumExhibitions", () =>
  scrapeMuseumExhibitions(museumsByEslug, directory.exhibitions, { proxy }),
);
const allExhibitions = [...directory.exhibitions, ...apiExhibitions];

const events = await stage("scrapeMuseumWebsites", () =>
  scrapeMuseumWebsites(museumsByEslug, {
    previous: {
      museums: previous.museums.map(toParsedMuseum),
      events: previous.events.map((e) => ({
        museum_slug: slugFromMuseumId(e.museum_id, previous.museums),
        title: e.title,
        date: e.date,
        time: e.time ?? null,
        end_time: e.end_time ?? null,
        end_date: e.end_date ?? null,
        description: e.description ?? null,
        url: e.url ?? null,
        detail_url: e.detail_url ?? null,
        image_url: e.image_url ?? null,
        price: e.price ?? null,
        category: e.category ?? null,
      })),
    },
    proxy,
  }),
);

const translations = await stage("translateEvents", () =>
  translateEvents({
    events,
    exhibitions: allExhibitions,
    museums: [...museumsByEslug.values()],
    existing: previous.translations,
    apiKeys: process.env.DEEPL_API_KEYS,
  }),
);

const data = buildScrapeData({
  museums: [...museumsByEslug.values()],
  exhibitions: allExhibitions,
  events,
  translations,
});

await writeFile(dataPath, generateModule(data), "utf8");
log(
  `wrote scrape-data.ts in ${Date.now() - startMain}ms — ${data.museums.length} museums · ${data.exhibitions.length} exhibitions · ${data.events.length} events · ${data.translations.length} translations`,
);

// ─── helpers ──────────────────────────────────────────────────────────

function buildScrapeData(input: {
  museums: ParsedMuseum[];
  exhibitions: ParsedExhibition[];
  events: import("../src/event-scraper").ScrapedEvent[];
  translations: Translation[];
}): ScrapeData {
  // Stable IDs: hash slug-keyed composites so URL-anchored likes survive
  // across runs.
  const museumIdBySlug = new Map<string, number>();
  const museums: Museum[] = input.museums
    .map((m) => {
      const id = fnv1aInt(m.slug);
      museumIdBySlug.set(m.slug, id);
      return {
        id,
        name: m.name,
        slug: m.slug,
        museumsufer_url: m.museumsufer_url,
        ...(m.website_url ? { website_url: m.website_url } : {}),
        ...(m.description ? { description: m.description } : {}),
        ...(m.image_url ? { image_url: m.image_url } : {}),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  // Drop past exhibitions and ones starting more than 90 days out;
  // fuzzy-dedup by title within the same museum (handles trailing-
  // punctuation / whitespace divergence between museumsufer.de and
  // museum-API copies of the same exhibition).
  const today = todayIso();
  const horizon = addDays(today, 90);
  const exhibitionsRaw: Exhibition[] = [];
  for (const ex of input.exhibitions) {
    if (ex.end_date && ex.end_date < today) continue;
    if (ex.start_date && ex.start_date > horizon) continue;
    const museumId = museumIdBySlug.get(ex.museum_slug);
    if (!museumId) continue;
    const id = fnv1aInt(`${ex.museum_slug}|${ex.title}`);
    exhibitionsRaw.push({
      id,
      museum_id: museumId,
      title: ex.title,
      ...(ex.start_date ? { start_date: ex.start_date } : {}),
      ...(ex.end_date ? { end_date: ex.end_date } : {}),
      ...(ex.description ? { description: ex.description } : {}),
      ...(ex.image_url ? { image_url: ex.image_url } : {}),
      ...(ex.detail_url ? { detail_url: ex.detail_url } : {}),
    });
  }
  const exhibitions = deduplicateByTitle(exhibitionsRaw).sort(
    (a, b) =>
      (a.start_date ?? "").localeCompare(b.start_date ?? "") ||
      a.museum_id - b.museum_id ||
      a.title.localeCompare(b.title),
  );

  // Drop events outside the [yesterday, today + 90d] window + closure
  // entries (museum opening-hours pages occasionally surface as
  // "Geschlossen" events).
  const yesterday = addDays(today, -1);
  const eventsRaw: Event[] = [];
  for (const ev of input.events) {
    if (ev.date < yesterday) continue;
    if (ev.date > horizon) continue;
    if (CLOSURE_KEYWORDS.test(ev.title)) continue;
    const museumId = museumIdBySlug.get(ev.museum_slug);
    if (!museumId) continue;
    const id = fnv1aInt(`${ev.museum_slug}|${ev.title}|${ev.date}|${ev.time ?? ""}`);
    eventsRaw.push({
      id,
      museum_id: museumId,
      title: ev.title,
      date: ev.date,
      ...(ev.time ? { time: ev.time } : {}),
      ...(ev.end_time ? { end_time: ev.end_time } : {}),
      ...(ev.end_date ? { end_date: ev.end_date } : {}),
      ...(ev.description ? { description: ev.description } : {}),
      ...(ev.url ? { url: ev.url } : {}),
      ...(ev.detail_url ? { detail_url: ev.detail_url } : {}),
      ...(ev.image_url ? { image_url: ev.image_url } : {}),
      ...(ev.price ? { price: ev.price } : {}),
      ...(ev.category ? { category: ev.category } : {}),
    });
  }
  // Two-pass dedup mirrors the previous read-time logic: pass 1 collapses
  // events with the same museum + normalized title; pass 2 collapses
  // same-museum same-time entries whose titles share all significant
  // words (e.g. "Workshop für Kinder" vs "Workshop für Kinder!").
  const events = deduplicateEvents(deduplicateByTitle(eventsRaw)).sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.museum_id - b.museum_id ||
      a.title.localeCompare(b.title),
  );

  // Prune translations whose source_text no longer appears in the output.
  const livingTexts = new Set<string>();
  for (const m of museums) if (m.description) livingTexts.add(m.description);
  for (const ex of exhibitions) {
    if (ex.title) livingTexts.add(ex.title);
    if (ex.description) livingTexts.add(ex.description);
  }
  for (const ev of events) {
    if (ev.title) livingTexts.add(ev.title);
    if (ev.description) livingTexts.add(ev.description);
  }
  const translations = input.translations
    .filter((t) => livingTexts.has(t.source_text))
    .sort((a, b) => a.source_hash.localeCompare(b.source_hash) || a.target_lang.localeCompare(b.target_lang));

  return { museums, exhibitions, events, translations };
}

function normalizeForDedup(title: string): string {
  return title
    .toLowerCase()
    .replace(/[:.,;!?()[\]{}""„"''‚'«»‹›]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** O(n) collapse of items sharing a `(museum_id, normalized title)` key —
 *  keeps the highest-id item per group. Replaces the read-time fuzzy
 *  dedup that used to walk the result array on every request. */
function deduplicateByTitle<T extends { museum_id: number; title: string; id: number }>(items: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = `${item.museum_id}|${normalizeForDedup(item.title)}`;
    const existing = byKey.get(key);
    if (!existing || item.id > existing.id) byKey.set(key, item);
  }
  return [...byKey.values()];
}

/** Cross-feed dedup: same museum + same time + sufficiently overlapping
 *  titles collapse into the highest-id row. This is O(n²) on the same-time
 *  partition only (events sharing a single timestamp at one museum) — at
 *  museumsufer's scale that's typically <5 candidates per partition. */
function deduplicateEvents<T extends { museum_id: number; title: string; id: number; time?: string | null }>(
  events: T[],
): T[] {
  // Pre-normalise once.
  const annotated = events.map((ev) => ({ ev, words: significantWords(ev.title) }));

  // Index by (museum_id, time) so the inner overlap-check only scans the
  // small same-bucket partition.
  const buckets = new Map<string, typeof annotated>();
  const passthrough: T[] = [];
  for (const a of annotated) {
    if (!a.ev.time) {
      passthrough.push(a.ev);
      continue;
    }
    const key = `${a.ev.museum_id}|${a.ev.time}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(a);
    else buckets.set(key, [a]);
  }

  const out: T[] = [...passthrough];
  for (const bucket of buckets.values()) {
    const kept: typeof bucket = [];
    for (const a of bucket) {
      const dupeIdx = kept.findIndex((b) => wordsOverlapPrenormalised(a.words, b.words));
      if (dupeIdx === -1) kept.push(a);
      else if (a.ev.id > kept[dupeIdx].ev.id) kept[dupeIdx] = a;
    }
    for (const a of kept) out.push(a.ev);
  }
  return out;
}

function significantWords(title: string): string[] {
  return normalizeForDedup(title)
    .split(" ")
    .filter((w) => w.length > 2);
}

function wordsOverlapPrenormalised(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const longerSet = new Set(longer);
  return shorter.every((w) => longerSet.has(w));
}

async function loadPreviousBundle(path: string): Promise<ScrapeData> {
  if (!existsSync(path)) {
    return { museums: [], exhibitions: [], events: [], translations: [] };
  }
  const mod = (await import(path)) as { SCRAPE_DATA?: ScrapeData };
  return mod.SCRAPE_DATA ?? { museums: [], exhibitions: [], events: [], translations: [] };
}

function toParsedMuseum(m: Museum): ParsedMuseum {
  return {
    slug: m.slug,
    name: m.name,
    museumsufer_url: m.museumsufer_url,
    description: m.description ?? null,
    image_url: m.image_url ?? null,
    website_url: m.website_url ?? null,
  };
}

function toParsedExhibition(ex: Exhibition): ParsedExhibition {
  // The previous bundle stored museum_id (numeric hash). The script
  // doesn't need to round-trip the slug for sticky-description reuse —
  // matching is done by detail_url, so leave museum_slug blank.
  return {
    museum_slug: "",
    title: ex.title,
    start_date: ex.start_date ?? null,
    end_date: ex.end_date ?? null,
    description: ex.description ?? null,
    image_url: ex.image_url ?? null,
    detail_url: ex.detail_url ?? "",
  };
}

function slugFromMuseumId(museumId: number, museums: Museum[]): string {
  for (const m of museums) {
    if (m.id === museumId) return m.slug;
  }
  return "";
}

function generateModule(data: ScrapeData): string {
  return `// Auto-generated by scripts/scrape.ts — do not edit by hand.
import type { ScrapeData } from "./types";

export const SCRAPE_DATA: ScrapeData = {
${bundleSection("museums", data.museums)}
${bundleSection("exhibitions", data.exhibitions)}
${bundleSection("events", data.events)}
${bundleSection("translations", data.translations)}
};
`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function log(msg: string): void {
  process.stderr.write(`[scrape] ${msg}\n`);
}

async function stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log(`${name} — ok (${Date.now() - start}ms)`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`${name} — FAIL: ${msg}`);
    throw err;
  }
}
