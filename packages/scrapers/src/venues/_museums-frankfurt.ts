import { classifyEvent, classifyTalk, type EventType, eventTypeToLabel } from "@museumsufer/classify";
import PQueue from "p-queue";
import { type ApiEvent, type ApiExhibition, fetchEventsFromApi, fetchExhibitionsFromApi } from "../_museums/api";
import { MUSEUMS, type MuseumConfig, museumDisplayName } from "../_museums/config";
import type { CanonicalScrapedEvent, ScrapedLabel, ScraperContext, VenueScrapeResult } from "../types";

const CONCURRENCY = 5;
/** One museum's fetches must not spend the orchestrator's whole run budget
 *  (the hub abandons it at 90s). An origin that stops answering (Dommuseum,
 *  which also fetches one ICS per event) otherwise holds a queue slot for
 *  minutes, and the other museums time out behind it. */
const TASK_TIMEOUT_MS = 45_000;

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
  const queue = new PQueue({ concurrency: CONCURRENCY, timeout: TASK_TIMEOUT_MS });

  for (const [slug, config] of Object.entries(MUSEUMS)) {
    const proxy = config.proxy && ctx.proxy ? { url: ctx.proxy.url, token: ctx.proxy.token } : undefined;

    if (config.eventApi) {
      enqueue(queue, `events ${slug}`, async () => {
        try {
          const events = await fetchEventsFromApi(config.eventApi!, proxy);
          // Calendars list one occurrence twice when it sits in two of their
          // categories (Liebieghaus, Goethe-Haus, MAK); same id is same event.
          const seen = new Set<string>();
          for (const ev of events) {
            const targetSlug = ev.museum_slug_override || slug;
            const canonical = toCanonicalEvent(ev, slug, programmePage(MUSEUMS[targetSlug]));
            if (!canonical || seen.has(`${targetSlug}|${canonical.source_event_id}`)) continue;
            seen.add(`${targetSlug}|${canonical.source_event_id}`);
            appendTo(byMuseum, targetSlug, canonical);
          }
        } catch (err) {
          console.warn(`museums-frankfurt events ${slug}: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    }

    if (config.exhibitionApi) {
      enqueue(queue, `exhibitions ${slug}`, async () => {
        try {
          const exhibitions = await fetchExhibitionsFromApi(config.exhibitionApi!, proxy);
          for (const ex of exhibitions) {
            const targetSlug = ex.museum_slug_override || slug;
            const canonical = toCanonicalExhibition(ex, slug, programmePage(MUSEUMS[targetSlug]));
            if (canonical) appendTo(byMuseum, targetSlug, canonical);
          }
        } catch (err) {
          console.warn(`museums-frankfurt exhibitions ${slug}: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    }

    if (config.manualExhibitions) {
      for (const ex of config.manualExhibitions) {
        const canonical = toCanonicalExhibition(
          {
            title: ex.title,
            start_date: ex.start_date ?? null,
            end_date: ex.end_date ?? null,
            description: ex.description ?? null,
            detail_url: ex.detail_url ?? null,
            image_url: ex.image_url ?? null,
          },
          slug,
          programmePage(config),
        );
        if (canonical) appendTo(byMuseum, slug, canonical);
      }
    }
  }
  await queue.onIdle();

  const results: VenueScrapeResult[] = [];
  for (const [sourceSlug, events] of byMuseum) {
    results.push({
      source_slug: sourceSlug,
      display_name: museumDisplayName(sourceSlug),
      events: dropTwins(sourceSlug, events),
    });
  }
  results.sort((a, b) => a.source_slug.localeCompare(b.source_slug));
  return results;
}

/** Queue a museum fetch. A task that hits TASK_TIMEOUT_MS rejects its
 *  `add()` promise, which nothing else awaits; catch it here so the timeout
 *  is logged like any other per-museum failure instead of surfacing as an
 *  unhandled rejection. */
function enqueue(queue: PQueue, label: string, task: () => Promise<void>): void {
  queue.add(task).catch((err: unknown) => {
    console.warn(`museums-frankfurt ${label}: ${err instanceof Error ? err.message : String(err)}`);
  });
}

/** The same multi-day show reaches a museum through two feeds: the museum's own
 *  exhibition page and the shared calendar of another (Damals 1410 via the
 *  Historisches Museum API and junges-museum-frankfurt.de), or a Tribe event that
 *  the exhibition page also lists (DAM Preis). Keep one per title+run: the
 *  exhibition entry, then the one scraped by the museum's own source, then the
 *  lowest id. Sorting first keeps the pick independent of fetch completion order. */
function dropTwins(sourceSlug: string, events: CanonicalScrapedEvent[]): CanonicalScrapedEvent[] {
  const rank = (e: CanonicalScrapedEvent): number =>
    (e.labels.some((l) => l.label === "museum:ausstellung") ? 0 : 2) +
    (e.source_event_id.startsWith(`${sourceSlug}|`) ? 0 : 1);
  const sorted = [...events].sort((a, b) => a.source_event_id.localeCompare(b.source_event_id));
  const best = new Map<string, CanonicalScrapedEvent>();
  for (const e of sorted) {
    if (!e.end_date) continue;
    const key = `${e.title.toLowerCase()}|${e.date}|${e.end_date}`;
    const kept = best.get(key);
    if (!kept || rank(e) < rank(kept)) best.set(key, e);
  }
  return sorted.filter((e) => !e.end_date || best.get(`${e.title.toLowerCase()}|${e.date}|${e.end_date}`) === e);
}

function appendTo(byMuseum: Map<string, CanonicalScrapedEvent[]>, slug: string, event: CanonicalScrapedEvent): void {
  let bucket = byMuseum.get(slug);
  if (!bucket) {
    bucket = [];
    byMuseum.set(slug, bucket);
  }
  bucket.push(event);
}

function toCanonicalEvent(
  ev: ApiEvent,
  scrapedSlug: string,
  programmeUrl: string | null,
): CanonicalScrapedEvent | null {
  if (!ev.title || !ev.date) return null;
  const rawTitle = cleanTitle(ev.title);
  const title = deshout(rawTitle);
  const description = ev.description ? cleanTitle(ev.description) : null;
  const eventType = ev.category && isEventType(ev.category) ? ev.category : (classifyEvent(title, description) ?? null);

  const labels = labelsForEvent(eventType, title, description);
  if (ev.series) {
    labels.push({ label: `film:reihe:${ev.series}`, confidence: 0.9, classifier: "scraper-hardcoded" });
  }

  return {
    // The detail_url alone is not unique: ticketing backends (ticketfritz,
    // gomus) link every occurrence of a recurring guided tour to one series
    // template URL, so a date+time qualifier is required or the runner's
    // id-keyed merge collapses the whole series into a single event.
    source_event_id: `${scrapedSlug}|event|${ev.detail_url ?? rawTitle}|${ev.date}|${ev.time ?? ""}`,
    title,
    description,
    date: ev.date,
    time: ev.time,
    end_date: ev.end_date && ev.end_date !== ev.date ? ev.end_date : null,
    end_time: ev.end_time,
    detail_url: ev.detail_url ?? ev.fallback_url ?? programmeUrl,
    ticket_url: ev.detail_url,
    image_url: ev.image_url,
    language: ev.language ?? null,
    raw_category: ev.price ?? null,
    availability: ev.availability ?? null,
    labels,
  };
}

function toCanonicalExhibition(
  ex: ApiExhibition,
  scrapedSlug: string,
  programmeUrl: string | null,
): CanonicalScrapedEvent | null {
  if (!ex.title) return null;
  const rawTitle = cleanTitle(ex.title);
  const title = deshout(rawTitle);
  const description = ex.description ? cleanTitle(ex.description) : null;
  // Evergreen / Dauerausstellung entries arrive with no dates from the
  // junges-museum-drupal and stadtgeschichte-ffm-html scrapers (and
  // from manualExhibitions for the Bundesbank/Struwwelpeter pins). Pin
  // the start at the unix epoch so they always count as "running" in
  // downstream filters without polluting upcoming-window queries.
  const startDate = ex.start_date ?? "1970-01-01";

  return {
    source_event_id: `${scrapedSlug}|exhibition|${ex.detail_url ?? `${rawTitle}|${startDate}`}`,
    title,
    description,
    date: startDate,
    time: null,
    end_date: ex.end_date && ex.end_date !== startDate ? ex.end_date : null,
    end_time: null,
    detail_url: ex.detail_url ?? ex.fallback_url ?? programmeUrl,
    ticket_url: null,
    image_url: ex.image_url,
    labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
  };
}

/** Every event from a museum source carries a `museum:<category>` label so
 *  museumsufer can filter by namespace. Talks and concerts at museums
 *  also carry their topical label (talk:* / music:*) so lehrhaus and
 *  konzert-haus pick them up via their natural filters. */
function labelsForEvent(type: EventType | null, title: string, description: string | null): ScrapedLabel[] {
  if (type === "Vortrag") {
    const sub = classifyTalk(title, description).toLowerCase();
    return [
      { label: `talk:${sub}`, confidence: 0.85, classifier: "keyword:event" },
      { label: "museum:vortrag", confidence: 0.85, classifier: "keyword:event" },
    ];
  }
  if (type === "Konzert") {
    return [
      { label: "music:classical", confidence: 0.85, classifier: "keyword:event" },
      { label: "museum:konzert", confidence: 0.85, classifier: "keyword:event" },
    ];
  }
  if (type === "Film") {
    return [
      { label: "film:cinema", confidence: 0.85, classifier: "keyword:event" },
      { label: "museum:film", confidence: 0.85, classifier: "keyword:event" },
    ];
  }
  const mapped = eventTypeToLabel(type);
  if (!mapped) return [{ label: "museum:event", confidence: 0.5, classifier: "scraper-hardcoded" }];
  return [{ label: mapped, confidence: 0.85, classifier: "keyword:event" }];
}

/** Last-resort link for an entry whose upstream has no page of its own: the
 *  museum's programme page, so the event is never unlinkable. */
function programmePage(config: MuseumConfig | undefined): string | null {
  return config?.exhibitionUrl ?? config?.website ?? null;
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

/** Several museums publish their programme in capitals ("UNSERE GESCHICHTEN AUF
 *  LEDER GESCHRIEBEN"), which renders as shouting in the apps. Title-case such
 *  titles word by word; vowel-less words up to four letters ("MMK", "FFF", "DFF")
 *  and roman numerals ("LUDWIG II.") are kept. The event id is built from the raw
 *  title, so this never moves an id. */
function deshout(title: string): string {
  const letters = title.replace(/[^A-Za-zÄÖÜäöüß]/g, "");
  if (letters.length < 4 || letters !== letters.toUpperCase()) return title;
  return title.replace(/[A-Za-zÄÖÜäöüß]+/g, (word) =>
    /^[IVX]+$/.test(word) || (word.length <= 4 && !/[AEIOUÄÖÜY]/.test(word))
      ? word
      : word[0] + word.slice(1).toLowerCase(),
  );
}

function cleanTitle(text: string): string {
  return text.replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
}
