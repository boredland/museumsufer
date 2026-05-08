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
import { fnv1aInt } from "@museumsufer/core";
import { scrapeMuseumWebsites } from "../src/event-scraper";
import { scrapeMuseumExhibitions } from "../src/exhibition-scraper";
import { type ParsedExhibition, type ParsedMuseum, scrape } from "../src/scraper";
import { translateEvents } from "../src/translate";
import type { Event, Exhibition, Museum, ScrapeData, Translation } from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dataPath = resolve(root, "src/scrape-data.ts");

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

  // Drop past exhibitions early.
  const today = todayIso();
  const seenExhibition = new Set<string>();
  const exhibitions: Exhibition[] = [];
  for (const ex of input.exhibitions) {
    if (ex.end_date && ex.end_date < today) continue;
    const museumId = museumIdBySlug.get(ex.museum_slug);
    if (!museumId) continue;
    const dedupKey = `${ex.museum_slug}|${ex.title.toLowerCase().trim()}`;
    if (seenExhibition.has(dedupKey)) continue;
    seenExhibition.add(dedupKey);
    const id = fnv1aInt(`${ex.museum_slug}|${ex.title}`);
    exhibitions.push({
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
  exhibitions.sort(
    (a, b) =>
      (a.start_date ?? "").localeCompare(b.start_date ?? "") ||
      a.museum_id - b.museum_id ||
      a.title.localeCompare(b.title),
  );

  // Drop events older than yesterday.
  const yesterday = addDays(today, -1);
  const seenEvent = new Set<string>();
  const eventList: Event[] = [];
  for (const ev of input.events) {
    if (ev.date < yesterday) continue;
    const museumId = museumIdBySlug.get(ev.museum_slug);
    if (!museumId) continue;
    const dedupKey = `${ev.museum_slug}|${ev.title.toLowerCase().trim()}|${ev.date}`;
    if (seenEvent.has(dedupKey)) continue;
    seenEvent.add(dedupKey);
    const id = fnv1aInt(`${ev.museum_slug}|${ev.title}|${ev.date}|${ev.time ?? ""}`);
    eventList.push({
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
  eventList.sort(
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
  for (const ev of eventList) {
    if (ev.title) livingTexts.add(ev.title);
    if (ev.description) livingTexts.add(ev.description);
  }
  const translations = input.translations
    .filter((t) => livingTexts.has(t.source_text))
    .sort((a, b) => a.source_hash.localeCompare(b.source_hash) || a.target_lang.localeCompare(b.target_lang));

  return { museums, exhibitions, events: eventList, translations };
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
  const opts = { stripNulls: true };
  const museumsJson = data.museums.map((m) => stringifyRecord(m, opts)).join(",\n    ");
  const exhibitionsJson = data.exhibitions.map((e) => stringifyRecord(e, opts)).join(",\n    ");
  const eventsJson = data.events.map((e) => stringifyRecord(e, opts)).join(",\n    ");
  const translationsJson = data.translations.map((t) => stringifyRecord(t, opts)).join(",\n    ");
  return `// Auto-generated by scripts/scrape.ts — do not edit by hand.
import type { ScrapeData } from "./types";

export const SCRAPE_DATA: ScrapeData = {
  museums: [
    ${museumsJson}
  ],
  exhibitions: [
    ${exhibitionsJson}
  ],
  events: [
    ${eventsJson}
  ],
  translations: [
    ${translationsJson}
  ],
};
`;
}

function stringifyRecord(record: Record<string, unknown>, opts?: { stripNulls?: boolean }): string {
  const entries = Object.entries(record)
    .filter(([, v]) => {
      if (v === undefined) return false;
      if (opts?.stripNulls && v === null) return false;
      return true;
    })
    .sort(([a], [b]) => a.localeCompare(b));
  const parts = entries.map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`);
  return `{${parts.join(",")}}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
