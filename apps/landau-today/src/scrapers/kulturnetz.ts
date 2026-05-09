/**
 * Scrape kulturnetz-landau.de — Django-backed cultural calendar with rich
 * schema.org microdata on every list card. We hit each of the 15 category
 * sub-pages, parse microdata directly off the listing HTML (no detail-page
 * fetches), and dedup by event URL slug.
 *
 * Why per-category pages instead of the single /veranstaltungen/ listing:
 * the latter only shows multi-day Ausstellungen with their *next visible*
 * date, while /veranstaltungen/ausstellung/ exposes the full
 * `<startDate>…<endDate>` span. Iterating all 15 pages costs ~15 GETs but
 * gets us complete date ranges and lets us tag events with the upstream
 * category as authoritative.
 */
import { decodeEntities, stripHtml } from "@museumsufer/core";
import { KULTURNETZ_CATEGORY_MAP } from "../categories";
import type { Event, EventSource } from "../types";

const BASE = "https://kulturnetz-landau.de";
const SOURCE: EventSource = "kulturnetz";

interface ParsedEvent {
  url: string;
  title: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  venue?: string;
  city?: string;
  description?: string;
  image?: string;
  category: string;
}

export interface KulturnetzScrapeOptions {
  /** Override categories to fetch (defaults to all 15). Useful for tests. */
  categories?: string[];
  fetchImpl?: typeof fetch;
}

export async function scrapeKulturnetz(opts: KulturnetzScrapeOptions = {}): Promise<Omit<Event, "id">[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const cats = opts.categories ?? Object.keys(KULTURNETZ_CATEGORY_MAP);
  const seen = new Map<string, ParsedEvent>();

  await Promise.all(
    cats.map(async (cat) => {
      const url = `${BASE}/veranstaltungen/${cat}/`;
      try {
        const res = await fetchImpl(url, { headers: { "User-Agent": "landau-today/1.0" } });
        if (!res.ok) {
          console.warn(`kulturnetz ${cat}: HTTP ${res.status}`);
          return;
        }
        const html = await res.text();
        for (const ev of parseListing(html, cat)) {
          // First-write-wins; categories run in parallel so dedup is by URL.
          if (!seen.has(ev.url)) seen.set(ev.url, ev);
        }
      } catch (err) {
        console.warn(`kulturnetz ${cat}: ${(err as Error).message}`);
      }
    }),
  );

  return [...seen.values()].map(toEvent);
}

function parseListing(html: string, upstreamCat: string): ParsedEvent[] {
  // Each event is wrapped in a `schema.org/Event` itemscope div. Slice on
  // that delimiter so we never accidentally cross-contaminate fields between
  // adjacent cards.
  const cards = html.split(/<div\s+itemscope\s+itemtype="https:\/\/schema\.org\/Event"/i).slice(1);
  const out: ParsedEvent[] = [];
  for (const card of cards) {
    const ev = parseCard(card, upstreamCat);
    if (ev) out.push(ev);
  }
  return out;
}

function parseCard(card: string, upstreamCat: string): ParsedEvent | null {
  const url = match(card, /itemprop="url"\s+href="([^"]+)"/i);
  const title = decode(match(card, /itemprop="name"[^>]*>([\s\S]*?)<\/h3>/i));
  const startDateAttr = match(card, /itemprop="startDate"\s+content="([^"]+)"/i);
  if (!url || !title || !startDateAttr) return null;

  const endDateAttr = match(card, /itemprop="endDate"\s+content="([^"]+)"/i);
  const venue = decode(match(card, /itemprop="location"[^>]*>([\s\S]*?)<\/span>/i));
  // The location span carries the full address in its `content` attribute
  // ("Limburgstraße 1, 76829 Landau in der Pfalz"). Pull the city out of
  // the trailing "PLZ City…" segment so the renderer can show it.
  const fullAddress = match(card, /itemprop="location"[^>]*content="([^"]+)"/i);
  const city = extractCityFromAddress(fullAddress) || extractCityFromVenueName(venue);
  const image = match(card, /background-image:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  const description = decode(match(card, /<p\s+class="text-base[^"]*"[^>]*>([\s\S]*?)<\/p>/i));

  // Visible category text after the date — e.g., `… 17:00 Uhr</span> • Konzert`.
  // Useful as a sanity check: we trust the upstream URL's category over this.
  const visibleCat = decode(match(card, /<\/span>\s*•\s*([A-ZÄÖÜa-zäöü &]+?)<\/p>/i));

  const slug = url.replace(/^.*\/veranstaltung\/([^/]+)\/?.*$/, "$1") || url;

  return {
    url,
    title: stripHtml(title).trim(),
    startDate: startDateAttr.slice(0, 10),
    startTime: startDateAttr.length > 10 ? startDateAttr.slice(11, 16) : undefined,
    endDate: endDateAttr ? endDateAttr.slice(0, 10) : undefined,
    venue: venue ? stripHtml(venue).trim() : undefined,
    city,
    description: description ? stripHtml(description).trim().slice(0, 500) : undefined,
    image: image ? new URL(image, BASE).toString() : undefined,
    category: KULTURNETZ_CATEGORY_MAP[upstreamCat] || mapVisibleCategory(visibleCat) || "sonstiges",
    // slug used for stable id downstream:
    ...({ _slug: slug } as object),
  } as ParsedEvent & { _slug: string };
}

/** Pull a city name from a free-form address. Kulturnetz writes them as
 *  "Street N, PLZ City" (sometimes with sub-locality). We take everything
 *  after the last 5-digit ZIP, falling back to the last comma-segment. */
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

/** Last-ditch fallback: some Kulturnetz venues encode the city in the
 *  display name ("Matthäuskirche Landau", "Stiftskirche Landau"). Take a
 *  trailing token if it matches a known village in the Landau area. */
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

function toEvent(p: ParsedEvent): Omit<Event, "id"> {
  const slug = (p as ParsedEvent & { _slug?: string })._slug || p.url;
  const detailUrl = p.url.startsWith("http") ? p.url : `${BASE}${p.url}`;
  return {
    source: SOURCE,
    source_uid: slug,
    title: p.title,
    date: p.startDate,
    ...(p.startTime ? { time: p.startTime } : {}),
    ...(p.endDate && p.endDate !== p.startDate ? { end_date: p.endDate } : {}),
    category: p.category,
    ...(p.venue ? { venue: p.venue } : {}),
    ...(p.city ? { city: p.city } : {}),
    ...(p.description ? { description: p.description } : {}),
    detail_url: detailUrl,
    ...(p.image ? { image_url: p.image } : {}),
  };
}

function match(haystack: string, re: RegExp): string | undefined {
  return haystack.match(re)?.[1];
}

function decode(s: string | undefined): string | undefined {
  return s ? decodeEntities(s) : undefined;
}
