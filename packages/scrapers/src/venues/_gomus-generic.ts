import { classifyEvent, classifyTalk, type EventType, eventTypeToLabel } from "@museumsufer/classify";
import { addClockMinutes } from "../_time";
import type { CanonicalScrapedEvent, ScrapedLabel, ScraperContext, VenueScrapeResult } from "../types";

const USER_AGENT = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

/** go~mus serves several rendition URLs per image; `detail` is the largest
 *  card-sized variant, with progressively smaller fallbacks. */
export interface GomusPicture {
  original?: string | null;
  detail?: string | null;
  detail_3x2?: string | null;
  article?: string | null;
  teaser?: string | null;
  preview?: string | null;
}

/** Pick the best available rendition. `detail`/`article` are ~card-sized;
 *  `original` can be very large but is a safe last resort. */
export function pickGomusImage(picture: GomusPicture | null | undefined): string | null {
  if (!picture) return null;
  return picture.detail ?? picture.article ?? picture.detail_3x2 ?? picture.teaser ?? picture.original ?? null;
}

interface GomusExhibition {
  id: number;
  museum_id: number;
  title: string;
  description: string | null;
  picture?: GomusPicture | null;
  time_frames?: Array<{ start_at?: string; end_at?: string }>;
  location?: {
    name: string;
    street: string;
    zip: string;
    latitude?: string;
    longitude?: string;
  };
}

interface GomusEvent {
  id: number;
  picture?: GomusPicture | null;
}

interface GomusDate {
  id: number;
  event_id: number;
  exhibition_id?: number | null;
  museum_id: number;
  title: string;
  event_title: string;
  event_sub_title: string | null;
  start_time: string;
  duration: number; // in minutes
  description: string | null;
  location?: {
    name: string;
    street: string;
    zip: string;
    latitude?: string;
    longitude?: string;
  };
}

interface GomusScraperConfig {
  slug: string;
  name: string;
  apiBase: string;
  ticketBase: string;
  locationMapping?: Record<number, { slug: string; name: string }>;
}

export async function scrapeGomusMuseum(
  config: GomusScraperConfig,
  _ctx: ScraperContext,
): Promise<VenueScrapeResult[]> {
  const byMuseum = new Map<string, CanonicalScrapedEvent[]>();
  // exhibition id → image, for event dates that reference a parent exhibition.
  const exhibitionImageById = new Map<number, string>();

  if (config.locationMapping) {
    for (const info of Object.values(config.locationMapping)) {
      byMuseum.set(info.slug, []);
    }
  } else {
    byMuseum.set(config.slug, []);
  }

  // 1. Fetch and process Exhibitions
  try {
    const exhibitionsUrl = `${config.apiBase}/exhibitions?per_page=100`;
    const res = await fetch(exhibitionsUrl, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const data = (await res.json()) as { exhibitions?: GomusExhibition[] };
      const list = data.exhibitions ?? [];
      for (const ex of list) {
        const exImage = pickGomusImage(ex.picture);
        if (exImage) exhibitionImageById.set(ex.id, exImage);
        let slug = config.slug;
        let _displayName = config.name;

        if (config.locationMapping) {
          const mapped = config.locationMapping[ex.museum_id];
          if (!mapped) continue;
          slug = mapped.slug;
          _displayName = mapped.name;
        }

        const timeFrame = ex.time_frames?.[0];
        const startRaw = timeFrame?.start_at ?? "1970-01-01";
        const endRaw = timeFrame?.end_at;

        const date = startRaw.substring(0, 10);
        const endDate = endRaw ? endRaw.substring(0, 10) : null;

        const description = ex.description ? cleanText(ex.description) : null;
        const title = cleanText(ex.title);

        const canonical: CanonicalScrapedEvent = {
          source_event_id: `${slug}|exhibition|${ex.id}`,
          title,
          description,
          date,
          time: null,
          end_date: endDate && endDate !== date ? endDate : null,
          end_time: null,
          detail_url: `${config.ticketBase}/exhibitions/${ex.id}`,
          ticket_url: `${config.ticketBase}/exhibitions/${ex.id}`,
          image_url: exImage,
          labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
        };

        if (ex.location?.latitude && ex.location?.longitude) {
          const lat = parseFloat(ex.location.latitude);
          const lon = parseFloat(ex.location.longitude);
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            canonical.lat = lat;
            canonical.lon = lon;
          }
        }

        byMuseum.get(slug)?.push(canonical);
      }
    }
  } catch (err) {
    console.warn(`${config.slug} exhibitions scrape failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2a. Fetch the parent events to map event id → image (the /dates rows
  //     carry no picture of their own, only an event_id / exhibition_id).
  const eventImageById = new Map<number, string>();
  try {
    const eventsUrl = `${config.apiBase}/events?per_page=100`;
    const res = await fetch(eventsUrl, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const data = (await res.json()) as { events?: GomusEvent[] };
      for (const ev of data.events ?? []) {
        const img = pickGomusImage(ev.picture);
        if (img) eventImageById.set(ev.id, img);
      }
    }
  } catch (err) {
    console.warn(`${config.slug} events-image scrape failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2b. Fetch and process Event Dates
  try {
    const datesUrl = `${config.apiBase}/dates?per_page=100`;
    const res = await fetch(datesUrl, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const data = (await res.json()) as { dates?: GomusDate[] };
      const list = data.dates ?? [];
      for (const d of list) {
        let slug = config.slug;
        let _displayName = config.name;

        if (config.locationMapping) {
          const mapped = config.locationMapping[d.museum_id];
          if (!mapped) continue;
          slug = mapped.slug;
          _displayName = mapped.name;
        }

        const date = d.start_time.substring(0, 10);
        const time = d.start_time.substring(11, 16);

        // Literal local start (`time`) + duration; see addClockMinutes for why
        // we avoid `new Date(...).getHours()` (timezone-skewed, non-deterministic).
        const endTime = d.duration ? addClockMinutes(time, d.duration) : null;

        const title = cleanText(d.event_title || d.title);
        const description = d.description ? cleanText(d.description) : null;

        const eventType = classifyEvent(title, description) ?? null;
        const labels = labelsForEvent(eventType, title, description);

        const canonical: CanonicalScrapedEvent = {
          source_event_id: `${slug}|event-date|${d.id}`,
          title,
          description,
          date,
          time,
          end_date: null,
          end_time: endTime,
          detail_url: `${config.ticketBase}/dates/${d.id}`,
          ticket_url: `${config.ticketBase}/dates/${d.id}`,
          // Dates inherit their parent event's image, falling back to the
          // exhibition the date belongs to.
          image_url:
            eventImageById.get(d.event_id) ??
            (d.exhibition_id != null ? (exhibitionImageById.get(d.exhibition_id) ?? null) : null),
          labels,
        };

        if (d.location?.latitude && d.location?.longitude) {
          const lat = parseFloat(d.location.latitude);
          const lon = parseFloat(d.location.longitude);
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            canonical.lat = lat;
            canonical.lon = lon;
          }
        }

        byMuseum.get(slug)?.push(canonical);
      }
    }
  } catch (err) {
    console.warn(`${config.slug} events scrape failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Build result
  const results: VenueScrapeResult[] = [];
  for (const [slug, events] of byMuseum) {
    let displayName = config.name;
    if (config.locationMapping) {
      const info = Object.values(config.locationMapping).find((m) => m.slug === slug);
      if (info) displayName = info.name;
    }
    results.push({
      source_slug: slug,
      display_name: displayName,
      events,
    });
  }

  results.sort((a, b) => a.source_slug.localeCompare(b.source_slug));
  return results;
}

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

function cleanText(text: string): string {
  return text
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}
