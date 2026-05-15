#!/usr/bin/env bun
/**
 * Aggregates public lectures and debates from Frankfurt institutions into
 * src/scrape-data.ts. Sources:
 *   1. Cross-import from frankfurt-museums (events where category === "Vortrag")
 *   2. Cross-import from frankfurt-theaters (shows classified as talks)
 *   3. Dedicated scrapers: Polytechnische, Haus am Dom, Jüdische Gemeinde Frankfurt, Literaturhaus
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
import { THEATERS } from "../../frankfurt-theaters/src/theater-config";
import { scrapeBuergeruniversitaet } from "../src/scrapers/buergeruniversitaet";
import { scrapeDenkbar } from "../src/scrapers/denkbar";
import { scrapeDigFrankfurt } from "../src/scrapers/dig-frankfurt";
import { scrapeEvangelischeAkademie } from "../src/scrapers/evangelische-akademie";
import { scrapeFesHessen } from "../src/scrapers/fes-hessen";
import { scrapeFgzStreitclub } from "../src/scrapers/fgz-streitclub";
import { scrapeForschungskollegHumanwissenschaften } from "../src/scrapers/forschungskolleg-humanwissenschaften";
import { scrapeHausAmDom } from "../src/scrapers/haus-am-dom";
import { scrapeInstitutFuerSozialforschung } from "../src/scrapers/institut-fuer-sozialforschung";
import { scrapeJuedischeGemeinde } from "../src/scrapers/juedische-gemeinde";
import { scrapeLiteraturhaus } from "../src/scrapers/literaturhaus";
import { scrapeMousonturm } from "../src/scrapers/mousonturm";
import { scrapeNormativeOrders } from "../src/scrapers/normative-orders";
import { scrapeOpenBooks } from "../src/scrapers/openbooks";
import { scrapePolytechnische } from "../src/scrapers/polytechnische";
import { scrapeRlsHessen } from "../src/scrapers/rls-hessen";
import { scrapeRoemerberggespraeche } from "../src/scrapers/roemerberggespraeche";
import { scrapeRomanfabrikLehrhaus } from "../src/scrapers/romanfabrik";
import { talkCategory } from "../src/scrapers/shared";
import { scrapeSigmundFreudInstitut } from "../src/scrapers/sigmund-freud-institut";
import { SOURCES } from "../src/source-config";
import type { LehrhausEvent, ScrapeData, ScrapedEvent } from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const today = todayIso();

await main();

async function main(): Promise<void> {
  const allEvents: LehrhausEvent[] = [];

  // ── Cross-import: museums ────────────────────────────────────────────────
  // source_slug stays "frankfurt-museums" so /quelle/frankfurt-museums groups
  // these together, but source_name carries the actual host museum so the
  // card label shows "Senckenberg" / "Städel" / etc. instead of just "Museen".
  const museumSource = SOURCES.find((s) => s.slug === "frankfurt-museums")!;
  const museumNameById = new Map<number, string>(MUSEUM_DATA.museums.map((m) => [m.id, m.name]));
  for (const e of MUSEUM_DATA.events) {
    if (e.category !== "Vortrag") continue;
    if (!e.date || e.date < today) continue;
    // Upstream museum classifier sometimes mistags guided exhibition tours
    // ("Ausstellungsführung", "Rundgang") as Vortrag. Re-run the classifier
    // on the title/description and reject anything that comes back as a
    // non-Vortrag category (Führung, Workshop, etc.). classifyEvent returns
    // null when no category matches — in that case we trust the upstream flag.
    const reclassified = classifyEvent(e.title, e.description);
    if (reclassified && reclassified !== "Vortrag") continue;
    const hostName = museumNameById.get(e.museum_id) ?? museumSource.name;
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
        hostName,
      ),
    );
  }
  log(`museums cross-import: ${allEvents.length} talk events`);

  // ── Cross-import: theaters ───────────────────────────────────────────────
  const theaterSource = SOURCES.find((s) => s.slug === "frankfurt-theaters")!;
  const theaterNameBySlug = new Map<string, string>(THEATERS.map((t) => [t.slug, t.name]));
  const theaterCountBefore = allEvents.length;

  for (const show of THEATER_DATA.shows) {
    if (classifyEvent(show.title, show.description) !== "Vortrag") continue;

    const hostName = theaterNameBySlug.get(show.theater_slug) ?? theaterSource.name;
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
          hostName,
        ),
      );
    }
  }
  log(`theaters cross-import: ${allEvents.length - theaterCountBefore} talk events`);

  // ── Dedicated scrapers ───────────────────────────────────────────────────
  const scrapers: Array<[string, () => Promise<ScrapedEvent[]>]> = [
    ["polytechnische-gesellschaft", scrapePolytechnische],
    ["haus-am-dom", scrapeHausAmDom],
    ["juedische-gemeinde-frankfurt", scrapeJuedischeGemeinde],
    ["fgz-streitclub", scrapeFgzStreitclub],
    ["literaturhaus-frankfurt", scrapeLiteraturhaus],
    ["buergeruniversitaet", scrapeBuergeruniversitaet],
    ["institut-fuer-sozialforschung", scrapeInstitutFuerSozialforschung],
    ["evangelische-akademie-frankfurt", scrapeEvangelischeAkademie],
    ["romanfabrik", scrapeRomanfabrikLehrhaus],
    ["denkbar-frankfurt", scrapeDenkbar],
    ["sigmund-freud-institut", scrapeSigmundFreudInstitut],
    ["dig-frankfurt", scrapeDigFrankfurt],
    ["roemerberggespraeche", scrapeRoemerberggespraeche],
    ["mousonturm", scrapeMousonturm],
    ["normative-orders", scrapeNormativeOrders],
    ["forschungskolleg-humanwissenschaften", scrapeForschungskollegHumanwissenschaften],
    ["fes-hessen", scrapeFesHessen],
    ["rls-hessen", scrapeRlsHessen],
    ["openbooks-frankfurt", scrapeOpenBooks],
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
