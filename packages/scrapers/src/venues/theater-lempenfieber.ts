import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.lempenfieber.de";
const KALENDER_URL = `${BASE}/kalender.php`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Theater Lempenfieber's /kalender.php groups performances by month
 * (`<h1>Mai 2026</h1>`) and renders each as a `<tr><td>` row inside
 * `<table id="spielplan">`. Touring dates carry "Lempenfieber unterwegs"
 * markers and use external venues — we surface those in venue_room.
 */

const GERMAN_MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

const MONTH_BLOCK_RE =
  /<h1>\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})\s*<\/h1>([\s\S]*?)(?=<h1>\s*[A-Za-zäöüÄÖÜ]+\s+\d{4}|<\/div>\s*<\/div>\s*<\/body|<footer\b)/g;
const ROW_RE = /<tr>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g;

export async function scrapeTheaterLempenfieber(): Promise<VenueScrapeResult> {
  const res = await fetch(KALENDER_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`theater-lempenfieber fetch failed: ${res.status}`);
  return parse(await res.text());
}

function parse(html: string): VenueScrapeResult {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const monthMatch of html.matchAll(MONTH_BLOCK_RE)) {
    const monthName = monthMatch[1].toLowerCase().normalize("NFC");
    const month = GERMAN_MONTHS[monthName];
    if (!month) continue;
    const year = parseInt(monthMatch[2], 10);
    const monthBody = monthMatch[3];

    for (const rowMatch of monthBody.matchAll(ROW_RE)) {
      const row = rowMatch[1];
      const day = row.match(/<span\s+class="news-day">\s*(\d{1,2})\s*<\/span>/i)?.[1];
      if (!day) continue;
      const date = `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
      if (date < today) continue;

      const timeMatch = row.match(/<b>\s*(\d{1,2})[.:](\d{2})\s*Uhr\s*<\/b>/i);
      const time = timeMatch ? nullIfMidnight(`${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`) : null;

      const productionMatch = row.match(/<a\s+href=['"]([^'"]*\/produktionen\/[^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i);
      if (!productionMatch) continue;
      const detailUrl = decodeEntities(productionMatch[1]);
      const titleBlock = productionMatch[2];
      const title = stripHtml(titleBlock.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
      if (!title) continue;
      const subtitle = stripHtml(titleBlock.match(/<h1>[\s\S]*?<\/h1>\s*<h2>([\s\S]*?)<\/h2>/i)?.[1] ?? "") || null;

      const slug = deriveSlug(detailUrl) || slugify(title);
      const sourceEventId = `${slug}|${date}|${time ?? ""}`;
      if (seen.has(sourceEventId)) continue;
      seen.add(sourceEventId);

      const ticketUrl = pickTicketUrl(row) ?? normalizeUrl(detailUrl, BASE);
      const venueRoom = pickVenueRoom(row);
      const imgSrc = row.match(/<img[^>]+src=['"]([^'"]*\/produktionen\/[^'"]+\.(?:jpe?g|png|webp))['"]/i)?.[1];
      const priceText = stripHtml(row.match(/<div\s+style="text-align:left[^"]*">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "");
      const { priceMin, priceMax } = parsePriceRange(priceText);

      events.push({
        source_event_id: sourceEventId,
        title,
        subtitle,
        description: subtitle,
        date,
        time,
        detail_url: normalizeUrl(detailUrl, BASE),
        ticket_url: ticketUrl,
        image_url: imgSrc ? normalizeUrl(imgSrc, BASE) : null,
        price_min: priceMin,
        price_max: priceMax,
        venue_room: venueRoom,
        labels: resolveStageLabels({ title, subtitle, confidence: 0.85 }),
      });
    }
  }

  return { source_slug: "theater-lempenfieber", display_name: "Theater Lempenfieber", events };
}

function deriveSlug(url: string): string | null {
  return url.match(/\/produktionen\/([A-Za-z0-9_-]+)/)?.[1]?.toLowerCase() ?? null;
}

function pickTicketUrl(row: string): string | null {
  const reservix = row.match(/href=['"](https:\/\/www\.reservix\.de\/[^'"]+)['"]/i)?.[1];
  if (reservix) return decodeEntities(reservix);
  const eventim = row.match(/href=['"](https:\/\/www\.eventim-light\.com\/[^'"]+)['"]/i)?.[1];
  if (eventim) return decodeEntities(eventim);
  const karten = row.match(/href=['"](karten\.php\?[^'"]+)['"]/i)?.[1];
  if (karten) return normalizeUrl(decodeEntities(karten), BASE);
  return null;
}

function pickVenueRoom(row: string): string {
  const unterwegs = row.match(/<h2>\s*<b>\s*Lempenfieber\s+unterwegs\s*<\/b>\s*:?\s*([\s\S]*?)<\/h2>/i)?.[1];
  if (unterwegs) {
    const text = stripHtml(unterwegs).trim();
    return text ? `Lempenfieber unterwegs: ${text}` : "Lempenfieber unterwegs";
  }
  return "Theater Lempenfieber";
}

/** "30€/ erm. 26€" → {min:26, max:30}; "9 €" → {min:9, max:9}; "24,-/erm. 18,-" → {min:18, max:24} */
function parsePriceRange(text: string): { priceMin: number | null; priceMax: number | null } {
  const values = [...text.matchAll(/(\d{1,3})(?:[.,](\d{1,2}))?\s*(?:€|,-|EUR\b|Euro\b)/gi)]
    .map((m) => parseInt(m[1], 10) + (m[2] ? Math.round(parseInt(m[2].padEnd(2, "0"), 10) / 100) : 0))
    .filter((n) => n >= 1 && n <= 200);
  if (!values.length) return { priceMin: null, priceMax: null };
  return { priceMin: Math.min(...values), priceMax: Math.max(...values) };
}
