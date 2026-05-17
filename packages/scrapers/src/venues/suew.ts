import { classifyLandauByText, isLandauCategory, type LandauCategory } from "@museumsufer/classify";
import { decodeEntities, stripHtml, truncate } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * suedlicheweinstrasse.de — TYPO3 + sfcontenthub plugin. The Südliche
 * Weinstraße tourism portal aggregates events from ~50 villages across the
 * wine region (Knöringen, Bornheim, Gleisweiler, Edenkoben, Annweiler, …).
 * landau.today's tagline is "Veranstaltungsblatt für die Südliche
 * Weinstraße", so the broader region is on-brand.
 *
 * URL convention: each event slug ends with `-YYYY-MM-DD` (or
 * `-YYYY-MM-DD-NN` for repeat occurrences); date comes from the URL so the
 * parser is robust against template changes. cHash is not server-validated
 * so we paginate purely by integer index.
 */

const SOURCE_SLUG = "suew";
const BASE = "https://www.suedlicheweinstrasse.de";
const LISTING = (page: number) =>
  `${BASE}/veranstaltungen/uebersicht?tx_sfcontenthub_contenthub%5BcurrentPage%5D=${page}`;
// suedlicheweinstrasse.de 403s long, descriptive UAs (museumsufer event-hub
// crawler / contact: …) but accepts simple project-style strings.
const UA = "museumsufer/1.0";
const PAGE_LIMIT = 8;

interface ParsedCard {
  url: string;
  slug: string;
  title: string;
  date: string;
  category?: string;
  imageUrl?: string;
  venueLines: string[];
}

export async function scrapeSuew(): Promise<VenueScrapeResult> {
  const seen = new Map<string, ParsedCard>();
  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const url = LISTING(page);
    let html: string;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        console.warn(`suew page ${page}: HTTP ${res.status}`);
        continue;
      }
      html = await res.text();
    } catch (err) {
      console.warn(`suew page ${page}: ${(err as Error).message}`);
      continue;
    }

    const cards = parseListing(html);
    if (cards.length === 0) break;
    let added = 0;
    for (const card of cards) {
      if (seen.has(card.url)) continue;
      seen.set(card.url, card);
      added++;
    }
    if (added === 0) break;
  }

  const events: CanonicalScrapedEvent[] = [...seen.values()].map(toCanonical);
  return { source_slug: SOURCE_SLUG, display_name: "Südliche Weinstraße", events };
}

function parseListing(html: string): ParsedCard[] {
  const anchors = html.split(/<a\s+href="\/veranstaltungen\/uebersicht\//i).slice(1);
  const out: ParsedCard[] = [];
  for (const block of anchors) {
    const card = parseCard(block);
    if (card) out.push(card);
  }
  return out;
}

function parseCard(block: string): ParsedCard | null {
  const slugMatch = block.match(/^([^"]+?)\/veranstaltungsdatum\.html"/);
  if (!slugMatch) return null;
  const slug = slugMatch[1];
  const url = `${BASE}/veranstaltungen/uebersicht/${slug}/veranstaltungsdatum.html`;

  const closingIdx = findCardEnd(block);
  const card = block.slice(0, closingIdx);

  const date = parseDateFromSlug(slug);
  if (!date) return null;

  const title = decode(match(card, /<h3\s+class="h3">([\s\S]*?)<\/h3>/i));
  if (!title) return null;

  const category = decode(match(card, /<div\s+class="category">[\s\S]*?<strong>([\s\S]*?)<\/strong>/i));
  const imageUrl = match(card, /<img\s+class="card-image-top"\s+src="([^"]+)"/i);

  const venueBlock = match(card, /<ul\s+class="teaser-address">([\s\S]*?)<\/ul>/i);
  const venueLines = venueBlock
    ? [...venueBlock.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((m) => decode(m[1])).filter((s): s is string => Boolean(s))
    : [];

  return {
    url,
    slug,
    title: stripHtml(title).trim(),
    date,
    category: category || undefined,
    imageUrl,
    venueLines,
  };
}

function findCardEnd(block: string): number {
  let depth = 1;
  let i = 0;
  while (i < block.length && depth > 0) {
    const open = block.indexOf("<a", i);
    const close = block.indexOf("</a>", i);
    if (close === -1) return block.length;
    if (open !== -1 && open < close) {
      depth++;
      i = open + 2;
    } else {
      depth--;
      i = close + 4;
    }
  }
  return i;
}

function parseDateFromSlug(slug: string): string | undefined {
  const m = slug.match(/(\d{4})-(\d{2})-(\d{2})(?:-\d+)?$/);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function toCanonical(card: ParsedCard): CanonicalScrapedEvent {
  const venue = card.venueLines[0] ?? null;
  const city = pickCity(card.venueLines) ?? null;
  const description = card.category ? truncate(card.category, 200) : null;
  const labels = buildLabels(card.category, card.title, description);

  return {
    source_event_id: card.slug,
    title: card.title,
    description,
    date: card.date,
    time: null,
    detail_url: card.url,
    ticket_url: null,
    image_url: card.imageUrl ?? null,
    price_min: null,
    price_max: null,
    performers: null,
    venue_room: venue,
    city,
    raw_category: card.category ?? null,
    labels,
  };
}

function buildLabels(label: string | undefined, title: string, description: string | null): ScrapedLabel[] {
  const mapped = mapUpstreamLabel(label);
  if (mapped) {
    return [{ label: `landau:${mapped}`, confidence: 0.9, classifier: "upstream-category" }];
  }
  const slug = classifyLandauByText(title, description);
  return [
    {
      label: `landau:${isLandauCategory(slug) ? slug : "sonstiges"}`,
      confidence: 0.7,
      classifier: "keyword:landau",
    },
  ];
}

/** Map upstream German category labels → our 16-slug taxonomy. SÜW uses
 *  loose labels like "Weinfest", "Geführte Wanderung", "Konzert". */
function mapUpstreamLabel(label: string | undefined): LandauCategory | null {
  if (!label) return null;
  const norm = label.toLowerCase().trim();
  if (/weinfest|hoffest|fest|kerwe|markt|kirmes/.test(norm)) return "feste";
  if (/wanderung|tour|führung|exkursion|radtour/.test(norm)) return "exkursion";
  if (/konzert|musik/.test(norm)) return "konzert";
  if (/ausstellung|kunst/.test(norm)) return "ausstellung";
  if (/theater|kabarett|comedy/.test(norm)) return "theater";
  if (/lesung|literatur/.test(norm)) return "literatur";
  if (/vortrag|talk/.test(norm)) return "vortrag";
  if (/sport|lauf/.test(norm)) return "sport";
  if (/kurs|workshop/.test(norm)) return "kurse";
  return null;
}

/** Anchor on the last line that starts with a 5-digit PLZ — deterministically
 *  the city — and fall back to the second line only if no PLZ line exists. */
function pickCity(lines: string[]): string | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^\d{5}\s+(.+)$/);
    if (m) return m[1].trim();
  }
  if (lines.length >= 2 && !/^\d/.test(lines[1])) return lines[1];
  return undefined;
}

function match(haystack: string, re: RegExp): string | undefined {
  return haystack.match(re)?.[1];
}

function decode(s: string | undefined): string | undefined {
  return s ? decodeEntities(s).trim() : undefined;
}
