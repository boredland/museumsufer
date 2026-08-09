import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { fnv1a } from "@museumsufer/core/hash";
import type { CanonicalScrapedEvent, ProxyConfig, ScrapedLabel, ScraperContext } from "@museumsufer/scrapers";
import { coordinatesFor, VENUE_SCRAPERS, withinGeofence } from "@museumsufer/scrapers";
import PQueue from "p-queue";
import { enrichFilmPosters, type TmdbCache } from "./tmdb";
import type { CanonicalEvent, EventHubData, Label } from "./types";

export type Logger = (msg: string) => void;

export interface RunOptions {
  now?: Date;
  log?: Logger;
  proxy?: ProxyConfig | null;
  concurrency?: number;
  /** Optional TMDb v3 API key. When set, film:cinema events that lack an
   *  image_url get enriched with a TMDb poster + tmdb_id after scraping. */
  tmdbApiKey?: string;
  /** Persistent cache for TMDb lookups. The script that drives this runner
   *  is responsible for loading + persisting it; the runner mutates it in
   *  place. */
  tmdbCache?: TmdbCache;
  /** Optional DeepL API key(s), comma-separated. When set, TMDb cache
   *  entries with a German overview but no English one get translated
   *  DE→EN as a fallback so apps still have bilingual descriptions for
   *  older European arthouse titles TMDb hasn't translated. */
  deeplApiKeys?: string;
  /** Optional OMDb API key (free tier). When set, the runner does a
   *  follow-up OMDb lookup for every cached TMDb match that has an
   *  imdb_id, attaching Rotten Tomatoes critic % + IMDb rating. */
  omdbApiKey?: string;
  /** Skip the TMDb/DeepL/OMDb enrichment pass. Used to write the
   *  bundle before enrichment so a timeout doesn't lose the scrape. */
  skipEnrichment?: boolean;
}

const DEFAULT_CONCURRENCY = 8;
const STALE_TTL_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** A single scraper must never stall the whole run. `fetch` has no default
 *  timeout, so a venue server that accepts the connection but never responds
 *  would otherwise hang `queue.onIdle()` until the CI job's 6h limit. On
 *  timeout the scraper is abandoned and its previous events ride the stale-TTL
 *  grace, exactly like any other transient failure. */
const SCRAPER_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`scraper timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Runs every venue scraper, applies the keyword-pass classifier, and
 * merges results into the existing hub data. Output is deterministic:
 * events keyed on `id`; labels unioned (higher-confidence wins for
 * duplicates); `last_seen_at` always bumps; events not seen in this
 * run are kept unless their date has passed.
 */
export async function runHub(previous: EventHubData, opts: RunOptions = {}): Promise<EventHubData> {
  const now = opts.now ?? new Date();
  const log: Logger = opts.log ?? (() => undefined);
  const today = now.toISOString().slice(0, 10);
  const ctx: ScraperContext = { proxy: opts.proxy ?? null };
  const previousById = new Map(previous.events.map((e) => [e.id, e]));
  const merged = new Map<string, CanonicalEvent>(previousById);
  const seenThisRun = new Set<string>();
  // Seed venue names from the previous run so a transient scrape failure
  // doesn't erase a curated label. This-run scrapers override last-run.
  const venueNames: Record<string, string> = { ...(previous.venueNames ?? {}) };

  const geofenceDrops = new Map<string, number>();
  const queue = new PQueue({ concurrency: opts.concurrency ?? DEFAULT_CONCURRENCY });
  for (const { slug, run } of VENUE_SCRAPERS) {
    queue.add(async () => {
      try {
        const raw = await withTimeout(run(ctx), SCRAPER_TIMEOUT_MS);
        const results = Array.isArray(raw) ? raw : [raw];
        for (const result of results) {
          const label = results.length === 1 ? slug : `${slug}/${result.source_slug}`;
          log(`${label}: ${result.events.length} canonical events`);
          if (result.display_name) venueNames[result.source_slug] = result.display_name;
          for (const scraped of result.events) {
            const coords = resolveCoords(scraped, result.source_slug);
            if (!coords) {
              geofenceDrops.set(label, (geofenceDrops.get(label) ?? 0) + 1);
              continue;
            }
            const id = makeId(result.source_slug, scraped.source_event_id);
            seenThisRun.add(id);
            const existing = merged.get(id);
            merged.set(id, mergeEvent(existing, result.source_slug, id, scraped, coords, today));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`${slug}: FAIL — ${msg}`);
      }
    });
  }
  await queue.onIdle();
  for (const [label, n] of geofenceDrops) log(`${label}: ${n} events dropped (no coords / outside geofence)`);

  // Prune past events that have not been re-confirmed this run, and drop
  // future events that disappeared from their source more than TTL days
  // ago — without this, cancellations would linger until the date passes.
  // Day-granular to match `last_seen_at`; comparing a date against a full
  // ISO timestamp would make same-day records sort below the cutoff.
  const staleCutoff = new Date(now.getTime() - STALE_TTL_DAYS * MS_PER_DAY).toISOString().slice(0, 10);
  const events: CanonicalEvent[] = [];
  for (const ev of merged.values()) {
    if (seenThisRun.has(ev.id)) {
      events.push(ev);
      continue;
    }
    if (ev.date < today) continue;
    if (ev.last_seen_at < staleCutoff) continue;
    events.push(ev);
  }

  tagNipponConnection(events);

  if (opts.tmdbCache && !opts.skipEnrichment) {
    await enrichFilmPosters(events, {
      apiKey: opts.tmdbApiKey,
      cache: opts.tmdbCache,
      deeplApiKeys: opts.deeplApiKeys,
      omdbApiKey: opts.omdbApiKey,
      log,
    });
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title),
  );

  // Sort venue-names keys so the generated module is byte-identical
  // across runs when content matches.
  const sortedNames: Record<string, string> = {};
  for (const k of Object.keys(venueNames).sort()) sortedNames[k] = venueNames[k];

  return { events, venueNames: sortedNames };
}

function makeId(sourceSlug: string, sourceEventId: string): string {
  return fnv1a(`${sourceSlug}|${sourceEventId}`);
}

const NIPPON_REIHE = "film:reihe:Nippon Connection";

/** Nippon Connection screens most of its films at partner cinemas (Mal Seh'n,
 *  naxos, Eldorado, DFF) that scrape those same screenings under their own
 *  source. The nippon-connection scraper carries the festival's authoritative
 *  schedule, so we tag every other film:cinema event that matches one of its
 *  screenings (by title + date) as belonging to the festival. Downstream dedup
 *  then keeps the partner cinema's richer listing while preserving this label. */
function tagNipponConnection(events: CanonicalEvent[]): void {
  const norm = (t: string): string =>
    t
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/[^a-z0-9]+/g, "");

  const festival = new Set<string>();
  for (const ev of events) {
    if (ev.source_slug !== "nippon-connection") continue;
    const key = norm(ev.title);
    if (key.length >= 3) festival.add(`${key}|${ev.date}`);
  }
  if (festival.size === 0) return;

  for (const ev of events) {
    if (ev.source_slug === "nippon-connection") continue;
    if (!ev.labels.some((l) => l.label === "film:cinema")) continue;
    if (ev.labels.some((l) => l.label === NIPPON_REIHE)) continue;
    const key = norm(ev.title);
    if (key.length >= 3 && festival.has(`${key}|${ev.date}`)) {
      ev.labels.push({ label: NIPPON_REIHE, confidence: 0.85, classifier: "scraper-hardcoded" });
    }
  }
}

/** Resolve final per-event coordinates and apply the bbox geofence.
 *  Returns null if the event has no usable coords (scraper omitted + no
 *  default for the source) or sits outside the Frankfurt / Landau box. */
function resolveCoords(scraped: CanonicalScrapedEvent, sourceSlug: string): readonly [number, number] | null {
  const lat = scraped.lat ?? undefined;
  const lon = scraped.lon ?? undefined;
  if (typeof lat === "number" && typeof lon === "number") {
    return withinGeofence(lat, lon) ? [lat, lon] : null;
  }
  const fallback = coordinatesFor(sourceSlug);
  if (!fallback) return null;
  return withinGeofence(fallback[0], fallback[1]) ? fallback : null;
}

function mergeEvent(
  existing: CanonicalEvent | undefined,
  sourceSlug: string,
  id: string,
  scraped: CanonicalScrapedEvent,
  coords: readonly [number, number],
  today: string,
): CanonicalEvent {
  const scraperLabels: Label[] = scraped.labels.map((l) => ({ ...l }));
  const keywordLabels = keywordPass(scraped, scraperLabels);
  const finalLabels = mergeLabels(scraperLabels, keywordLabels);

  const base = existing ?? { first_seen_at: today };

  return prune({
    id,
    source_slug: sourceSlug,
    source_event_id: scraped.source_event_id,
    title: scraped.title,
    subtitle: scraped.subtitle ?? undefined,
    description: scraped.description ?? undefined,
    date: scraped.date,
    time: scraped.time ?? undefined,
    end_date: scraped.end_date ?? undefined,
    end_time: scraped.end_time ?? undefined,
    detail_url: scraped.detail_url ?? undefined,
    ticket_url: scraped.ticket_url ?? undefined,
    image_url: scraped.image_url ?? undefined,
    language: scraped.language ?? undefined,
    price_min: scraped.price_min ?? undefined,
    price_max: scraped.price_max ?? undefined,
    performers: scraped.performers ?? undefined,
    venue_room: scraped.venue_room ?? undefined,
    city: scraped.city ?? undefined,
    lat: coords[0],
    lon: coords[1],
    raw_category: scraped.raw_category ?? undefined,
    availability: scraped.availability ?? undefined,
    labels: finalLabels,
    first_seen_at: base.first_seen_at,
    last_seen_at: today,
  });
}

function prune(ev: CanonicalEvent): CanonicalEvent {
  const out = { ...ev };
  for (const key of Object.keys(out) as Array<keyof CanonicalEvent>) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

/**
 * Keyword pass — runs after the scraper's source-signal labels and
 * fills gaps when no scraper label already covers the same namespace.
 * The pass is intentionally cautious: scraper-attached labels reflect
 * direct evidence (URL slug, CMS tag), while keyword guesses are
 * cheap probes and shouldn't override them or pollute neighbouring
 * namespaces. E.g. don't sneak a `museum:vernissage` onto a clearly-
 * music event just because the description happens to contain
 * "Eröffnung".
 */
function keywordPass(ev: CanonicalScrapedEvent, scraperLabels: ReadonlyArray<Label | ScrapedLabel>): Label[] {
  if (scraperLabels.length > 0) return [];

  const labels: Label[] = [];
  const mapped = eventTypeToLabel(classifyEvent(ev.title, ev.description));
  if (mapped) labels.push({ label: mapped, confidence: 0.6, classifier: "keyword:event" });
  return labels;
}

function mergeLabels(a: ReadonlyArray<Label | ScrapedLabel>, b: ReadonlyArray<Label | ScrapedLabel>): Label[] {
  const byLabel = new Map<string, Label>();
  for (const l of [...a, ...b]) {
    const existing = byLabel.get(l.label);
    if (!existing || existing.confidence < l.confidence) {
      byLabel.set(l.label, { label: l.label, confidence: l.confidence, classifier: l.classifier });
    }
  }
  return Array.from(byLabel.values()).sort((x, y) => x.label.localeCompare(y.label));
}
