#!/usr/bin/env bun
/**
 * Walks every theater config, calls the matching scraper module via a
 * concurrency-limited queue, and writes the aggregated result to
 * src/scrape-data.ts. Designed to run from a GitHub Action — no D1, no
 * SCRAPE_SECRET, no Cloudflare runtime dependencies. Bun runs the file
 * natively (no tsx).
 *
 * Output is deterministic: stable IDs (FNV-1a hashes), sorted arrays,
 * sorted object keys. Two consecutive runs on identical upstream data
 * produce byte-identical output, so the GH Action's commit-if-changed
 * step skips noisy commits.
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fnv1aInt, todayIso } from "@museumsufer/core";
import PQueue from "p-queue";
import { runScraper } from "../src/scrape-runner";
import { THEATERS } from "../src/theater-config";
import type { Performance, ScrapeData, Show } from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const today = todayIso();
const CONCURRENCY = 5;

await main();

async function main(): Promise<void> {
  const showsById = new Map<number, Show>();
  const allPerformances: Performance[] = [];
  let okCount = 0;
  let failCount = 0;

  const queue = new PQueue({ concurrency: CONCURRENCY });
  for (const t of THEATERS) {
    queue.add(async () => {
      try {
        const result = await runScraper(t.scraper);
        ingest(t.slug, result, showsById, allPerformances);
        log(`${t.slug.padEnd(36, " ")} ok — ${result.shows.length} shows, ${result.performances.length} perfs`);
        okCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`${t.slug.padEnd(36, " ")} FAIL — ${msg}`);
        failCount++;
      }
    });
  }
  await queue.onIdle();

  const data: ScrapeData = buildScrapeData(showsById, allPerformances);
  await writeFile(resolve(root, "src/scrape-data.ts"), generateModule(data), "utf8");

  log(
    `${okCount}/${THEATERS.length} ok, ${failCount} failed — wrote src/scrape-data.ts (${data.shows.length} shows, ${data.performances.length} perfs)`,
  );
  if (failCount > 0 && okCount === 0) process.exit(1);
}

function ingest(
  theaterSlug: string,
  result: Awaited<ReturnType<typeof runScraper>>,
  showsById: Map<number, Show>,
  allPerformances: Performance[],
): void {
  for (const s of result.shows) {
    const showId = fnv1aInt(`${theaterSlug}|${s.slug}`);
    if (showsById.has(showId)) continue;
    showsById.set(showId, {
      id: showId,
      theater_slug: theaterSlug,
      slug: s.slug,
      title: s.title,
      subtitle: s.subtitle ?? null,
      description: s.description ?? null,
      language: s.language ?? null,
      age_recommendation: s.age_recommendation ?? null,
      image_url: s.image_url ?? null,
      detail_url: s.detail_url ?? null,
      season: s.season ?? null,
    });
  }

  for (const p of result.performances) {
    if (p.date < today) continue;
    const showId = fnv1aInt(`${theaterSlug}|${p.show_slug}`);
    const id = fnv1aInt(`${theaterSlug}|${p.show_slug}|${p.date}|${p.time ?? ""}|${p.venue_room ?? ""}`);
    allPerformances.push({
      id,
      show_id: showId,
      date: p.date,
      time: p.time,
      end_time: p.end_time ?? null,
      end_date: p.end_date ?? null,
      venue_room: p.venue_room ?? null,
      provider_event_id: p.provider_event_id ?? null,
      ticket_url: p.ticket_url ?? null,
      status: p.status ?? "unknown",
      price_min: p.price_min ?? null,
      price_max: p.price_max ?? null,
    });
  }
}

function buildScrapeData(showsById: Map<number, Show>, allPerformances: Performance[]): ScrapeData {
  const shows = [...showsById.values()].sort(
    (a, b) => a.theater_slug.localeCompare(b.theater_slug) || a.slug.localeCompare(b.slug),
  );
  const performancesById = new Map<number, Performance>();
  for (const p of allPerformances) performancesById.set(p.id, p);
  const performances = [...performancesById.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.show_id - b.show_id ||
      (a.venue_room ?? "").localeCompare(b.venue_room ?? ""),
  );
  return { shows, performances };
}

function generateModule(data: ScrapeData): string {
  // One JSON line per record. Diffs stay precise (you can see exactly which
  // performance changed between scrapes) and the file shrinks dramatically
  // versus 2-space pretty-printed nesting. Null fields are stripped — most
  // records have ~half the schema unset, and the worker tolerates missing
  // keys (Performance/Show types treat them as `string | null`, so the
  // optional-vs-undefined distinction never reaches the renderer).
  const showsJson = data.shows.map((s) => stringifyRecord(s)).join(",\n    ");
  const perfsJson = data.performances.map((p) => stringifyRecord(p)).join(",\n    ");
  return `// Auto-generated by scripts/scrape.ts — do not edit by hand.
import type { ScrapeData } from "./types";

export const SCRAPE_DATA: ScrapeData = {
  shows: [
    ${showsJson}
  ],
  performances: [
    ${perfsJson}
  ],
};
`;
}

/** Compact JSON for one record: keys sorted, null fields stripped, no
 *  internal whitespace. Output is `{"a":1,"b":"x"}` style. */
function stringifyRecord(record: Record<string, unknown>): string {
  const entries = Object.entries(record)
    .filter(([, v]) => v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const parts = entries.map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`);
  return `{${parts.join(",")}}`;
}

function log(msg: string): void {
  process.stderr.write(`[scrape] ${msg}\n`);
}
