import { classifyEvent } from "@museumsufer/classify";
import { fnv1a } from "@museumsufer/core/hash";
import type { CanonicalScrapedEvent, ScrapedLabel } from "@museumsufer/scrapers";
import { VENUE_SCRAPERS } from "@museumsufer/scrapers";
import type { CanonicalEvent, EventHubData, Label } from "./types";

export type Logger = (msg: string) => void;

export interface RunOptions {
  now?: Date;
  log?: Logger;
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
  const nowIso = now.toISOString();
  const previousById = new Map(previous.events.map((e) => [e.id, e]));
  const merged = new Map<string, CanonicalEvent>(previousById);
  const seenThisRun = new Set<string>();

  for (const { slug, run } of VENUE_SCRAPERS) {
    try {
      const result = await run();
      log(`${slug}: ${result.events.length} canonical events`);
      for (const scraped of result.events) {
        const id = makeId(result.source_slug, scraped.source_event_id);
        seenThisRun.add(id);
        const existing = merged.get(id);
        merged.set(id, mergeEvent(existing, result.source_slug, id, scraped, nowIso));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`${slug}: FAIL — ${msg}`);
    }
  }

  // Prune past events that have not been re-confirmed this run.
  const today = nowIso.slice(0, 10);
  const events: CanonicalEvent[] = [];
  for (const ev of merged.values()) {
    if (ev.date < today && !seenThisRun.has(ev.id)) continue;
    events.push(ev);
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title),
  );

  return { events };
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
  const type = classifyEvent(ev.title, ev.description);
  if (type) {
    const mapped = mapEventTypeToLabel(type);
    if (mapped) labels.push({ label: mapped, confidence: 0.6, classifier: "keyword:event" });
  }
  return labels;
}

function mapEventTypeToLabel(t: string): string | null {
  switch (t) {
    case "Vortrag":
      return "talk:vortrag";
    case "Konzert":
      return "music:classical";
    case "Führung":
      return "museum:fuehrung";
    case "Workshop":
      return "museum:workshop";
    case "Vernissage":
      return "museum:vernissage";
    case "Familie":
      return "museum:familie";
    case "Film":
      return "museum:film";
    default:
      return null;
  }
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
