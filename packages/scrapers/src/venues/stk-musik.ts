import { classifyMusic } from "@museumsufer/classify";
import { dateOffset, decodeEntities, sanitizeImageUrl, stripHtml, todayIso, truncate } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://stk-musik.de";
const API = `${BASE}/wp-json/tribe/events/v1/events`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;
const MAX_PAGES = 5;

interface TribeImage {
  url?: string;
  sizes?: Record<string, { url?: string }>;
}

interface TribeVenue {
  venue?: string;
}

interface TribeTag {
  name?: string;
}

interface TribeCost {
  values?: string[];
}

interface TribeEvent {
  id: number;
  slug: string;
  title: string;
  description?: string;
  url?: string;
  image?: TribeImage | false;
  start_date: string;
  end_date?: string;
  all_day?: boolean;
  cost?: string;
  cost_details?: TribeCost;
  venue?: TribeVenue | false;
  tags?: TribeTag[];
}

interface TribeResponse {
  events: TribeEvent[];
  total_pages: number;
}

export async function scrapeStKatharinen(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(180);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  let page = 1;
  let totalPages = 1;
  while (page <= Math.min(totalPages, MAX_PAGES)) {
    const url = `${API}?per_page=50&start_date=${today}&page=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`st-katharinen fetch failed: ${url} → ${res.status}`);
    const data = (await res.json()) as TribeResponse;
    totalPages = data.total_pages || 1;

    let pastHorizon = false;
    for (const raw of data.events ?? []) {
      const date = raw.start_date.slice(0, 10);
      if (date < today) continue;
      if (date > horizon) {
        pastHorizon = true;
        continue;
      }
      const slug = raw.slug || String(raw.id);
      if (seen.has(slug)) continue;
      seen.add(slug);

      events.push(mapEvent(raw));
    }

    if (pastHorizon) break;
    page++;
    if (page <= totalPages) await sleep(THROTTLE_MS);
  }

  return { source_slug: "st-katharinen", display_name: "Kantorei St. Katharinen", events };
}

function mapEvent(raw: TribeEvent): CanonicalScrapedEvent {
  const date = raw.start_date.slice(0, 10);
  const time = raw.all_day ? null : raw.start_date.slice(11, 16);
  const endTime = raw.end_date && !raw.all_day ? raw.end_date.slice(11, 16) : null;

  const title = stripHtml(decodeEntities(raw.title)).trim();
  const description = raw.description ? truncate(stripHtml(decodeEntities(raw.description)), 800) : null;
  const subtitle = raw.tags?.[0]?.name ? decodeEntities(raw.tags[0].name) : null;
  const genre = classifyMusic(title, subtitle, description, "sacred");

  return {
    source_event_id: raw.slug || String(raw.id),
    title,
    subtitle,
    description,
    date,
    time,
    end_time: endTime && endTime !== time ? endTime : null,
    detail_url: raw.url ?? null,
    ticket_url: null,
    image_url: pickImage(raw.image),
    price_min: extractPrice(raw.cost, raw.cost_details),
    price_max: null,
    performers: null,
    venue_room: raw.venue ? (raw.venue.venue ?? null) : null,
    labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
  };
}

function pickImage(image: TribeImage | false | undefined): string | null {
  if (!image) return null;
  const sizes = image.sizes ?? {};
  const candidate = sizes.full?.url ?? sizes.large?.url ?? sizes.medium_large?.url ?? sizes.medium?.url ?? image.url;
  return sanitizeImageUrl(candidate ?? null);
}

/** Tribe's `cost` is a free-text field — "frei", "Eintritt frei", "Kollekte",
 *  "Spende" all map to null since the catalogue expects numeric Euros. */
function extractPrice(cost: string | undefined, details: TribeCost | undefined): number | null {
  if (details?.values && details.values.length > 0) {
    const numbers = details.values.map((v) => Number(String(v).replace(",", "."))).filter((n) => Number.isFinite(n));
    if (numbers.length > 0) return Math.min(...numbers);
  }
  const text = cost?.trim();
  if (!text) return null;
  if (/^(frei|kollekte|spende|eintritt frei)/i.test(text)) return null;
  const match = text.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
