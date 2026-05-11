import {
  dateOffset,
  decodeEntities,
  nullIfMidnight,
  sanitizeImageUrl,
  slugify,
  stripHtml,
  todayIso,
  truncate,
} from "@museumsufer/core";
import { classify } from "../genre-heuristics";
import type { ScrapedEvent, ScrapeResult } from "../types";

const BASE = "https://www.jazz-frankfurt.de";
const LISTING = `${BASE}/termine/aktuelle-termine/`;
const UA = "konzert.haus crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;
const MAX_REQUESTS = 30;

/**
 * Source venue name (as it appears in JSON-LD `location.name` on
 * jazz-frankfurt.de) → our canonical `venue_slug`. Used as forward-looking
 * metadata so Unit 16's cross-venue dedup pass can resolve overlap with
 * the corresponding partner-venue scrapers. Match keys are lower-cased.
 *
 * Events whose source venue is NOT in this table are kept under the
 * aggregator's own slug and tagged with "@ VenueName" in the subtitle so
 * users can still see which club is hosting.
 */
const VENUE_SLUG_BY_NAME: Record<string, string> = {
  brotfabrik: "brotfabrik",
  "palmengarten frankfurt": "jazz-palmengarten",
  palmengarten: "jazz-palmengarten",
  "jazz im palmengarten": "jazz-palmengarten",
  holzhausenschlösschen: "holzhausenschloesschen",
  holzhausenschloesschen: "holzhausenschloesschen",
  "alte oper frankfurt": "alte-oper",
  "alte oper": "alte-oper",
  "dr. hoch's konservatorium": "dr-hochs-konservatorium",
  "dr. hochs konservatorium": "dr-hochs-konservatorium",
  romanfabrik: "romanfabrik",
};

interface MusicEventLd {
  "@type"?: string;
  name?: string;
  description?: string;
  image?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  doorTime?: string;
  eventStatus?: string;
  location?: { name?: string };
  offers?: Array<{ name?: string; price?: string | number; url?: string }>;
  performer?: Array<{ name?: string }>;
}

export async function scrapeJazzFrankfurt(): Promise<ScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(90);
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();
  let requests = 0;
  let page = 1;

  while (requests < MAX_REQUESTS) {
    const url = page === 1 ? LISTING : `${LISTING}page/${page}/`;
    if (requests > 0) await sleep(THROTTLE_MS);
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
    requests++;
    if (res.status === 404) break;
    if (!res.ok) throw new Error(`jazz-frankfurt fetch failed: ${url} → ${res.status}`);
    const html = await res.text();

    let pastHorizon = false;
    let foundOnPage = 0;
    for (const raw of extractMusicEvents(html)) {
      foundOnPage++;
      const date = raw.startDate?.slice(0, 10);
      if (!date || date < today) continue;
      if (date > horizon) {
        pastHorizon = true;
        continue;
      }
      const scraped = buildEvent(raw, date);
      if (!scraped) continue;
      const dedup = `${scraped.slug}|${scraped.date}|${scraped.time ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      events.push(scraped);
    }

    if (foundOnPage === 0 || pastHorizon) break;
    if (!hasNextPage(html)) break;
    page++;
  }

  return { venue_slug: "jazz-frankfurt", events };
}

function buildEvent(raw: MusicEventLd, date: string): ScrapedEvent | null {
  if (raw["@type"] !== "MusicEvent") return null;
  if (!raw.startDate || !raw.name || !raw.url) return null;

  const time = nullIfMidnight(raw.startDate.slice(11, 16));
  const endTime = raw.endDate ? nullIfMidnight(raw.endDate.slice(11, 16)) : null;

  const titleRaw = stripHtml(decodeEntities(raw.name)).trim();
  if (!titleRaw) return null;
  const cancelled = /^fällt (leider )?aus/i.test(titleRaw) || raw.eventStatus?.includes("EventCancelled") === true;
  const title = cancelled ? titleRaw.replace(/^fällt (leider )?aus:?\s*/i, "").trim() || titleRaw : titleRaw;

  const sourceVenueName = raw.location?.name ? stripHtml(decodeEntities(raw.location.name)).trim() : null;
  const mappedSlug = sourceVenueName ? lookupVenueSlug(sourceVenueName) : null;

  const subtitle = formatSubtitle(cancelled, sourceVenueName);

  const performers = formatPerformers(raw.performer, title);
  const description = raw.description ? truncate(stripHtml(decodeEntities(raw.description)), 800) : null;

  const detailUrl = raw.url.trim() || null;
  const slug = detailUrl ? extractSlug(detailUrl) : `${date}-${slugify(title)}`;
  const { priceMin, priceMax, ticketUrl } = parseOffers(raw.offers);

  // venue_room captures the source venue when the event maps to a partner
  // we already track separately, so Unit 16's dedup can join on it.
  const venueRoom = mappedSlug && sourceVenueName ? sourceVenueName : null;

  return {
    slug,
    title,
    subtitle,
    description,
    date,
    time,
    end_time: endTime && endTime !== time ? endTime : null,
    // Exclude subtitle from genre classification — it carries the source
    // venue ("@ Alte Nikolaikirche") which would wrongly trigger "sacred".
    genre: classify(title, null, description, "jazz"),
    image_url: sanitizeImageUrl(raw.image),
    detail_url: detailUrl,
    ticket_url: ticketUrl,
    price_min: priceMin,
    price_max: priceMax,
    venue_room: venueRoom,
    performers,
  };
}

function formatSubtitle(cancelled: boolean, venueName: string | null): string | null {
  const parts: string[] = [];
  if (cancelled) parts.push("Fällt aus");
  if (venueName) parts.push(`@ ${venueName}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatPerformers(performer: MusicEventLd["performer"], title: string): string | null {
  const names = (performer ?? [])
    .map((p) => (p.name ? stripHtml(decodeEntities(p.name)).trim() : ""))
    .filter((n) => n && n.toLowerCase() !== title.toLowerCase());
  return names.length > 0 ? names.join(", ") : null;
}

function lookupVenueSlug(name: string): string | null {
  const key = normalizeVenueKey(name);
  if (VENUE_SLUG_BY_NAME[key]) return VENUE_SLUG_BY_NAME[key];
  for (const [needle, slug] of Object.entries(VENUE_SLUG_BY_NAME)) {
    if (key.includes(needle)) return slug;
  }
  return null;
}

function normalizeVenueKey(name: string): string {
  return name.toLowerCase().replace(/[’‘`]/g, "'").trim();
}

function parseOffers(offers: MusicEventLd["offers"]): {
  priceMin: number | null;
  priceMax: number | null;
  ticketUrl: string | null;
} {
  if (!offers || offers.length === 0) return { priceMin: null, priceMax: null, ticketUrl: null };
  const prices: number[] = [];
  let ticketUrl: string | null = null;
  for (const offer of offers) {
    const raw = offer.price;
    if (raw != null && raw !== "") {
      const n = typeof raw === "number" ? raw : parseFloat(raw);
      if (Number.isFinite(n) && n > 0) prices.push(n);
    }
    if (!ticketUrl && offer.url && /^https?:\/\//.test(offer.url) && !offer.url.includes("jazz-frankfurt.de")) {
      ticketUrl = offer.url.trim();
    }
  }
  if (prices.length === 0) return { priceMin: null, priceMax: null, ticketUrl };
  return {
    priceMin: Math.min(...prices),
    priceMax: prices.length > 1 ? Math.max(...prices) : null,
    ticketUrl,
  };
}

function extractSlug(detailUrl: string): string {
  const match = detailUrl.match(/\/veranstaltungen\/([^/]+)\/?/);
  if (match) return match[1];
  try {
    return (
      new URL(detailUrl).pathname
        .replace(/^\/|\/$/g, "")
        .split("/")
        .pop() ?? detailUrl
    );
  } catch {
    return detailUrl;
  }
}

/**
 * Pull every `<script type="application/ld+json">` payload, parse it, and
 * yield each MusicEvent entry. The site embeds one JSON-LD script per
 * listing item (plus a site-wide WebSite block we ignore).
 */
function extractMusicEvents(html: string): MusicEventLd[] {
  const events: MusicEventLd[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const payload = match[1].trim();
    if (!payload.includes("MusicEvent")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of arr) {
      if (item && typeof item === "object" && (item as MusicEventLd)["@type"] === "MusicEvent") {
        events.push(item as MusicEventLd);
      }
    }
  }
  return events;
}

function hasNextPage(html: string): boolean {
  return /class=["'][^"']*\bnext\b[^"']*page-numbers/.test(html);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
