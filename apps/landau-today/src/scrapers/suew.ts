/**
 * Scrape suedlicheweinstrasse.de — TYPO3 + sfcontenthub plugin.
 * The Südliche Weinstraße tourism portal aggregates events from ~50
 * villages across the wine region (Knöringen, Bornheim, Gleisweiler,
 * Edenkoben, Annweiler, …). landau.today's tagline is "Veranstaltungsblatt
 * für die Südliche Weinstraße", so the broader region is on-brand.
 *
 * URL convention is generous: each event slug ends with `-YYYY-MM-DD` (or
 * `-YYYY-MM-DD-NN` for repeat occurrences), so we extract the date from
 * the URL itself — robust against template changes.
 *
 * Pagination: ?tx_sfcontenthub_contenthub[currentPage]=N. The cHash query
 * param is published in the HTML but is not actually validated server-side
 * (we tested both with and without; results match), so we paginate purely
 * by integer index and cap at PAGE_LIMIT to keep the scrape cheap.
 */
import { decodeEntities, stripHtml, truncate } from "@museumsufer/core";
import { classifyEventByText } from "../categories";
import type { Event, EventSource } from "../types";

const SOURCE: EventSource = "suew";
const BASE = "https://www.suedlicheweinstrasse.de";
const LISTING = (page: number) =>
  `${BASE}/veranstaltungen/uebersicht?tx_sfcontenthub_contenthub%5BcurrentPage%5D=${page}`;

/** Cap pagination depth — page 1 covers today, each page jumps ~1 day on
 *  average. 8 pages ≈ next 1–2 weeks, well inside the date strip's horizon. */
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

export interface SuewScrapeOptions {
  fetchImpl?: typeof fetch;
  pageLimit?: number;
}

export async function scrapeSuew(opts: SuewScrapeOptions = {}): Promise<Omit<Event, "id">[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const limit = opts.pageLimit ?? PAGE_LIMIT;

  const seen = new Map<string, ParsedCard>();
  for (let page = 1; page <= limit; page++) {
    const url = LISTING(page);
    let html: string;
    try {
      const res = await fetchImpl(url, { headers: { "User-Agent": "landau-today/1.0" } });
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
    // Pagination is stable but pages 0 and 1 return identical content;
    // bail out once a page contributes zero new items so we don't keep
    // walking after the last page.
    if (added === 0) break;
  }

  return [...seen.values()].map(toEvent);
}

function parseListing(html: string): ParsedCard[] {
  // Split on each event anchor — the link wraps the entire card so this
  // gives us self-contained substrings to regex over.
  const anchors = html.split(/<a\s+href="\/veranstaltungen\/uebersicht\//i).slice(1);
  const out: ParsedCard[] = [];
  for (const block of anchors) {
    const card = parseCard(block);
    if (card) out.push(card);
  }
  return out;
}

function parseCard(block: string): ParsedCard | null {
  // First chunk of `block` is `<slug>/veranstaltungsdatum.html"`. Pull the
  // slug, then carve out the part of the block that belongs to this card
  // (everything up to the closing </a> that wraps the entire teaser).
  const slugMatch = block.match(/^([^"]+?)\/veranstaltungsdatum\.html"/);
  if (!slugMatch) return null;
  const slug = slugMatch[1];
  const url = `${BASE}/veranstaltungen/uebersicht/${slug}/veranstaltungsdatum.html`;

  const closingIdx = findCardEnd(block);
  const card = block.slice(0, closingIdx);

  const date = parseDateFromSlug(slug);
  if (!date) return null;

  const title = decode(match(card, /<h3\s+class="h3">([\s\S]*?)<\/h3>/i)) || "";
  if (!title) return null;

  const category = decode(match(card, /<div\s+class="category">[\s\S]*?<strong>([\s\S]*?)<\/strong>/i));
  const imageUrl = match(card, /<img\s+class="card-image-top"\s+src="([^"]+)"/i);

  const venueBlock = match(card, /<ul\s+class="teaser-address">([\s\S]*?)<\/ul>/i);
  const venueLines = venueBlock
    ? [...venueBlock.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((m) => decode(m[1]).trim()).filter(Boolean)
    : [];

  return {
    url,
    slug,
    title: stripHtml(title).trim(),
    date,
    category,
    imageUrl,
    venueLines,
  };
}

/** Walk forward from start of `block` to find the first `</a>` that
 *  matches our outer-anchor open. We do this by scanning anchor opens and
 *  closes; anything more sophisticated would need a real parser. */
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

function toEvent(card: ParsedCard): Omit<Event, "id"> {
  // Venue lines are typically: ["Veranstaltungsort", "Stadt", "PLZ Stadt"].
  // Surface venue and city as separate fields so the meta line can show
  // "<venue> · <city>" — the city disambiguates outlying SÜW villages
  // ("Bornheim", "Edenkoben") from Landau-proper events.
  const venue = card.venueLines[0] || undefined;
  const city = pickCity(card.venueLines);
  const description = card.category ? `${card.category}${venue ? ` · ${venue}` : ""}` : undefined;
  const category = mapCategory(card.category, card.title, description);
  return {
    source: SOURCE,
    source_uid: card.slug,
    title: card.title,
    date: card.date,
    category,
    ...(venue ? { venue } : {}),
    ...(city ? { city } : {}),
    ...(card.category ? { description: truncate(card.category, 200) || undefined } : {}),
    detail_url: card.url,
    ...(card.imageUrl ? { image_url: card.imageUrl } : {}),
  };
}

/** Pick the city name from the address lines. The line layout varies:
 *  ["Venue", "City", "PLZ City"] for tourist offices, or
 *  ["Venue", "Street N", "PLZ City"] for private venues. We anchor on the
 *  last line that starts with a 5-digit PLZ — that's deterministically the
 *  city — and fall back to the second line only if no PLZ line exists. */
function pickCity(lines: string[]): string | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^\d{5}\s+(.+)$/);
    if (m) return m[1].trim();
  }
  if (lines.length >= 2 && !/^\d/.test(lines[1])) return lines[1];
  return undefined;
}

/** Map upstream German category labels → our 16-slug taxonomy. SÜW uses
 *  loose labels like "Weinfest", "Geführte Wanderung", "Konzert". */
function mapCategory(label?: string, title?: string, description?: string): string {
  if (label) {
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
  }
  return classifyEventByText(title || "", description);
}

function match(haystack: string, re: RegExp): string | undefined {
  return haystack.match(re)?.[1];
}

function decode(s: string | undefined): string {
  return s ? decodeEntities(s).trim() : "";
}
