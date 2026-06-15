import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export const COMFORTTICKET_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
  "Accept-Language": "de-DE,de;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

const ITEM_RE = /<li\s+class="[^"]*ringlet-performance[^"]*"([\s\S]*?)<\/li>/g;
const DATA_URL_RE = /\bdata-url="([^"]+)"/i;
const TITLE_RE = /<div\s+class="attribute performance">[\s\S]*?<span>([\s\S]*?)<\/span>/i;
const LOCATION_RE = /<div\s+class="attribute location">[\s\S]*?<span>([\s\S]*?)<\/span>/i;
const DATE_RE = /<div\s+class="attribute date">[\s\S]*?<span>([\s\S]*?)<\/span>/i;
const PRICE_RE = /<span\s+class="value">([\d,.]+)<\/span>/i;
const IMAGE_RE = /<div\s+class="attribute image[^"]*">[\s\S]*?<img\s+src="([^"]+)"/i;
const DESC_RE = /bx\.webshop\.ui\.Dialog\.DIALOG_OK_NO_ICON\(\s*`([\s\S]*?)`\s*\)/i;

export interface ComfortTicketScrapeOptions {
  sourceSlug: string;
  displayName: string;
  host: string;
  venueFilter?: string | null;
  defaultLabel?: string;
}

export async function scrapeComfortTicketVenue(opts: ComfortTicketScrapeOptions): Promise<VenueScrapeResult> {
  const url = `https://${opts.host}/de/spielplan`;
  const res = await fetch(url, { headers: COMFORTTICKET_HEADERS });
  if (!res.ok) throw new Error(`comfortticket fetch failed: ${res.status} for ${opts.sourceSlug}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const matches = [...html.matchAll(ITEM_RE)];
  for (const m of matches) {
    const block = m[1];

    const dataUrlMatch = block.match(DATA_URL_RE);
    const dataUrl = dataUrlMatch ? dataUrlMatch[1] : null;
    if (!dataUrl) continue;

    const locationMatch = block.match(LOCATION_RE);
    const location = locationMatch ? cleanText(locationMatch[1]) : "";

    // Filter by location if specified
    if (opts.venueFilter && location !== opts.venueFilter) continue;

    const titleMatch = block.match(TITLE_RE);
    const title = titleMatch ? cleanText(titleMatch[1]) : "";
    if (!title) continue;

    const dateMatch = block.match(DATE_RE);
    const dateStrRaw = dateMatch ? cleanText(dateMatch[1]) : ""; // e.g. "19.06.2026 19:30 Uhr"
    const parsedDateTime = parseDateTime(dateStrRaw);
    if (!parsedDateTime || parsedDateTime.date < today) continue;

    const priceMatch = block.match(PRICE_RE);
    const price = priceMatch ? parsePrice(priceMatch[1]) : null;

    const imageMatch = block.match(IMAGE_RE);
    const imageUrl = imageMatch ? imageMatch[1] : null;

    const descMatch = block.match(DESC_RE);
    const description = descMatch ? cleanText(descMatch[1]) : null;

    const showSlug = slugify(title);
    const sourceEventId = `${showSlug}|${parsedDateTime.date}|${parsedDateTime.time}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle: description ? `${description.slice(0, 150)}...` : null,
      description,
      date: parsedDateTime.date,
      time: parsedDateTime.time,
      detail_url: `https://${opts.host}${dataUrl}`,
      ticket_url: `https://${opts.host}${dataUrl}`,
      image_url: imageUrl,
      price_min: price,
      price_max: null,
      performers: null,
      venue_room: location || null,
      raw_category: null,
      labels: resolveStageLabels({
        title,
        subtitle: description,
        defaultLabel: opts.defaultLabel ?? "stage:theater",
        confidence: 0.85,
      }),
    });
  }

  return { source_slug: opts.sourceSlug, display_name: opts.displayName, events };
}

function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const clean = raw.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}

function parseDateTime(raw: string): { date: string; time: string } | null {
  // e.g. "19.06.2026 19:30 Uhr"
  const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})\s*Uhr$/i);
  if (!m) return null;
  const day = m[1];
  const month = m[2];
  const year = m[3];
  const hour = m[4];
  const minute = m[5];
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  };
}
