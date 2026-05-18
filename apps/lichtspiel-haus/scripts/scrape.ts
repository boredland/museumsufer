#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSection } from "@museumsufer/core/bundle-writer";
import { todayIso } from "@museumsufer/core/date";
import { fnv1aInt } from "@museumsufer/core/hash";
import type { CanonicalEvent } from "@museumsufer/event-hub";
import { displayNameFor, EVENTS, FRANKFURT_BBOX, inBbox } from "@museumsufer/event-hub";
import { type CinemaConfig, CURATED_CINEMAS } from "../src/cinema-config";
import { dedupScreenings } from "../src/dedup";
import {
  FORMATS,
  type Format,
  type Language,
  type ScrapeData,
  type Screening,
  type SeriesRef,
  VERSIONS,
  type Version,
} from "../src/types";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const today = todayIso();

async function main(): Promise<void> {
  const curatedBySlug = new Map(CURATED_CINEMAS.map((c) => [c.slug, c]));
  const screeningsById = new Map<number, Screening>();
  const counts = new Map<string, number>();
  const orphanSlugs = new Set<string>();
  const orphanUrls = new Map<string, string>();

  for (const ev of EVENTS) {
    if (ev.date < today) continue;
    if (!inBbox(ev.lat, ev.lon, FRANKFURT_BBOX)) continue;
    if (!hasFilmCinemaLabel(ev)) continue;

    const canonicalTitleHash = fnv1aInt(ev.title.toLowerCase().replace(/[^a-z0-9]+/g, ""));
    const id = fnv1aInt(`${ev.source_slug}|${ev.date}|${ev.time ?? ""}|${ev.venue_room ?? ""}|${canonicalTitleHash}`);
    if (screeningsById.has(id)) continue;

    const series = pickSeries(ev);
    const version = pickVersion(ev);
    const format = pickFormat(ev);
    const language = pickLanguage(ev);

    screeningsById.set(id, {
      id,
      cinema_slug: ev.source_slug,
      slug: ev.source_event_id,
      title: ev.title,
      subtitle: ev.subtitle,
      description: ev.description,
      description_en: ev.description_en,
      date: ev.date,
      time: ev.time,
      end_time: ev.end_time,
      image_url: scrubImageUrl(ev.image_url),
      detail_url: ev.detail_url,
      ticket_url: ev.ticket_url,
      price_min: ev.price_min,
      price_max: ev.price_max,
      venue_room: ev.venue_room,
      credits: ev.performers,
      version,
      language,
      format,
      series,
      tmdb_id: ev.tmdb_id,
      tmdb_kind: ev.tmdb_kind,
    });
    counts.set(ev.source_slug, (counts.get(ev.source_slug) ?? 0) + 1);
    if (!curatedBySlug.has(ev.source_slug)) {
      orphanSlugs.add(ev.source_slug);
      if (!orphanUrls.has(ev.source_slug) && ev.detail_url) {
        orphanUrls.set(ev.source_slug, originOf(ev.detail_url));
      }
    }
  }

  const synthesized = synthesizeCinemas(orphanSlugs, orphanUrls);
  const deduped = dedupScreenings([...screeningsById.values()]);
  deduped.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.cinema_slug.localeCompare(b.cinema_slug) ||
      a.title.localeCompare(b.title),
  );

  const data: ScrapeData = { screenings: deduped };
  await writeFile(resolve(root, "src/scrape-data.ts"), generateModule(data), "utf8");
  await writeFile(resolve(root, "src/synthesized-cinemas.ts"), generateCinemasModule(synthesized), "utf8");

  const seenCount = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [slug, n] of seenCount) log(`  ${slug.padEnd(36, " ")} ${n}`);
  log(`wrote ${deduped.length} screenings from ${counts.size} cinemas (${synthesized.length} synthesised)`);
}

/** Drop image_url values that aren't actually images. Astor's poster.src
 *  paths resolve to HTML pages on every premiumkino host we've probed —
 *  the SPA constructs the true CDN URL at runtime and we don't have the
 *  recipe yet. Letting these through renders a broken velvet rectangle;
 *  dropping them lets the Caligari intertitle fallback render. */
function scrubImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname;
    if (host === "frankfurt.premiumkino.de") return undefined;
  } catch {
    return undefined;
  }
  return url;
}

function hasFilmCinemaLabel(ev: CanonicalEvent): boolean {
  for (const l of ev.labels) {
    if (l.label === "film:cinema") return true;
  }
  return false;
}

function pickSeries(ev: CanonicalEvent): SeriesRef | undefined {
  for (const l of ev.labels) {
    if (!l.label.startsWith("film:reihe:")) continue;
    const name = l.label.slice("film:reihe:".length).trim();
    if (!name) continue;
    return { slug: kebab(name), name: titleCase(name) };
  }
  return undefined;
}

const VERSION_PATTERNS: Array<[RegExp, Version]> = [
  [/\b(stumm|silent)\b/i, "stumm"],
  [/\bOmeU\b/, "OmeU"],
  [/\bOmU\b/, "OmU"],
  [/\bO\s*m\s*U\b/, "OmU"],
  [/\b(DF|Dt\.\s*Fassung|deutsche\s*Fassung)\b/i, "DF"],
  [/\bOV\b/, "OV"],
];

function pickVersion(ev: CanonicalEvent): Version | undefined {
  const hay = `${ev.title} ${ev.subtitle ?? ""} ${ev.description ?? ""}`;
  for (const [re, v] of VERSION_PATTERNS) {
    if (re.test(hay) && (VERSIONS as readonly string[]).includes(v)) return v;
  }
  return undefined;
}

const FORMAT_PATTERNS: Array<[RegExp, Format]> = [
  [/\b35\s*mm\b/i, "35mm"],
  [/\b16\s*mm\b/i, "16mm"],
  [/\b70\s*mm\b/i, "70mm"],
  [/\bDCP\b/, "DCP"],
];

function pickFormat(ev: CanonicalEvent): Format | undefined {
  const hay = `${ev.title} ${ev.subtitle ?? ""} ${ev.description ?? ""} ${ev.venue_room ?? ""}`;
  for (const [re, f] of FORMAT_PATTERNS) {
    if (re.test(hay) && (FORMATS as readonly string[]).includes(f)) return f;
  }
  return undefined;
}

function pickLanguage(ev: CanonicalEvent): Language | undefined {
  const raw = (ev.language ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  const known: Language[] = ["de", "en", "fr", "es", "it", "ja", "ko", "zh", "ru"];
  if ((known as string[]).includes(raw)) return raw as Language;
  return "other";
}

function synthesizeCinemas(orphanSlugs: Set<string>, orphanUrls: Map<string, string>): CinemaConfig[] {
  const coordsBySlug = new Map<string, { lat: number; lon: number }>();
  for (const ev of EVENTS) {
    if (orphanSlugs.has(ev.source_slug) && !coordsBySlug.has(ev.source_slug)) {
      coordsBySlug.set(ev.source_slug, { lat: ev.lat, lon: ev.lon });
    }
  }
  const out: CinemaConfig[] = [];
  for (const slug of orphanSlugs) {
    const coords = coordsBySlug.get(slug);
    if (!coords) continue;
    out.push({
      slug,
      name: displayNameFor(slug),
      address: "",
      lat: coords.lat,
      lon: coords.lon,
      city: "frankfurt",
      website_url: orphanUrls.get(slug) ?? "",
    });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function kebab(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function generateCinemasModule(cinemas: CinemaConfig[]): string {
  const entries = cinemas
    .map(
      (c) =>
        `  {
    slug: ${JSON.stringify(c.slug)},
    name: ${JSON.stringify(c.name)},
    address: ${JSON.stringify(c.address)},
    lat: ${c.lat},
    lon: ${c.lon},
    city: ${JSON.stringify(c.city)},
    website_url: ${JSON.stringify(c.website_url)},
  },`,
    )
    .join("\n");
  return `// Auto-generated by scripts/scrape.ts — do not edit by hand.
import type { CinemaConfig } from "./cinema-config";

export const SYNTHESIZED_CINEMAS: CinemaConfig[] = [
${entries}
];
`;
}

function generateModule(data: ScrapeData): string {
  return `// Auto-generated by scripts/scrape.ts — do not edit by hand.
import type { ScrapeData } from "./types";

export const SCRAPE_DATA: ScrapeData = {
${bundleSection("screenings", data.screenings)}
};
`;
}

function log(msg: string): void {
  process.stderr.write(`[lichtspiel-haus] ${msg}\n`);
}

await main();
