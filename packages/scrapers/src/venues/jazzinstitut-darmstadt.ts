import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * Jazzinstitut Darmstadt — concerts, jam sessions and summer workshops in the
 * vaulted cellar and at partner venues around Darmstadt. The site uses The
 * Events Calendar (TEC) for WordPress; its public REST API exposes all future
 * events with date, time, description, image and cost.
 */

const BASE = "https://www.jazzinstitut.de";
const API_URL = `${BASE}/wp-json/tribe/events/v1/events`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.8557;
const LON = 8.656;

interface TecImage {
  url?: string;
}

interface TecCostDetails {
  values?: string[];
}

interface TecVenue {
  venue?: string;
  address?: string;
}

interface TecEvent {
  id: number;
  title: string;
  description?: string;
  url: string;
  start_date: string;
  end_date?: string;
  image?: TecImage | null;
  cost_details?: TecCostDetails | null;
  venue?: TecVenue | null;
}

interface TecEventsResponse {
  events: TecEvent[];
  total?: number;
  total_pages?: number;
}

export async function scrapeJazzinstitutDarmstadt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(API_URL);
    url.searchParams.set("per_page", "50");
    url.searchParams.set("start_date", today);
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`jazzinstitut list fetch failed: ${res.status}`);

    const data = (await res.json()) as TecEventsResponse;
    if (!data.events || !Array.isArray(data.events)) break;

    totalPages = data.total_pages ?? 1;

    for (const ev of data.events) {
      const start = parseDateTime(ev.start_date);
      if (!start || start.date < today) continue;

      const end = ev.end_date ? parseDateTime(ev.end_date) : null;
      const title = decodeEntities(stripHtml(ev.title)).trim();
      if (!title) continue;

      const description = ev.description ? stripHtml(ev.description).replace(/\s+/g, " ").trim() : null;

      const priceMin = pickMinPrice(ev.cost_details?.values);

      events.push({
        source_event_id: String(ev.id),
        title,
        subtitle: null,
        description: description || null,
        date: start.date,
        time: start.time,
        end_date: end && end.date !== start.date ? end.date : null,
        end_time: end && end.date === start.date && end.time !== start.time ? end.time : null,
        detail_url: ev.url,
        ticket_url: null,
        image_url: ev.image?.url ?? null,
        price_min: priceMin,
        venue_room: ev.venue?.venue ?? null,
        city: "darmstadt",
        lat: LAT,
        lon: LON,
        labels: resolveStageLabels({
          title,
          hint: description,
          defaultLabel: "music:jazz",
          classifier: "scraper-hardcoded",
          confidence: 0.85,
        }),
      });
    }

    page++;
  } while (page <= totalPages);

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return {
    source_slug: "jazzinstitut-darmstadt",
    display_name: "Jazzinstitut Darmstadt",
    events,
  };
}

function parseDateTime(raw: string): { date: string; time: string } | null {
  const [datePart, timePart] = raw.split(" ");
  if (!datePart || !timePart) return null;
  return { date: datePart, time: timePart.slice(0, 5) };
}

function pickMinPrice(values: string[] | undefined): number | null {
  if (!values || values.length === 0) return null;
  let min: number | null = null;
  for (const raw of values) {
    const n = Number.parseFloat(raw.replace(",", "."));
    if (Number.isFinite(n) && (min === null || n < min)) min = n;
  }
  return min && min > 0 ? min : null;
}
