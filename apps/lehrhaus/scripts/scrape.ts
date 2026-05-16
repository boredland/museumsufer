#!/usr/bin/env bun
/**
 * Derives lehrhaus's `src/scrape-data.ts` from the central event hub.
 * Filters `EVENTS` to entries with a `talk:*` label, maps each canonical
 * event onto the LehrhausEvent shape, and rolls museum/theater hosts under
 * the `frankfurt-museums` / `frankfurt-theaters` source slugs so the UI's
 * existing /quelle pages keep working. The 20 direct lehrhaus sources
 * (Polytechnische, Haus am Dom, …) keep their dedicated routes.
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSection } from "@museumsufer/core/bundle-writer";
import { todayIso } from "@museumsufer/core/date";
import { fnv1aInt } from "@museumsufer/core/hash";
import { type CanonicalEvent, displayNameFor, EVENTS } from "@museumsufer/event-hub";
import { SOURCES } from "../src/source-config";
import type { Category, LehrhausEvent, ScrapeData } from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const today = todayIso();

/** Stable list of hub source_slugs that should roll up under
 *  frankfurt-museums. Mirrors the 32-museum config in
 *  packages/scrapers/src/_museums/config.ts. */
const MUSEUM_SLUGS = new Set([
  "archaeologisches-museum-frankfurt",
  "bibelhaus-erlebnismuseum",
  "caricatura-museum-frankfurt",
  "deutsches-architekturmuseum",
  "deutsches-ledermuseum-of",
  "deutsches-romantik-museum",
  "dff-deutsches-filminstitut-filmmuseum",
  "dommuseum-frankfurt",
  "experiminta",
  "fotografie-forum-frankfurt",
  "frankfurter-buergerstiftung",
  "frankfurter-goethe-haus",
  "frankfurter-kunstverein",
  "historisches-museum-frankfurt",
  "ikonenmuseum-frankfurt",
  "institut-fuer-stadtgeschichte",
  "juedisches-museum-frankfurt",
  "juedisches-museum-museum-judengasse-frankfurt",
  "junges-museum-frankfurt",
  "liebieghaus-skulpturensammlung",
  "museum-angewandte-kunst",
  "museum-fuer-kommunikation-frankfurt",
  "museum-giersch-der-goethe-universitaet",
  "museum-mmk-museum-mmk-fuer-moderne-kunst",
  "schirn-in-bockenheim",
  "schirn-kunsthalle-frankfurt",
  "senckenberg-naturmuseum",
  "staedel-museum",
  "tower-mmk-museum-mmk-fuer-moderne-kunst",
  "verkehrsmuseum-frankfurt",
  "weltkulturen-museum",
  "wollheim-memorial-frankfurt",
  "zollamt-mmk-museum-mmk-fuer-moderne-kunst",
]);

/** Hub source_slugs that should roll up under frankfurt-theaters. Mirrors
 *  the venue list in packages/scrapers/src/venues/ for theater-shape
 *  scrapers. mousonturm is excluded because it's a direct lehrhaus source. */
const THEATER_SLUGS = new Set([
  "die-kaes",
  "die-schmiere",
  "dramatische-buehne",
  "dresden-frankfurt-dance-company",
  "english-theatre-frankfurt",
  "galli-theater",
  "gallus-theater",
  "internationales-theater",
  "kellertheater-frankfurt",
  "komoedie-frankfurt",
  "landungsbruecken",
  "neues-theater-hoechst",
  "oper-frankfurt",
  "papageno-musiktheater",
  "schauspiel-frankfurt",
  "stalburg-theater",
  "theater-alte-bruecke",
  "theater-lempenfieber",
  "theater-willy-praml",
  "theaterhaus-frankfurt",
  "tigerpalast-variete",
  "volksbuehne-frankfurt",
]);

await main();

async function main(): Promise<void> {
  const directSlugs = new Set(
    SOURCES.filter((s) => s.slug !== "frankfurt-museums" && s.slug !== "frankfurt-theaters").map((s) => s.slug),
  );
  const directByName = new Map(SOURCES.map((s) => [s.slug, s.name]));

  const events: LehrhausEvent[] = [];
  const counts = { direct: 0, museums: 0, theaters: 0, skipped: 0 };

  for (const ev of EVENTS) {
    if (ev.date < today) continue;
    const category = pickCategory(ev);
    if (!category) continue;

    const placement = placeEvent(ev, directSlugs);
    if (!placement) {
      counts.skipped++;
      continue;
    }
    if (placement.sourceSlug === "frankfurt-museums") counts.museums++;
    else if (placement.sourceSlug === "frankfurt-theaters") counts.theaters++;
    else counts.direct++;

    const sourceName =
      placement.sourceSlug === ev.source_slug
        ? (directByName.get(placement.sourceSlug) ?? displayNameFor(ev.source_slug))
        : displayNameFor(ev.source_slug);

    events.push({
      id: fnv1aInt(`${placement.sourceSlug}|${ev.title}|${ev.date}|${ev.time ?? ""}`),
      source_slug: placement.sourceSlug,
      source_name: sourceName,
      title: ev.title,
      date: ev.date,
      time: ev.time,
      end_time: ev.end_time,
      description: ev.description,
      detail_url: ev.detail_url,
      ticket_url: ev.ticket_url,
      category,
      language: ev.language,
      image_url: ev.image_url,
    });
  }

  // Deduplicate by id (same talk picked up from multiple labels).
  const seen = new Set<number>();
  const unique: LehrhausEvent[] = [];
  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    unique.push(e);
  }
  unique.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title),
  );

  log(
    `direct: ${counts.direct}, museums: ${counts.museums}, theaters: ${counts.theaters}, skipped: ${counts.skipped} → ${unique.length} unique events`,
  );

  const data: ScrapeData = { sources: SOURCES, events: unique };
  await writeFile(resolve(root, "src/scrape-data.ts"), generateModule(data), "utf8");
  log(`wrote src/scrape-data.ts — ${unique.length} events`);
}

function pickCategory(ev: CanonicalEvent): Category | null {
  for (const l of ev.labels) {
    if (l.label === "talk:vortrag") return "Vortrag";
    if (l.label === "talk:diskussion") return "Diskussion";
    if (l.label === "talk:lesung") return "Lesung";
  }
  return null;
}

/**
 * Decide which `LehrhausSource` slug a hub event belongs to. Direct mappings
 * win for the 20 institution-specific sources. Museum and theater venues
 * roll up under the catch-all `frankfurt-museums` / `frankfurt-theaters`
 * sources, identified via stable source_slug lists below — the orchestrator
 * replaces `museum:*` with `talk:*` when classifyEvent flags an event as a
 * Vortrag, so we can't rely on the label namespace to identify the venue's
 * primary type.
 */
function placeEvent(ev: CanonicalEvent, directSlugs: Set<string>): { sourceSlug: string } | null {
  if (directSlugs.has(ev.source_slug)) return { sourceSlug: ev.source_slug };
  if (MUSEUM_SLUGS.has(ev.source_slug)) return { sourceSlug: "frankfurt-museums" };
  if (THEATER_SLUGS.has(ev.source_slug)) return { sourceSlug: "frankfurt-theaters" };
  // Hub events from upstreams that don't match any lehrhaus source slip
  // through. Examples: regional landau sources, konzert-haus venues with the
  // occasional spoken-word evening.
  return null;
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
