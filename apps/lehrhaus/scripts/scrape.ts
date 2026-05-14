#!/usr/bin/env bun
/**
 * Aggregates public lectures and debates from Frankfurt institutions into
 * src/scrape-data.ts. Sources:
 *   1. Cross-import from frankfurt-museums (events where category === "Vortrag")
 *   2. Cross-import from frankfurt-theaters (shows classified as talks)
 *   3. Dedicated scrapers: Polytechnische, Haus am Dom, KfW Stiftung
 *
 * Output is deterministic: stable FNV-1a IDs, sorted by date. Two consecutive
 * runs on identical upstream data produce byte-identical output.
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSection } from "@museumsufer/core/bundle-writer";
import { classifyEvent, detectTalkLanguage } from "@museumsufer/core/classify";
import { todayIso } from "@museumsufer/core/date";
import { fnv1aInt } from "@museumsufer/core/hash";
// Cross-app imports — used only at build time (never bundled into the Worker).
import { SCRAPE_DATA as MUSEUM_DATA } from "../../frankfurt-museums/src/scrape-data";
import { SCRAPE_DATA as THEATER_DATA } from "../../frankfurt-theaters/src/scrape-data";
import { scrapeHausAmDom } from "../src/scrapers/haus-am-dom";
import { scrapeKfwSalon } from "../src/scrapers/kfw-salon";
import { scrapePolytechnische } from "../src/scrapers/polytechnische";
import { talkCategory } from "../src/scrapers/shared";
import { SOURCES } from "../src/source-config";
import type { LehrhausEvent, ScrapeData, ScrapedEvent } from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const today = todayIso();

await main();

async function main(): Promise<void> {
  const allEvents: LehrhausEvent[] = [];

  // ── Cross-import: museums ────────────────────────────────────────────────
  const museumSource = SOURCES.find((s) => s.slug === "frankfurt-museums")!;
  for (const e of MUSEUM_DATA.events) {
    if (e.category !== "Vortrag") continue;
    if (!e.date || e.date < today) continue;
    allEvents.push(
      toEvent(
        {
          title: e.title,
          date: e.date,
          time: e.time ?? null,
          end_time: e.end_time ?? null,
          description: e.description ?? null,
          detail_url: e.detail_url ?? e.url ?? null,
          ticket_url: null,
          category: talkCategory(e.title, e.description),
          language: detectTalkLanguage(e.title, e.description),
        },
        museumSource.slug,
        museumSource.name,
      ),
    );
  }
  log(`museums cross-import: ${allEvents.length} talk events`);

  // ── Cross-import: theaters ───────────────────────────────────────────────
  const theaterSource = SOURCES.find((s) => s.slug === "frankfurt-theaters")!;
  const theaterCountBefore = allEvents.length;

  for (const show of THEATER_DATA.shows) {
    if (classifyEvent(show.title, show.description) !== "Vortrag") continue;

    const perfs = THEATER_DATA.performances.filter((p) => p.show_id === show.id && p.date >= today);
    for (const perf of perfs) {
      allEvents.push(
        toEvent(
          {
            title: show.title,
            date: perf.date,
            time: perf.time ?? null,
            end_time: perf.end_time ?? null,
            description: show.description ?? null,
            detail_url: show.detail_url ?? null,
            ticket_url: perf.ticket_url ?? null,
            category: talkCategory(show.title, show.description),
            language: detectTalkLanguage(show.title, show.description),
          },
          theaterSource.slug,
          theaterSource.name,
        ),
      );
    }
  }
  log(`theaters cross-import: ${allEvents.length - theaterCountBefore} talk events`);

  // ── Dedicated scrapers ───────────────────────────────────────────────────
  const scrapers: Array<[string, () => Promise<ScrapedEvent[]>]> = [
    ["polytechnische-gesellschaft", scrapePolytechnische],
    ["haus-am-dom", scrapeHausAmDom],
    ["kfw-stiftung", scrapeKfwSalon],
  ];

  for (const [slug, fn] of scrapers) {
    const source = SOURCES.find((s) => s.slug === slug)!;
    try {
      const events = await fn();
      for (const e of events) allEvents.push(toEvent(e, source.slug, source.name));
      log(`${slug}: ${events.length} events`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`${slug}: FAIL — ${msg}`);
    }
  }

  // ── Deduplicate, assign stable IDs, sort ─────────────────────────────────
  const seen = new Set<number>();
  const unique: LehrhausEvent[] = [];
  for (const e of allEvents) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      unique.push(e);
    }
  }
  unique.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title),
  );

  const data: ScrapeData = { sources: SOURCES, events: unique };
  await writeFile(resolve(root, "src/scrape-data.ts"), generateModule(data), "utf8");
  log(`wrote src/scrape-data.ts — ${unique.length} events total`);
}

function toEvent(e: ScrapedEvent, sourceSlug: string, sourceName: string): LehrhausEvent {
  const id = fnv1aInt(`${sourceSlug}|${e.title}|${e.date}|${e.time ?? ""}`);
  return {
    id,
    source_slug: sourceSlug,
    source_name: sourceName,
    title: e.title,
    date: e.date,
    time: e.time ?? undefined,
    end_time: e.end_time ?? undefined,
    description: e.description ?? undefined,
    detail_url: e.detail_url ?? undefined,
    ticket_url: e.ticket_url ?? undefined,
    category: e.category,
    language: e.language ?? undefined,
    image_url: e.image_url ?? undefined,
  };
}

function generateModule(data: ScrapeData): string {
  return `// Auto-generated by scripts/scrape.ts — do not edit by hand.
import type { ScrapeData } from "./types";

export const SCRAPE_DATA: ScrapeData = {
${bundleSection("sources", data.sources as unknown as Record<string, unknown>[])}
${bundleSection("events", data.events as unknown as Record<string, unknown>[])}
};
`;
}

function log(msg: string): void {
  process.stderr.write(`[lehrhaus] ${msg}\n`);
}
