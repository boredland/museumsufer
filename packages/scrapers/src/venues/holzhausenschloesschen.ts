import { classifyMusic } from "@museumsufer/classify";
import {
  berlinNow,
  dateOffset,
  decodeEntities,
  normalizeUrl,
  sanitizeImageUrl,
  slugify,
  stripHtml,
  todayIso,
} from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.frankfurter-buergerstiftung.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;
const MAX_MONTHS = 12;

/**
 * Bürgerstiftung lists each month at /programm/veranstaltungen/musik/YYYY-MM.
 * Tiles render with title/subtitle/date/time/image — everything except ticket
 * URL, price, and room — so detail pages are fetched only for those three.
 * The listing's "Nächsten Monat laden" link skips empty months, which keeps
 * us from probing the blank summer break (Holzhausen pauses Jul–Aug).
 */
const TILE_RE = /<a\s+class="w__tile[^"]*"\s+data-date="(\d{4}-\d{2}-\d{2})"\s+href="([^"]+)">([\s\S]*?)<\/a>/g;
const TIME_RE = /<span class="w__faded">\s*(\d{1,2})[:.](\d{2})/;
const TITLE_RE = /<strong class="w__tile--title">([\s\S]*?)<\/strong>/;
const SUBTITLE_RE = /<span class="w__tile--subtitle">([\s\S]*?)<\/span>/;
const SRCSET_RE = /<img[^>]+srcset="([^"]+)"/;
const IMG_SRC_RE = /<img[^>]+src="([^"]+)"/;
const NEXT_MONTH_RE = /data-f="load-month"\s+href="([^"]+)"/;
const PRICE_RE = /<strong>\s*Eintritt:\s*<\/strong>([^<]+)/i;
const RESERVIX_RE = /href="(https?:\/\/[^"]*reservix[^"]+)"/i;
const LOCATION_DETAIL_RE = /class="w__program--location[^"]*"[^>]*>([\s\S]*?)<\/p>/i;

export async function scrapeHolzhausenschloesschen(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(180);
  const events: CanonicalScrapedEvent[] = [];
  const seenSlugs = new Set<string>();

  let monthUrl: string | null = `${BASE}/programm/veranstaltungen/musik/${currentMonthSlug()}`;
  let visited = 0;

  while (monthUrl && visited < MAX_MONTHS) {
    const html = await fetchText(monthUrl);
    visited++;

    let pastHorizon = false;
    for (const tile of parseTiles(html)) {
      if (tile.date < today) continue;
      if (tile.date > horizon) {
        pastHorizon = true;
        continue;
      }
      if (seenSlugs.has(tile.slug)) continue;
      seenSlugs.add(tile.slug);

      await sleep(THROTTLE_MS);
      const detail = await fetchDetail(tile.detailUrl);
      const genre = classifyMusic(tile.title, tile.subtitle, null, "chamber");

      events.push({
        source_event_id: tile.slug,
        title: tile.title,
        subtitle: tile.subtitle,
        description: null,
        date: tile.date,
        time: tile.time,
        end_time: null,
        detail_url: tile.detailUrl,
        ticket_url: detail.ticketUrl,
        image_url: tile.imageUrl,
        price_min: detail.priceMin,
        price_max: detail.priceMax,
        performers: tile.subtitle,
        venue_room: detail.venueRoom,
        labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
      });
    }

    if (pastHorizon) break;
    const next = NEXT_MONTH_RE.exec(html)?.[1];
    monthUrl = next ? normalizeUrl(next, BASE) : null;
    if (monthUrl) await sleep(THROTTLE_MS);
  }

  return { source_slug: "holzhausenschloesschen", display_name: "Holzhausenschlösschen", events };
}

interface Tile {
  slug: string;
  date: string;
  time: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  detailUrl: string;
}

function parseTiles(html: string): Tile[] {
  const tiles: Tile[] = [];
  for (const m of html.matchAll(TILE_RE)) {
    const date = m[1];
    const href = decodeEntities(m[2]);
    const inner = m[3];

    const timeMatch = TIME_RE.exec(inner);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

    const titleRaw = TITLE_RE.exec(inner)?.[1];
    if (!titleRaw) continue;
    const title = stripHtml(decodeEntities(titleRaw));
    if (!title) continue;

    const subtitleRaw = SUBTITLE_RE.exec(inner)?.[1];
    const subtitle = subtitleRaw ? stripHtml(decodeEntities(subtitleRaw)) || null : null;

    const detailUrl = normalizeUrl(href, BASE);
    if (!detailUrl) continue;
    const slug = slugFromDetailUrl(detailUrl) ?? slugify(`${date}-${title}`);

    tiles.push({
      slug,
      date,
      time,
      title,
      subtitle,
      imageUrl: pickImage(inner),
      detailUrl,
    });
  }
  return tiles;
}

interface DetailFields {
  ticketUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  venueRoom: string | null;
}

async function fetchDetail(url: string): Promise<DetailFields> {
  let html: string;
  try {
    html = await fetchText(url);
  } catch {
    return { ticketUrl: null, priceMin: null, priceMax: null, venueRoom: null };
  }

  const reservix = RESERVIX_RE.exec(html)?.[1] ?? null;
  const priceText = PRICE_RE.exec(html)?.[1];
  const prices = priceText ? extractPrices(priceText) : [];

  return {
    ticketUrl: reservix ? decodeEntities(reservix) : null,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length > 1 ? Math.max(...prices) : null,
    venueRoom: detectRoom(html),
  };
}

function extractPrices(text: string): number[] {
  const decoded = decodeEntities(text);
  const prices: number[] = [];
  for (const m of decoded.matchAll(/€\s*(\d+)(?:[,.](\d{1,2}))?/g)) {
    const euros = parseInt(m[1], 10);
    const cents = m[2] ? parseInt(m[2].padEnd(2, "0"), 10) : 0;
    prices.push(euros + cents / 100);
  }
  return prices;
}

function detectRoom(html: string): string | null {
  const locationRaw = LOCATION_DETAIL_RE.exec(html)?.[1];
  const location = locationRaw ? stripHtml(decodeEntities(locationRaw)).toLowerCase() : "";
  if (location.includes("garten")) return "Gartensaal";
  return "Schlösschen";
}

function pickImage(html: string): string | null {
  const srcset = SRCSET_RE.exec(html)?.[1];
  if (srcset) {
    const best = pickLargestFromSrcset(srcset);
    if (best) return sanitizeImageUrl(normalizeUrl(best, BASE));
  }
  const src = IMG_SRC_RE.exec(html)?.[1];
  return src ? sanitizeImageUrl(normalizeUrl(src, BASE)) : null;
}

function pickLargestFromSrcset(srcset: string): string | null {
  let best: { url: string; width: number } | null = null;
  for (const entry of srcset.split(",")) {
    const [url, descriptor] = entry.trim().split(/\s+/);
    const width = descriptor?.endsWith("w") ? parseInt(descriptor, 10) : 0;
    if (!best || width > best.width) best = { url, width };
  }
  return best?.url ?? null;
}

function slugFromDetailUrl(url: string): string | null {
  const match = /\/programm\/veranstaltungen\/\d{4}-\d{2}-\d{2}\/([^/?#]+)/.exec(url);
  return match ? match[1] : null;
}

function currentMonthSlug(): string {
  return berlinNow().format("YYYY-MM");
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`holzhausenschloesschen fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
