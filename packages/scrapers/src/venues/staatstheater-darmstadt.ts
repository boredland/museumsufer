import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.staatstheater-darmstadt.de";
const SPIELPLAN_URL = `${BASE}/spielplan/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.8632;
const LON = 8.647;

/**
 * Staatstheater Darmstadt — multi-section city theatre (opera, musical,
 * drama, ballet, concerts, young audiences). Its public spielplan page is
 * server-rendered with one `<article class="termin js-termin" data-termin-id>`
 * per dated performance. The unique `data-termin-id` is the stable upstream
 * id. Tickets are sold through the Bilettix-based webshop.
 */
export async function scrapeStaatstheaterDarmstadt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(SPIELPLAN_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Staatstheater Darmstadt fetch failed: ${res.status}`);
  const html = await res.text();

  const events = parseTermine(html, today);
  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return {
    source_slug: "staatstheater-darmstadt",
    display_name: "Staatstheater Darmstadt",
    events,
  };
}

function parseTermine(html: string, today: string): CanonicalScrapedEvent[] {
  const out: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Split on the opening of each performance block; [0] is everything before
  // the first event.
  const parts = html.split(/<article\s+class="termin js-termin"\s+data-termin-id="(\d+)"/i);
  for (let i = 1; i < parts.length; i += 2) {
    const terminId = parts[i];
    const block = parts[i + 1];
    if (!terminId || !block) continue;
    if (seen.has(terminId)) continue;

    const datetime = extractFirst(block, /<time\s+datetime="([^"]+)"/i);
    if (!datetime) continue;
    const [date, time] = splitDateTime(datetime);
    if (!date || date < today) continue;

    const title = cleanText(extractFirst(block, /<h3\s+class="termin__title">([\s\S]*?)<\/h3>/i));
    if (!title) continue;

    const detailHref = extractFirst(block, /<a\s+class="termin__anchor"\s+href="([^"]+)"/i);
    const detailUrl = detailHref ? absoluteUrl(detailHref) : null;
    const ticketUrl = extractFirst(block, /href="(https:\/\/webshop\.staatstheater-darmstadt\.de\/[^"]+)"/i);

    const venueRoom = cleanText(extractFirst(block, /<\/time>\s*<span>([^<]+)<\/span>/i)) || null;
    const description = extractDetailsText(block);
    const priceMin = extractPriceMin(block);
    const availability = block.includes("Ausverkauft") ? "sold_out" : null;

    seen.add(terminId);
    out.push({
      source_event_id: terminId,
      title,
      subtitle: null,
      description,
      date,
      time,
      detail_url: detailUrl,
      ticket_url: ticketUrl,
      price_min: priceMin,
      price_max: null,
      performers: null,
      venue_room: venueRoom,
      availability,
      city: "darmstadt",
      lat: LAT,
      lon: LON,
      labels: resolveStageLabels({
        title,
        hint: description,
        defaultLabel: "stage:theater",
        classifier: "scraper-hardcoded",
        confidence: 0.85,
      }),
    });
  }

  return out;
}

function splitDateTime(iso: string): [string, string | null] {
  const [datePart, timePart] = iso.split("T");
  if (!datePart) return ["", null];
  const time = timePart ? timePart.slice(0, 5) : null;
  return [datePart, time];
}

function extractDetailsText(block: string): string | null {
  const start = block.indexOf('<div class="termin__details');
  const end = block.indexOf('<div class="termin__options');
  if (start === -1 || end === -1 || end <= start) return null;
  const inner = block.slice(start, end);
  const match = inner.match(/<div\s+class="termin__details[^"]*"[^>]*>([\s\S]*)$/i);
  if (!match) return null;
  const text = cleanText(match[1]);
  return text || null;
}

function extractPriceMin(block: string): number | null {
  // Look for a price like "15,00 €" or "15,00 € bis 80,00 €".
  const m = block.match(/(\d+),\s*(\d{2})\s*&euro;/);
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const cents = parseInt(m[2], 10);
  return whole + cents / 100;
}

function extractFirst(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ?? null;
}

function cleanText(raw: string | null): string {
  if (!raw) return "";
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}

function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${BASE}${path}`;
}
