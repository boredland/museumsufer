import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { fnv1a } from "@museumsufer/core/hash";
import type { CanonicalScrapedEvent, ProxyConfig, ScrapedLabel, ScraperContext } from "@museumsufer/scrapers";
import { VENUE_SCRAPERS } from "@museumsufer/scrapers";
import PQueue from "p-queue";
import type { CanonicalEvent, EventHubData, Label } from "./types";

export type Logger = (msg: string) => void;

export interface RunOptions {
  now?: Date;
  log?: Logger;
  proxy?: ProxyConfig | null;
  concurrency?: number;
}

const DEFAULT_CONCURRENCY = 8;
const STALE_TTL_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  const nowIso = now.toISOString();
  const ctx: ScraperContext = { proxy: opts.proxy ?? null };
  const previousById = new Map(previous.events.map((e) => [e.id, e]));
  const merged = new Map<string, CanonicalEvent>(previousById);
  const seenThisRun = new Set<string>();
  // Seed venue names from the previous run so a transient scrape failure
  // doesn't erase a curated label. This-run scrapers override last-run.
  const venueNames: Record<string, string> = { ...(previous.venueNames ?? {}) };

  const queue = new PQueue({ concurrency: opts.concurrency ?? DEFAULT_CONCURRENCY });
  for (const { slug, run } of VENUE_SCRAPERS) {
    queue.add(async () => {
      try {
        const raw = await run(ctx);
        const results = Array.isArray(raw) ? raw : [raw];
        for (const result of results) {
          const label = results.length === 1 ? slug : `${slug}/${result.source_slug}`;
          log(`${label}: ${result.events.length} canonical events`);
          if (result.display_name) venueNames[result.source_slug] = result.display_name;
          for (const scraped of result.events) {
            const id = makeId(result.source_slug, scraped.source_event_id);
            seenThisRun.add(id);
            const existing = merged.get(id);
            merged.set(id, mergeEvent(existing, result.source_slug, id, scraped, nowIso));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`${slug}: FAIL — ${msg}`);
      }
    });
  }
  await queue.onIdle();

  // Prune past events that have not been re-confirmed this run, and drop
  // future events that disappeared from their source more than TTL days
  // ago — without this, cancellations would linger until the date passes.
  const today = nowIso.slice(0, 10);
  const staleCutoff = new Date(now.getTime() - STALE_TTL_DAYS * MS_PER_DAY).toISOString();
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

function mergeEvent(
  existing: CanonicalEvent | undefined,
  sourceSlug: string,
  id: string,
  scraped: CanonicalScrapedEvent,
  nowIso: string,
): CanonicalEvent {
  const scraperLabels: Label[] = scraped.labels.map((l) => ({ ...l }));
  const keywordLabels = keywordPass(scraped, scraperLabels);
  const finalLabels = mergeLabels(scraperLabels, keywordLabels);

  const base = existing ?? { first_seen_at: nowIso };

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
    lat: scraped.lat ?? undefined,
    lon: scraped.lon ?? undefined,
    raw_category: scraped.raw_category ?? undefined,
    labels: finalLabels,
    first_seen_at: base.first_seen_at,
    last_seen_at: nowIso,
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
