import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.galli-frankfurt.de";
const SPIELPLAN_URL = `${BASE}/spielplan/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Galli Frankfurt's /spielplan/ groups events by month under `<h2>Mai 2026</h2>`
 * headings, then renders each performance as `<div class="spielplanV1">`.
 */

const GERMAN_MONTHS: Record<string, number> = {
  januar: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  märz: 3,
  mar: 3,
  mär: 3,
  maerz: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
};

const MONTH_BLOCK_RE =
  /<h2[^>]*>\s*([A-Za-zäöüÄÖÜ]+)\.?\s*(\d{4})\s*<\/h2>([\s\S]*?)(?=<h2[^>]*>\s*[A-Za-zäöüÄÖÜ]+\.?\s*\d{4}|<\/main\b|<footer\b)/g;
const ITEM_RE = /<div\s+class="spielplanV1"[^>]*>([\s\S]*?)(?=<div\s+class="spielplanV1"|<\/section|<\/main)/g;

export async function scrapeGalliTheater(): Promise<VenueScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`galli-theater fetch failed: ${res.status}`);
  return parse(await res.text());
}

function parse(html: string): VenueScrapeResult {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const monthMatch of html.matchAll(MONTH_BLOCK_RE)) {
    const monthName = monthMatch[1].toLowerCase().normalize("NFC");
    const month = GERMAN_MONTHS[monthName] ?? GERMAN_MONTHS[monthName.replace(/\.$/, "")];
    if (!month) continue;
    const year = parseInt(monthMatch[2], 10);
    const monthBody = monthMatch[3];

    for (const itemMatch of monthBody.matchAll(ITEM_RE)) {
      const block = itemMatch[1];
      const day = block.match(/<div\s+class="datumV1">\s*(\d{1,2})\s*<\/div>/i)?.[1];
      if (!day) continue;
      const date = `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
      if (date < today) continue;

      const titleMatch = block.match(/<div\s+class="titelV1"[^>]*>\s*<a\s+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
      if (!titleMatch) continue;
      const detailUrl = decodeEntities(titleMatch[1]);
      const title = stripHtml(titleMatch[2]);
      if (!title) continue;

      const subtitle =
        stripHtml(block.match(/<div\s+class="untertitelV1"[^>]*>\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "") || null;
      const time = parseTimeFromSubtitle(subtitle);
      const guestVenue =
        stripHtml(block.match(/<div\s+class="gastspielortV1"[^>]*>\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "") || null;
      const venueRoom = guestVenue || "Galli Theater";

      const imgSrc = block.match(/<img[^>]+src="([^"]+)"[^>]*\bwp-post-image/i)?.[1];
      const priceRaw = stripHtml(block.match(/<div\s+class="preisV1"[^>]*>\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "");
      const { priceMin, priceMax } = parsePriceRange(priceRaw);

      const ticketHref = block.match(/<a\s+class="buttonV1"\s+href="([^"]+)"[^>]*>(?:[^<]|<(?!\/a>))*<\/a>/i)?.[1];
      const ticketUrl = ticketHref ? decodeEntities(ticketHref) : normalizeUrl(detailUrl, BASE);

      const slug = deriveSlug(detailUrl) || slugify(title);
      const sourceEventId = `${slug}|${date}|${time ?? ""}`;
      if (seen.has(sourceEventId)) continue;
      seen.add(sourceEventId);

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

  return { source_slug: "galli-theater", display_name: "Galli Theater Frankfurt", events };
}

function deriveSlug(url: string): string | null {
  return url.match(/\/events\/([a-z0-9-]+)/i)?.[1] ?? null;
}

/** "10:30 h / Kita-Schulvorstellung" → "10:30" */
function parseTimeFromSubtitle(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/(\d{1,2})[.:](\d{2})\s*(?:h|Uhr)?/);
  if (!m) return null;
  return nullIfMidnight(`${m[1].padStart(2, "0")}:${m[2]}`);
}

/** "Erw 11€/ Ki 8€" → {min:8, max:11}; "11€" → {min:11, max:11} */
function parsePriceRange(text: string): { priceMin: number | null; priceMax: number | null } {
  const values = [...text.matchAll(/(\d{1,3})(?:[.,](\d{1,2}))?\s*€/g)]
    .map((m) => parseInt(m[1], 10) + (m[2] ? Math.round(parseInt(m[2].padEnd(2, "0"), 10) / 100) : 0))
    .filter((n) => n >= 1 && n <= 200);
  if (!values.length) return { priceMin: null, priceMax: null };
  return { priceMin: Math.min(...values), priceMax: Math.max(...values) };
}
