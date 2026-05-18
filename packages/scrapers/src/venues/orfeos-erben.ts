import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const EF_BASE = "https://eventfrog.de";
const LOCATION_URL = `${EF_BASE}/de/locations/Orfeos-Erben-6910236197197927686.html`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const ITEM_RE = /<li class="event-overview-list[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
const URL_RE = /<a[^>]+itemprop="url"[^>]+href="(\/de\/p\/[^"]+)"/;
const NAME_RE = /<h2 itemprop="name">\s*([\s\S]*?)\s*<\/h2>/;
const START_RE = /datetime="(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;
const IMG_RE = /<img[^>]+src="([^"]+)"/;

/**
 * Orfeos Erben publishes its programme as eventfrog event series; the
 * cinema's own site only links out to those pages. We scrape the
 * eventfrog location index to discover each series, then emit one event
 * per series anchored to its next showtime (eventfrog's location view
 * doesn't expose the full date list per series).
 */
export async function scrapeOrfeosErben(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(LOCATION_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`orfeos eventfrog fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ITEM_RE)) {
    const block = m[1];
    const url = block.match(URL_RE)?.[1];
    const start = block.match(START_RE);
    const name = block.match(NAME_RE)?.[1];
    if (!url || !start || !name) continue;

    const seriesId = url.replace(/^.*-(\d+)\.html$/, "$1");
    const date = start[1];
    if (date < today) continue;
    const time = start[2];
    const sourceId = `${seriesId}-${date}-${time.replace(":", "")}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    // Eventfrog repeats one <li> per occurrence inside a series, so each
    // emitted event is a single showtime; the location page's "day range"
    // span describes the whole series, not this single date.
    const title = stripHtml(name).replace(/\s+/g, " ").trim();
    const image_url = block.match(IMG_RE)?.[1];

    events.push({
      source_event_id: sourceId,
      title,
      date,
      time,
      detail_url: `${EF_BASE}${url}`,
      image_url: image_url && !image_url.includes("placehold") ? `${EF_BASE}${image_url}` : null,
      labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "orfeos-erben", display_name: "Orfeos Erben", events };
}
