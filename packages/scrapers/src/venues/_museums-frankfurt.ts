import { classifyEvent, classifyTalk, type EventType, eventTypeToLabel } from "@museumsufer/classify";
import PQueue from "p-queue";
import { type ApiEvent, type ApiExhibition, fetchEventsFromApi, fetchExhibitionsFromApi } from "../_museums/api";
import { MUSEUMS, museumDisplayName } from "../_museums/config";
import type { CanonicalScrapedEvent, ScrapedLabel, ScraperContext, VenueScrapeResult } from "../types";

const CONCURRENCY = 5;

/**
 * Frankfurt-museums orchestrator — one entry in VENUE_SCRAPERS that fans
 * out to one VenueScrapeResult per museum slug. The museum config in
 * packages/scrapers/src/_museums/config.ts declares per-museum eventApi
 * and/or exhibitionApi endpoints; api.ts dispatches each to a typed
 * parser. We merge a museum's events and exhibitions into a single
 * stream — exhibitions carry an `end_date` and a `museum:ausstellung`
 * label, single-day events get `museum:*` labels from classifyEvent.
 */
export async function scrapeMuseumsFrankfurt(ctx: ScraperContext): Promise<VenueScrapeResult[]> {
  const byMuseum = new Map<string, CanonicalScrapedEvent[]>();
  const queue = new PQueue({ concurrency: CONCURRENCY });

  for (const [slug, config] of Object.entries(MUSEUMS)) {
    const proxy = config.proxy && ctx.proxy ? { url: ctx.proxy.url, token: ctx.proxy.token } : undefined;

    if (config.eventApi) {
      queue.add(async () => {
        try {
          const events = await fetchEventsFromApi(config.eventApi!, proxy);
          for (const ev of events) {
            const targetSlug = ev.museum_slug_override || slug;
            const canonical = toCanonicalEvent(ev, slug);
            if (canonical) appendTo(byMuseum, targetSlug, canonical);
          }
        } catch (err) {
          console.warn(`museums-frankfurt events ${slug}: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    }

    if (config.exhibitionApi) {
      queue.add(async () => {
        try {
          const exhibitions = await fetchExhibitionsFromApi(config.exhibitionApi!);
          for (const ex of exhibitions) {
            const targetSlug = ex.museum_slug_override || slug;
            const canonical = toCanonicalExhibition(ex, slug);
            if (canonical) appendTo(byMuseum, targetSlug, canonical);
          }
        } catch (err) {
          console.warn(`museums-frankfurt exhibitions ${slug}: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    }
  }
  await queue.onIdle();

  const results: VenueScrapeResult[] = [];
  for (const [sourceSlug, events] of byMuseum) {
    results.push({ source_slug: sourceSlug, display_name: museumDisplayName(sourceSlug), events });
  }
  results.sort((a, b) => a.source_slug.localeCompare(b.source_slug));
  return results;
}

function appendTo(byMuseum: Map<string, CanonicalScrapedEvent[]>, slug: string, event: CanonicalScrapedEvent): void {
  let bucket = byMuseum.get(slug);
  if (!bucket) {
    bucket = [];
    byMuseum.set(slug, bucket);
  }
  bucket.push(event);
}

function toCanonicalEvent(ev: ApiEvent, scrapedSlug: string): CanonicalScrapedEvent | null {
  if (!ev.title || !ev.date) return null;
  const title = cleanTitle(ev.title);
  const description = ev.description ? cleanTitle(ev.description) : null;
  const eventType = ev.category && isEventType(ev.category) ? ev.category : (classifyEvent(title, description) ?? null);

  return {
    source_event_id: `${scrapedSlug}|event|${ev.detail_url ?? `${title}|${ev.date}|${ev.time ?? ""}`}`,
    title,
    description,
    date: ev.date,
    time: ev.time,
    end_date: ev.end_date && ev.end_date !== ev.date ? ev.end_date : null,
    end_time: ev.end_time,
    detail_url: ev.detail_url,
    ticket_url: ev.detail_url,
    image_url: ev.image_url,
    raw_category: ev.price ?? null,
    labels: labelsForEvent(eventType, title, description),
  };
}

function toCanonicalExhibition(ex: ApiExhibition, scrapedSlug: string): CanonicalScrapedEvent | null {
  if (!ex.title || !ex.start_date) return null;
  const title = cleanTitle(ex.title);
  const description = ex.description ? cleanTitle(ex.description) : null;

  return {
    source_event_id: `${scrapedSlug}|exhibition|${ex.detail_url ?? `${title}|${ex.start_date}`}`,
    title,
    description,
    date: ex.start_date,
    time: null,
    end_date: ex.end_date && ex.end_date !== ex.start_date ? ex.end_date : null,
    end_time: null,
    detail_url: ex.detail_url,
    ticket_url: null,
    image_url: ex.image_url,
    labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
  };
}

function labelsForEvent(type: EventType | null, title: string, description: string | null): ScrapedLabel[] {
  if (type === "Vortrag") {
    const sub = classifyTalk(title, description).toLowerCase();
    return [{ label: `talk:${sub}`, confidence: 0.85, classifier: "keyword:event" }];
  }
  const mapped = eventTypeToLabel(type);
  if (!mapped) return [{ label: "museum:event", confidence: 0.5, classifier: "scraper-hardcoded" }];
  return [{ label: mapped, confidence: 0.85, classifier: "keyword:event" }];
}

function isEventType(value: string): value is EventType {
  return (
    value === "Vortrag" ||
    value === "Konzert" ||
    value === "Führung" ||
    value === "Workshop" ||
    value === "Vernissage" ||
    value === "Familie" ||
    value === "Film"
  );
}

function cleanTitle(text: string): string {
  return text.replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
}
