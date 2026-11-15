import { classifyMusic } from "@museumsufer/classify";
import { decodeEntities, normalizeUrl, sanitizeImageUrl, slugify, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const TICKETS_BASE = "https://www.tickettailor.com";
const LISTING_URL = `${TICKETS_BASE}/events/jazzkeller`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const ITEM_RE = /<li class="events-listing__item[^"]*">([\s\S]*?)<\/li>/g;
// href carries the occurrence date: /events/jazzkeller/<series-id>?date=YYYY-MM-DD
const LINK_RE = /<a[^>]*href="([^"]*?date(?:=|&#x3D;)(\d{4}-\d{2}-\d{2}))"[^>]*class="event__link">([\s\S]*?)<\/a>/;
const START_TIME_RE = /<var>(\d{1,2}:\d{2})<\/var>/;
const IMAGE_RE = /<img\s[^>]*?src="([^"]+)"/;

/**
 * Jazzkeller's own live.html is frozen on the spring-2026 programme behind a
 * "This page is currently being updated" overlay that sends visitors to
 * tickets.jazzkeller.com, which 301s to this Ticket Tailor organiser page. It
 * lists every upcoming occurrence server-rendered, so there is nothing to
 * page through.
 *
 * source_event_id stays `slugify(date-title)` — the id the live.html scraper
 * produced — so events already stored keep their identity.
 */
export async function scrapeJazzkeller(): Promise<VenueScrapeResult> {
  const res = await fetch(LISTING_URL, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) throw new Error(`jazzkeller fetch failed: ${LISTING_URL} → ${res.status}`);
  const html = await res.text();

  const blocks = [...html.matchAll(ITEM_RE)];
  // Zero items means the markup changed or the organiser page is gone, not that
  // the club is dark; fail loudly instead of reporting an empty programme.
  if (blocks.length === 0) throw new Error("jazzkeller: no events-listing__item blocks on the Ticket Tailor page");

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  let unparsed = 0;

  for (const [, block] of blocks) {
    const link = LINK_RE.exec(block);
    if (!link) {
      unparsed++;
      continue;
    }
    const date = link[2];
    const title = decodeEntities(link[3]).replace(/\s+/g, " ").trim();
    if (!title) {
      unparsed++;
      continue;
    }
    if (date < today) continue;

    const id = slugify(`${date}-${title}`);
    if (seen.has(id)) continue;
    seen.add(id);

    const time = START_TIME_RE.exec(block)?.[1]?.padStart(5, "0") ?? null;
    const detailUrl = normalizeUrl(decodeEntities(link[1]), TICKETS_BASE);
    const imgSrc = IMAGE_RE.exec(block)?.[1];
    const genre = classifyMusic(title, null, null, "jazz");

    events.push({
      source_event_id: id,
      title,
      subtitle: null,
      description: null,
      date,
      time,
      end_time: null,
      detail_url: detailUrl,
      ticket_url: detailUrl,
      image_url: imgSrc ? sanitizeImageUrl(decodeEntities(imgSrc)) : null,
      price_min: null,
      price_max: null,
      performers: title,
      venue_room: null,
      raw_category: "music",
      availability: /event__cta--book[^>]*>\s*Fully booked/i.test(block) ? "sold_out" : null,
      labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  if (unparsed > 0 && unparsed === blocks.length) {
    throw new Error(`jazzkeller: ${unparsed} listing blocks, none parseable — Ticket Tailor markup changed`);
  }

  return { source_slug: "jazzkeller", display_name: "Jazzkeller Frankfurt", events };
}
