import { todayIso } from "../date";
import { decodeEntities, slugify, stripHtml } from "../shared";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

/**
 * Reservix's per-organizer subdomain (e.g. `21765.reservix.de`,
 * `tigerpalast-variete.reservix.de`) ships an `/events`, `/events/2`, …
 * paginated listing with one `<a class="c-list-item-event">` per
 * dated performance. Each card carries:
 *
 *   - `data-sync-id="<eventId>"`               unique dated event id
 *   - `<time datetime="YYYY-MM-DDTHH:MM:SS">`  performance datetime
 *   - `<h2 class="c-list-item-event__headline">title</h2>`
 *   - `<p class="c-list-item-event__subtitle">byline</p>` (optional)
 *   - `<p class="c-list-item-event__venue-name">room / venue</p>`
 *   - `<img src=".../detailGroup_<groupId>.jpg">`  group image (gid links shows)
 *   - `<span>ab X €</span>` minimum price
 *   - `href` is the dated ticket URL
 *
 * CloudFront 403's plain UAs, so callers must use browser-style headers.
 */

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export const RESERVIX_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
  "Accept-Language": "de-DE,de;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

const MAX_PAGES = 6;

const CARD_RE = /<a\b[^>]*\bclass="[^"]*\bc-list-item-event\b[^"]*"[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

export interface ReservixCard {
  ticketUrl: string;
  date: string;
  time: string;
  datetime: string;
  groupId: string | null;
  syncId: string | null;
  title: string;
  subtitle: string | null;
  venueRoom: string | null;
  priceMin: number | null;
  image: string | null;
  soldOut: boolean;
}

export async function fetchReservixListing(host: string): Promise<ReservixCard[]> {
  const out: ReservixCard[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? `https://${host}/events` : `https://${host}/events/${page}`;
    let html: string;
    try {
      const res = await fetch(url, { headers: RESERVIX_HEADERS });
      if (!res.ok) break;
      html = await res.text();
    } catch (err) {
      console.warn(`Reservix fetch ${url} failed:`, err);
      break;
    }
    const before = out.length;
    out.push(...parseReservixListing(html));
    if (out.length === before) break;
  }
  return out;
}

export function parseReservixListing(html: string): ReservixCard[] {
  const out: ReservixCard[] = [];
  for (const m of html.matchAll(CARD_RE)) {
    const href = decodeEntities(m[1]);
    const inner = m[2];

    const datetime = inner.match(/<time\s+datetime="([^"]+)"/i)?.[1];
    if (!datetime) continue;
    const date = datetime.slice(0, 10);
    const time = datetime.slice(11, 16);

    const groupId = inner.match(/detailGroup_(\d+)\.(?:jpe?g|png|webp)/i)?.[1] ?? null;
    const syncId = m[0].match(/\bdata-sync-id="(\d+)"/)?.[1] ?? null;

    const title = stripHtml(inner.match(/<h2\s+class="c-list-item-event__headline">([\s\S]*?)<\/h2>/i)?.[1] ?? "");
    if (!title) continue;
    const subtitle =
      stripHtml(inner.match(/<p\s+class="c-list-item-event__subtitle">([\s\S]*?)<\/p>/i)?.[1] ?? "") || null;
    const venueRoom =
      stripHtml(inner.match(/<p\s+class="c-list-item-event__venue-name[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "") ||
      null;

    const priceText = inner.match(
      /<div\s+class="c-list-item-event__event-min-price">[\s\S]*?<span>\s*ab\s+([\d.,]+)\s*€/i,
    )?.[1];
    const priceMin = parsePriceEuro(priceText);

    const image =
      inner.match(/<img[^>]*\bsrc="([^"]+detailGroup_\d+\.[a-z]+)"/i)?.[1] ??
      inner.match(/<img[^>]*\bsrc="([^"]+detailEvent_\d+\.[a-z]+)"/i)?.[1] ??
      null;

    const soldOut = /\bAUSVERKAUFT\b/.test(inner);

    out.push({
      ticketUrl: href,
      date,
      time,
      datetime,
      groupId,
      syncId,
      title,
      subtitle,
      venueRoom,
      priceMin,
      image,
      soldOut,
    });
  }
  return out;
}

export interface ReservixScrapeOptions {
  theaterSlug: string;
  host: string;
  /** Optional override for the venue room when Reservix's own value is too generic. */
  defaultVenueRoom?: string | null;
}

export async function scrapeReservixHost(opts: ReservixScrapeOptions): Promise<ScrapeResult> {
  const cards = await fetchReservixListing(opts.host);
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const card of cards) {
    if (card.date < today) continue;

    const slug = card.groupId ? `g-${card.groupId}` : slugify(card.title);
    const dedup = `${slug}|${card.date}|${card.time}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    if (!showsBySlug.has(slug)) {
      showsBySlug.set(slug, {
        slug,
        title: card.title,
        subtitle: card.subtitle,
        description: card.subtitle,
        detail_url: card.ticketUrl,
        image_url: card.image,
      });
    }

    performances.push({
      show_slug: slug,
      date: card.date,
      time: card.time,
      end_time: null,
      venue_room: card.venueRoom ?? opts.defaultVenueRoom ?? null,
      provider_event_id: card.syncId,
      ticket_url: card.ticketUrl,
      status: card.soldOut ? "sold_out" : "available",
      price_min: card.soldOut ? null : (card.priceMin ?? null),
    });
  }

  return {
    theater_slug: opts.theaterSlug,
    shows: [...showsBySlug.values()],
    performances,
  };
}

function parsePriceEuro(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/^(\d+(?:\.\d{3})*)(?:[,](\d{2}))?$/);
  if (!m) return null;
  const whole = parseInt(m[1].replace(/\./g, ""), 10);
  if (!Number.isFinite(whole)) return null;
  return m[2] ? whole + Math.round(parseInt(m[2], 10) / 100) : whole;
}
