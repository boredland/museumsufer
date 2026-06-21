import { classifyEvent, classifyTalk, type EventType, eventTypeToLabel } from "@museumsufer/classify";
import type { CanonicalScrapedEvent, ScrapedLabel, ScraperContext, VenueScrapeResult } from "../types";
import { type GomusPicture, pickGomusImage } from "./_gomus-generic";

const GOMUS_API_BASE = "https://shmh.gomus.de/api/v4";
const USER_AGENT = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

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

// Maps SHMH museum_id to canonical source_slug
const SHMH_MUSEUM_MAP: Record<number, { slug: string; name: string }> = {
  1: { slug: "altonaer-museum", name: "Altonaer Museum" },
  2: { slug: "jenisch-haus", name: "Jenisch Haus" },
  6: { slug: "speicherstadtmuseum", name: "Speicherstadtmuseum" },
  8: { slug: "museum-der-arbeit", name: "Museum der Arbeit" },
  9: { slug: "deutsches-hafenmuseum", name: "Deutsches Hafenmuseum" },
  10: { slug: "museum-fuer-hamburgische-geschichte", name: "Museum für Hamburgische Geschichte" },
};

export async function scrapeShmhMuseums(_ctx: ScraperContext): Promise<VenueScrapeResult[]> {
  const byMuseum = new Map<string, CanonicalScrapedEvent[]>();

  // Initialize buckets for all known SHMH museums
  for (const info of Object.values(SHMH_MUSEUM_MAP)) {
    byMuseum.set(info.slug, []);
  }
  // exhibition id → image, for event dates that reference a parent exhibition.
  const exhibitionImageById = new Map<number, string>();

  // 1. Fetch and process Exhibitions
  try {
    const exhibitionsUrl = `${GOMUS_API_BASE}/exhibitions?per_page=100`;
    const res = await fetch(exhibitionsUrl, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const data = (await res.json()) as { exhibitions?: GomusExhibition[] };
      const list = data.exhibitions ?? [];
      for (const ex of list) {
        const exImage = pickGomusImage(ex.picture);
        if (exImage) exhibitionImageById.set(ex.id, exImage);
        const museumInfo = SHMH_MUSEUM_MAP[ex.museum_id];
        if (!museumInfo) continue;

        // An exhibition can have multiple time_frames or just start/end dates
        const timeFrame = ex.time_frames?.[0];
        const startRaw = timeFrame?.start_at ?? "1970-01-01";
        const endRaw = timeFrame?.end_at;

        const date = startRaw.substring(0, 10);
        const endDate = endRaw ? endRaw.substring(0, 10) : null;

        const description = ex.description ? cleanText(ex.description) : null;
        const title = cleanText(ex.title);

        const canonical: CanonicalScrapedEvent = {
          source_event_id: `${museumInfo.slug}|exhibition|${ex.id}`,
          title,
          description,
          date,
          time: null,
          end_date: endDate && endDate !== date ? endDate : null,
          end_time: null,
          detail_url: `https://tickets.shmh.de/de/exhibitions/${ex.id}`,
          ticket_url: `https://tickets.shmh.de/de/exhibitions/${ex.id}`,
          image_url: exImage,
          labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
        };

        // Check if there are specific coords
        if (ex.location?.latitude && ex.location?.longitude) {
          const lat = parseFloat(ex.location.latitude);
          const lon = parseFloat(ex.location.longitude);
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            canonical.lat = lat;
            canonical.lon = lon;
          }
        }

        byMuseum.get(museumInfo.slug)?.push(canonical);
      }
    }
  } catch (err) {
    console.warn(`shmh-museums exhibitions scrape failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2a. Map parent event id → image (the /dates rows carry no picture).
  const eventImageById = new Map<number, string>();
  try {
    const res = await fetch(`${GOMUS_API_BASE}/events?per_page=100`, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const data = (await res.json()) as { events?: GomusEvent[] };
      for (const ev of data.events ?? []) {
        const img = pickGomusImage(ev.picture);
        if (img) eventImageById.set(ev.id, img);
      }
    }
  } catch (err) {
    console.warn(`shmh-museums events-image scrape failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2b. Fetch and process Event Dates
  try {
    const datesUrl = `${GOMUS_API_BASE}/dates?per_page=100`;
    const res = await fetch(datesUrl, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const data = (await res.json()) as { dates?: GomusDate[] };
      const list = data.dates ?? [];
      for (const d of list) {
        const museumInfo = SHMH_MUSEUM_MAP[d.museum_id];
        if (!museumInfo) continue;

        // Gomus start_time is ISO: "2026-06-17T14:00:00+02:00"
        const date = d.start_time.substring(0, 10);
        const time = d.start_time.substring(11, 16);

        let endTime: string | null = null;
        if (d.duration) {
          try {
            const startParsed = new Date(d.start_time);
            const endParsed = new Date(startParsed.getTime() + d.duration * 60 * 1000);
            // format end time as HH:MM in local/berlin time zone context
            const endHours = String(endParsed.getHours()).padStart(2, "0");
            const endMins = String(endParsed.getMinutes()).padStart(2, "0");
            endTime = `${endHours}:${endMins}`;
          } catch {}
        }

        const title = cleanText(d.event_title || d.title);
        const description = d.description ? cleanText(d.description) : null;

        // Classify and label the event
        const eventType = classifyEvent(title, description) ?? null;
        const labels = labelsForEvent(eventType, title, description);

        const canonical: CanonicalScrapedEvent = {
          source_event_id: `${museumInfo.slug}|event-date|${d.id}`,
          title,
          description,
          date,
          time,
          end_date: null,
          end_time: endTime,
          detail_url: `https://tickets.shmh.de/de/dates/${d.id}`,
          ticket_url: `https://tickets.shmh.de/de/dates/${d.id}`,
          // Dates inherit their parent event's image, then the exhibition's.
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

        byMuseum.get(museumInfo.slug)?.push(canonical);
      }
    }
  } catch (err) {
    console.warn(`shmh-museums events scrape failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Build result
  const results: VenueScrapeResult[] = [];
  for (const [slug, events] of byMuseum) {
    const info = Object.values(SHMH_MUSEUM_MAP).find((m) => m.slug === slug);
    if (info) {
      results.push({
        source_slug: slug,
        display_name: info.name,
        events,
      });
    }
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
    .replace(/<[^>]+>/g, "") // strip html just in case
    .trim();
}
