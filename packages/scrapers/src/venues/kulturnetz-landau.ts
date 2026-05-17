import { classifyLandauByText, isLandauCategory, KULTURNETZ_CATEGORY_MAP } from "@museumsufer/classify";
import { decodeEntities, stripHtml } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://kulturnetz-landau.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

/**
 * Django-backed cultural calendar with rich schema.org microdata on every
 * list card. Per-category sub-pages (15 of them) expose the full multi-day
 * `<startDate>…<endDate>` span — the umbrella `/veranstaltungen/` page only
 * shows the next visible date for Ausstellungen. We iterate categories in
 * parallel and dedup by event URL slug.
 */

interface ParsedCard {
  url: string;
  slug: string;
  title: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  venue?: string;
  city?: string;
  description?: string;
  image?: string;
  category: string;
  upstreamCat: string;
}

const KNOWN_LANDAU_AREA_TOWNS = [
  "Landau",
  "Mörzheim",
  "Wollmesheim",
  "Nußdorf",
  "Godramstein",
  "Dammheim",
  "Queichheim",
  "Arzheim",
  "Birkweiler",
  "Leinsweiler",
  "Frankweiler",
  "Annweiler",
  "Bornheim",
  "Bellheim",
  "Edenkoben",
  "Maikammer",
];

export async function scrapeKulturnetzLandau(): Promise<VenueScrapeResult> {
  const cats = Object.keys(KULTURNETZ_CATEGORY_MAP);
  const seen = new Map<string, ParsedCard>();

  await Promise.all(
    cats.map(async (cat) => {
      const url = `${BASE}/veranstaltungen/${cat}/`;
      try {
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        if (!res.ok) {
          console.warn(`kulturnetz-landau ${cat}: HTTP ${res.status}`);
          return;
        }
        const html = await res.text();
        for (const ev of parseListing(html, cat)) {
          if (!seen.has(ev.url)) seen.set(ev.url, ev);
        }
      } catch (err) {
        console.warn(`kulturnetz-landau ${cat}: ${(err as Error).message}`);
      }
    }),
  );

  const events: CanonicalScrapedEvent[] = [];
  for (const card of seen.values()) {
    events.push(toCanonical(card));
  }

  return { source_slug: "kulturnetz-landau", display_name: "Kulturnetz Landau", events };
}

function parseListing(html: string, upstreamCat: string): ParsedCard[] {
  const cards = html.split(/<div\s+itemscope\s+itemtype="https:\/\/schema\.org\/Event"/i).slice(1);
  const out: ParsedCard[] = [];
  for (const card of cards) {
    const parsed = parseCard(card, upstreamCat);
    if (parsed) out.push(parsed);
  }
  return out;
}

function parseCard(card: string, upstreamCat: string): ParsedCard | null {
  const url = match(card, /itemprop="url"\s+href="([^"]+)"/i);
  const title = decode(match(card, /itemprop="name"[^>]*>([\s\S]*?)<\/h3>/i));
  const startDateAttr = match(card, /itemprop="startDate"\s+content="([^"]+)"/i);
  if (!url || !title || !startDateAttr) return null;

  const endDateAttr = match(card, /itemprop="endDate"\s+content="([^"]+)"/i);
  const venue = decode(match(card, /itemprop="location"[^>]*>([\s\S]*?)<\/span>/i));
  const fullAddress = match(card, /itemprop="location"[^>]*content="([^"]+)"/i);
  const city = extractCityFromAddress(fullAddress) ?? extractCityFromVenueName(venue);
  const image = match(card, /background-image:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  const description = decode(match(card, /<p\s+class="text-base[^"]*"[^>]*>([\s\S]*?)<\/p>/i));

  const visibleCat = decode(match(card, /<\/span>\s*•\s*([A-ZÄÖÜa-zäöü &]+?)<\/p>/i));
  const slug = url.replace(/^.*\/veranstaltung\/([^/]+)\/?.*$/, "$1") || url;

  return {
    url,
    slug,
    title: stripHtml(title).trim(),
    startDate: startDateAttr.slice(0, 10),
    startTime: startDateAttr.length > 10 ? startDateAttr.slice(11, 16) : undefined,
    endDate: endDateAttr ? endDateAttr.slice(0, 10) : undefined,
    venue: venue ? stripHtml(venue).trim() : undefined,
    city,
    description: description ? stripHtml(description).trim().slice(0, 500) : undefined,
    image: image ? new URL(image, BASE).toString() : undefined,
    category: KULTURNETZ_CATEGORY_MAP[upstreamCat] ?? mapVisibleCategory(visibleCat) ?? "sonstiges",
    upstreamCat,
  };
}

function toCanonical(card: ParsedCard): CanonicalScrapedEvent {
  const detailUrl = card.url.startsWith("http") ? card.url : `${BASE}${card.url}`;
  const labels = buildLabels(card);
  return {
    source_event_id: card.slug,
    title: card.title,
    description: card.description ?? null,
    date: card.startDate,
    time: card.startTime ?? null,
    end_date: card.endDate && card.endDate !== card.startDate ? card.endDate : null,
    end_time: null,
    detail_url: detailUrl,
    ticket_url: null,
    image_url: card.image ?? null,
    price_min: null,
    price_max: null,
    performers: null,
    venue_room: card.venue ?? null,
    city: card.city ?? null,
    raw_category: card.upstreamCat,
    labels,
  };
}

function buildLabels(card: ParsedCard): ScrapedLabel[] {
  const slug = isLandauCategory(card.category) ? card.category : classifyLandauByText(card.title, card.description);
  // KULTURNETZ_CATEGORY_MAP[card.upstreamCat] is the only way `card.category`
  // gets set to a known value; if it didn't map, the text classifier was used.
  const fromUpstream = KULTURNETZ_CATEGORY_MAP[card.upstreamCat] !== undefined;
  return [
    {
      label: `region:landau:${slug}`,
      confidence: fromUpstream ? 0.95 : 0.7,
      classifier: fromUpstream ? "upstream-category" : "keyword:landau",
    },
  ];
}

function extractCityFromAddress(addr?: string): string | undefined {
  if (!addr) return undefined;
  const cleaned = decodeEntities(addr).trim();
  const m = cleaned.match(/\b\d{5}\s+(.+?)\s*$/);
  if (m) return m[1].trim();
  const parts = cleaned
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : undefined;
}

function extractCityFromVenueName(venue?: string): string | undefined {
  if (!venue) return undefined;
  for (const town of KNOWN_LANDAU_AREA_TOWNS) {
    if (new RegExp(`\\b${town}\\b`).test(venue)) return town === "Landau" ? "Landau in der Pfalz" : town;
  }
  return undefined;
}

function mapVisibleCategory(label?: string): string | undefined {
  if (!label) return undefined;
  const norm = label.toLowerCase().replace(/&\s*/g, "").replace(/\s+/g, "-").trim();
  return KULTURNETZ_CATEGORY_MAP[norm];
}

function match(haystack: string, re: RegExp): string | undefined {
  return haystack.match(re)?.[1];
}

function decode(s: string | undefined): string | undefined {
  return s ? decodeEntities(s) : undefined;
}
