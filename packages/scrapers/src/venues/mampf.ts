import { classifyMusic } from "@museumsufer/classify";
import {
  dateOffset,
  decodeEntities,
  nullIfMidnight,
  sanitizeImageUrl,
  slugify,
  stripHtml,
  toBerlinDate,
  toBerlinTime,
  todayIso,
  truncate,
} from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.mampf-jazz.com";
const LISTING_URL = `${BASE}/event-list`;
const EVENTS_API = `${BASE}/_api/wix-one-events-server/web/events`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const PAGE_SIZE = 50;
const MAX_PAGES = 10;

/**
 * Wix Events viewer JWT — present in the rendered HTML of any page that
 * carries the events widget. Token shape is `<signature>.<base64-payload>`
 * containing `instanceId`, `appDefId`, `metaSiteId`, signDate, etc.
 */
const INSTANCE_RE = /"instance"\s*:\s*"([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)"/;

interface WixEvent {
  id?: string;
  title?: string;
  description?: string;
  shortDescription?: string;
  slug?: string;
  status?: string;
  scheduling?: {
    startDate?: string;
    endDate?: string;
    timeZoneId?: string;
    config?: {
      startDate?: string;
      endDate?: string;
      timeZoneId?: string;
    };
  };
  location?: { name?: string };
  mainImage?: { url?: string; id?: string };
  url?: { base?: string; path?: string };
  eventUrl?: string;
}

/**
 * Mampf runs on Wix with the Wix Events widget. The viewer fetches events
 * client-side from `/_api/wix-one-events-server/web/events`, gated by a
 * site-scoped JWT (the `instance` token) embedded in any page that hosts
 * the widget. We pull the token from `/event-list` and replay the same
 * request to get the canonical event list as JSON.
 */
export async function scrapeMampf(): Promise<VenueScrapeResult> {
  const instance = await fetchInstance();
  const today = todayIso();
  const horizon = dateOffset(120);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const url = `${EVENTS_API}?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        Authorization: instance,
      },
    });
    if (!res.ok) throw new Error(`mampf events fetch failed: ${url} → ${res.status}`);
    const json = (await res.json()) as { events?: WixEvent[]; total?: number };
    const batch = json.events ?? [];
    if (batch.length === 0) break;

    for (const raw of batch) {
      const event = toCanonical(raw);
      if (!event) continue;
      if (event.date < today || event.date > horizon) continue;
      if (seen.has(event.source_event_id)) continue;
      seen.add(event.source_event_id);
      events.push(event);
    }

    if (offset + batch.length >= (json.total ?? batch.length)) break;
  }

  return { source_slug: "mampf", display_name: "Jazzlokal Mampf", events };
}

async function fetchInstance(): Promise<string> {
  const res = await fetch(LISTING_URL, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) throw new Error(`mampf listing fetch failed: ${LISTING_URL} → ${res.status}`);
  const html = await res.text();
  const match = INSTANCE_RE.exec(html);
  if (!match) throw new Error("mampf: events instance token not found in /event-list HTML");
  return match[1];
}

function toCanonical(raw: WixEvent): CanonicalScrapedEvent | null {
  const title = decodeEntities(raw.title?.trim() ?? "");
  if (!title) return null;

  const startRaw = raw.scheduling?.startDate ?? raw.scheduling?.config?.startDate ?? null;
  if (!startRaw) return null;
  const start = new Date(startRaw);
  if (Number.isNaN(start.getTime())) return null;
  const date = toBerlinDate(start);
  const time = toBerlinTime(start);

  const endRaw = raw.scheduling?.endDate ?? raw.scheduling?.config?.endDate ?? null;
  let endTime: string | null = null;
  if (endRaw) {
    const end = new Date(endRaw);
    if (!Number.isNaN(end.getTime()) && toBerlinDate(end) === date) {
      const t = toBerlinTime(end);
      if (t !== time) endTime = t;
    }
  }

  const descSrc = raw.description ?? raw.shortDescription ?? "";
  const description = descSrc ? truncate(stripHtml(decodeEntities(descSrc)), 600) : null;

  const detailUrl = pickDetailUrl(raw);
  const imageUrl = sanitizeImageUrl(pickImageUrl(raw));
  const genre = classifyMusic(title, null, description, "jazz");

  return {
    source_event_id: raw.id ?? raw.slug ?? slugify(`${date}-${title}`),
    title,
    subtitle: null,
    description,
    date,
    time: nullIfMidnight(time),
    end_time: nullIfMidnight(endTime),
    detail_url: detailUrl,
    ticket_url: detailUrl,
    image_url: imageUrl,
    price_min: null,
    price_max: null,
    performers: title,
    venue_room: null,
    raw_category: "music",
    labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
  };
}

function pickDetailUrl(raw: WixEvent): string | null {
  if (raw.eventUrl) return raw.eventUrl;
  if (raw.url?.base && raw.url?.path) return `${raw.url.base}${raw.url.path}`;
  if (raw.slug) return `${BASE}/event-info/${raw.slug}`;
  return null;
}

function pickImageUrl(raw: WixEvent): string | null {
  if (raw.mainImage?.url) return raw.mainImage.url;
  const id = raw.mainImage?.id;
  if (!id) return null;
  const stripped = id.replace(/^media\//, "");
  return `https://static.wixstatic.com/media/${stripped}`;
}
