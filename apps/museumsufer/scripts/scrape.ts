#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSection } from "@museumsufer/core/bundle-writer";
import { CITIES, servesCity } from "@museumsufer/core/cities";
import { todayIso } from "@museumsufer/core/date";
import { fnv1aInt } from "@museumsufer/core/hash";
import { type CanonicalEvent, cityOf, EVENTS } from "@museumsufer/event-hub";
import { type ParsedExhibition, type ParsedMuseum, scrape } from "../src/scraper";
import type { Event, Exhibition, Museum, ScrapeData } from "../src/types";
import { translateTexts } from "./translate";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dataPath = resolve(root, "src/scrape-data.ts");

const CLOSURE_KEYWORDS = /geschlossen|feiertag|holiday|closed|fermeture|ruhetag/i;

const previous = await loadPreviousBundle(dataPath);
log(
  `seeded from previous bundle: ${previous.museums.length} museums · ${previous.exhibitions.length} exhibitions · ${previous.events.length} events · ${previous.translations.length} translations`,
);

const startMain = Date.now();
const directory = await stage("directory (frozen meta)", () => scrape());
const museumsBySlug = new Map<string, ParsedMuseum>(directory.museums.map((m) => [m.slug, m]));

const hubEvents: CanonicalEvent[] = [];
const hubExhibitions: ParsedExhibition[] = [];
for (const ev of EVENTS) {
  if (!cityOf(ev)) continue;
  if (!hasMuseumLabel(ev)) continue;
  if (isHubExhibition(ev)) {
    hubExhibitions.push(toParsedExhibitionFromHub(ev));
  } else {
    hubEvents.push(ev);
  }
}
log(
  `hub → museums: ${hubEvents.length} events, ${hubExhibitions.length} exhibitions for ${museumsBySlug.size} museums`,
);

const allExhibitions = [...directory.exhibitions, ...hubExhibitions];

const data = buildScrapeData({
  museums: [...museumsBySlug.values()],
  exhibitions: allExhibitions,
  events: hubEvents,
});

// Translate after building: only texts that survive the horizon, dedup and
// closure filters reach the bundle, and translations for anything else would
// be pruned below and re-bought on every run.
const livingTexts = collectLivingTexts(data);
const deepl =
  process.env.DEEPL_URL && process.env.DEEPL_TOKEN
    ? { url: process.env.DEEPL_URL, token: process.env.DEEPL_TOKEN }
    : null;
const translations = await stage("translateTexts", () =>
  translateTexts({ texts: livingTexts, existing: previous.translations, deepl }),
);
data.translations = translations
  .filter((t) => livingTexts.has(t.source_text))
  .sort((a, b) => a.source_hash.localeCompare(b.source_hash) || a.target_lang.localeCompare(b.target_lang));

await writeFile(dataPath, generateModule(data), "utf8");
log(
  `wrote scrape-data.ts in ${Date.now() - startMain}ms — ${data.museums.length} museums · ${data.exhibitions.length} exhibitions · ${data.events.length} events · ${data.translations.length} translations`,
);

function hasMuseumLabel(ev: CanonicalEvent): boolean {
  return ev.labels.some((l) => l.label.startsWith("museum:"));
}

function isHubExhibition(ev: CanonicalEvent): boolean {
  return ev.labels.some((l) => l.label === "museum:ausstellung");
}

function toParsedExhibitionFromHub(ev: CanonicalEvent): ParsedExhibition {
  return {
    museum_slug: ev.source_slug,
    title: ev.title,
    start_date: ev.date,
    end_date: ev.end_date ?? null,
    description: ev.description ?? null,
    image_url: ev.image_url ?? null,
    detail_url: ev.detail_url ?? "",
  };
}

/** Recover the original event category from the museum:* label that the
 *  orchestrator attaches to every museum-hosted event. */
function pickMuseumCategory(ev: CanonicalEvent): string | null {
  for (const l of ev.labels) {
    switch (l.label) {
      case "museum:vortrag":
        return "Vortrag";
      case "museum:konzert":
        return "Konzert";
      case "museum:fuehrung":
        return "Führung";
      case "museum:workshop":
        return "Workshop";
      case "museum:vernissage":
        return "Vernissage";
      case "museum:familie":
        return "Familie";
      case "museum:film":
        return "Film";
    }
  }
  return null;
}

// ─── helpers ──────────────────────────────────────────────────────────

function buildScrapeData(input: {
  museums: ParsedMuseum[];
  exhibitions: ParsedExhibition[];
  events: CanonicalEvent[];
}): ScrapeData {
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
        ...(m.city && m.city !== "frankfurt" ? { city: m.city } : {}),
        ...(m.website_url ? { website_url: m.website_url } : {}),
        ...(m.description ? { description: m.description } : {}),
        ...(m.image_url ? { image_url: m.image_url } : {}),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

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

  const yesterday = addDays(today, -1);
  const eventsRaw: Event[] = [];
  for (const ev of input.events) {
    if (ev.date < yesterday) continue;
    if (ev.date > horizon) continue;
    if (CLOSURE_KEYWORDS.test(ev.title)) continue;
    const museumId = museumIdBySlug.get(ev.source_slug);
    if (!museumId) continue;
    const id = fnv1aInt(`${ev.source_slug}|${ev.title}|${ev.date}|${ev.time ?? ""}`);
    const price = ev.price_min != null ? `${ev.price_min} €` : null;
    const category = pickMuseumCategory(ev);
    eventsRaw.push({
      id,
      museum_id: museumId,
      title: ev.title,
      date: ev.date,
      ...(ev.time ? { time: ev.time } : {}),
      ...(ev.end_time ? { end_time: ev.end_time } : {}),
      ...(ev.end_date ? { end_date: ev.end_date } : {}),
      ...(ev.description ? { description: ev.description } : {}),
      ...(ev.detail_url ? { url: ev.detail_url, detail_url: ev.detail_url } : {}),
      ...(ev.image_url ? { image_url: ev.image_url } : {}),
      ...(price ? { price } : {}),
      ...(category ? { category } : {}),
      ...(ev.availability ? { availability: ev.availability } : {}),
    });
  }
  const events = deduplicateEvents(deduplicateByTitle(eventsRaw)).sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.museum_id - b.museum_id ||
      a.title.localeCompare(b.title),
  );

  const supportedCities = Object.keys(CITIES).filter((c) => input.museums.some((m) => servesCity(m.city, c)));
  return { museums, exhibitions, events, translations: [], supportedCities };
}

function collectLivingTexts(data: ScrapeData): Set<string> {
  const texts = new Set<string>();
  for (const m of data.museums) if (m.description) texts.add(m.description);
  for (const ex of data.exhibitions) {
    if (ex.title) texts.add(ex.title);
    if (ex.description) texts.add(ex.description);
  }
  for (const ev of data.events) {
    if (ev.title) texts.add(ev.title);
    if (ev.description) texts.add(ev.description);
  }
  return texts;
}

function normalizeForDedup(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[:.,;!?()[\]{}""„"''‚'«»‹›]/g, "")
      // Collapse every dash variant to a space so en/em/hyphen don't keep
      // sibling scrape sources apart. Caught: DAM listed "Suburbia. … – …"
      // on dam-online (en dash) vs "Suburbia. … - …" on museumsufer.de
      // (hyphen), getting two entries for one exhibition.
      .replace(/[-–—‒‐]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function deduplicateByTitle<T extends { museum_id: number; title: string; id: number }>(items: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = `${item.museum_id}|${normalizeForDedup(item.title)}`;
    const existing = byKey.get(key);
    if (!existing || item.id > existing.id) byKey.set(key, item);
  }
  return [...byKey.values()];
}

function deduplicateEvents<T extends { museum_id: number; title: string; id: number; time?: string | null }>(
  events: T[],
): T[] {
  const annotated = events.map((ev) => ({ ev, words: significantWords(ev.title) }));
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
  const empty: ScrapeData = { museums: [], exhibitions: [], events: [], translations: [], supportedCities: [] };
  try {
    const mod = (await import(path)) as { SCRAPE_DATA?: ScrapeData };
    return mod.SCRAPE_DATA ?? empty;
  } catch {
    return empty;
  }
}

function generateModule(data: ScrapeData): string {
  return `// Auto-generated by scripts/scrape.ts — do not edit by hand.
import type { ScrapeData } from "./types";

export const SCRAPE_DATA: ScrapeData = {
  supportedCities: ${JSON.stringify(data.supportedCities)},
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
