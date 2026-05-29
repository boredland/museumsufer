import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * naxos.Kino — weekly Tuesday-evening documentary screenings at the
 * Naxoshalle. The site renders its upcoming programme on the homepage
 * via GravityView ("gv_list_NNNN" wrappers, gv-field-1-N inner cells)
 * because individual films don't get their own permalinks — the home
 * page IS the canonical schedule, and naxos-kino.de/programm/ only
 * holds the "Programmheft" PDF. So we anchor to the home page and let
 * each gv_list_NNNN id serve as the stable upstream id.
 */
const BASE = "https://naxos-kino.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const LIST_RE =
  /<div id="gv_list_(\d+)"\s+class="gv-list-view"[\s\S]*?(?=<div id="gv_list_\d+"\s+class="gv-list-view"|<input type="hidden" class="gravityview-view-id")/g;
const TITLE_RE = /<h3 class="gv-field-1-2">([\s\S]*?)<\/h3>/;
const IMG_RE = /<img[^>]+class="gv-image[^"]*"[^>]+src="([^"]+)"/;
const FANCYBOX_HREF_RE = /<a class="gravityview-fancybox"[^>]+href="([^"]+)"/;
const DATE_RE = /<div id="gv-field-1-3"[^>]*>\s*([0-3]?\d\.[01]?\d\.\d{4})\s*<\/div>/;
const TIME_RE = /<div id="gv-field-1-4"[^>]*>\s*([0-2]?\d:[0-5]\d)\s*<\/div>/;
const DIRECTOR_RE = /<div id="gv-field-1-16"[^>]*>([\s\S]*?)<\/div>/;
const META_RE = /<div id="gv-field-1-43"[^>]*>([\s\S]*?)<\/div>/;
const VERSION_RE = /<div id="gv-field-1-21"[^>]*>([\s\S]*?)<\/div>/;
const DESC_RE = /<div id="gv-field-1-5"[^>]*>([\s\S]*?)<\/div>/;
const GUESTS_RE = /<div id="gv-field-1-7"[^>]*>([\s\S]*?)<\/div>/;

/** Festival screenings hosted by naxos.Kino are already produced by the
 *  nippon-connection scraper with venue_room="naxos.Kino"; stripping the
 *  prefix lets dedup collapse the two so the richer Nippon entry wins. */
const NIPPON_PREFIX_RE = /^\d{1,3}\.\s*NIPPON\s+CONNECTION\s+FILMFESTIVAL:\s*/i;

export async function scrapeNaxosKino(): Promise<VenueScrapeResult> {
  const res = await fetch(`${BASE}/`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`naxos-kino fetch failed: ${res.status}`);
  const html = await res.text();
  const today = todayIso();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(LIST_RE)) {
    const [block, entryId] = [m[0], m[1]];

    const date = parseDate(block.match(DATE_RE)?.[1]);
    if (!date || date < today) continue;
    const time = block.match(TIME_RE)?.[1] ?? null;

    const rawTitle = block.match(TITLE_RE)?.[1];
    if (!rawTitle) continue;
    const title = decodeEntities(stripHtml(rawTitle).trim()).replace(NIPPON_PREFIX_RE, "").trim();
    if (!title) continue;

    if (seen.has(entryId)) continue;
    seen.add(entryId);

    const director = textField(block.match(DIRECTOR_RE)?.[1]);
    const meta = textField(block.match(META_RE)?.[1]);
    const version = textField(block.match(VERSION_RE)?.[1]);
    const description = textField(block.match(DESC_RE)?.[1]);
    const guests = textField(block.match(GUESTS_RE)?.[1]);

    const subtitleParts = [director ? `R: ${director}` : null, meta, version].filter(Boolean);
    const descriptionParts = [
      description,
      guests ? `Filmgespräch: ${guests.replace(/^Filmgespr[äa]ch\s*mit\s*:?\s*/i, "")}` : null,
    ].filter(Boolean);

    const image_url = block.match(IMG_RE)?.[1] ?? block.match(FANCYBOX_HREF_RE)?.[1] ?? null;

    events.push({
      source_event_id: entryId,
      title,
      subtitle: subtitleParts.length ? subtitleParts.join(" · ") : null,
      description: descriptionParts.length ? descriptionParts.join("\n\n") : null,
      date,
      time,
      detail_url: `${BASE}/#programm`,
      ticket_url: `${BASE}/kartenvorbestellung/`,
      image_url,
      venue_room: "naxos.Kino",
      labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "naxos-kino", display_name: "naxos.Kino", events };
}

function parseDate(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^([0-3]?\d)\.([01]?\d)\.(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function textField(html: string | undefined): string | null {
  if (!html) return null;
  const text = decodeEntities(stripHtml(html)).replace(/\s+/g, " ").trim();
  return text || null;
}
