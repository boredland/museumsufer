import { decodeEntities, normalizeUrl, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Hessische Stiftung Friedens- und Konfliktforschung (HSFK / PRIF) —
 * the institute hosts and co-organises events all over the world (their
 * researchers travel, and they jointly run conferences abroad). We
 * filter to Frankfurt-area only, plus their own institute address; the
 * hub's geofence would catch the rest anyway, but filtering at the
 * scraper level keeps the per-source count honest.
 *
 * HSFK uid attributes are stable across runs and unique per event, so we
 * use them as source_event_id.
 */
const BASE = "https://www.hsfk.de";
const LIST_URL = `${BASE}/veranstaltungen`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const ITEM_RE =
  /<div\s+itemscope="itemscope"\s+class="[^"]*uid(\d+)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<hr\s+class="va-trenner"/g;
const DATE_RE = /<time\s+itemprop="datePublished"\s+datetime="(\d{4}-\d{2}-\d{2})"/;
const TIME_RE = /<\/time>\s*<\/span>\s*<br\s*\/?>\s*(\d{1,2})[.:](\d{2})\s*Uhr/;
const LOCATION_RE = /<small>\s*([\s\S]*?)\s*<\/small>/;
const TITLE_RE = /<span\s+itemprop="headline">\s*([\s\S]*?)\s*<\/span>/;
const URL_RE = /<a\s+itemprop="url"[^>]+href="([^"]+)"/;
const DESC_RE = /<div\s+itemprop="description">\s*([\s\S]*?)\s*<\/div>/;

/** Locations that count as Frankfurt-area. Postal codes 60xxx and 65xxx
 *  cover Frankfurt + Wiesbaden + Mainz fringe; 63xxx covers Offenbach +
 *  Hanau + Rodgau; 61xxx covers Bad Homburg / Friedrichsdorf. */
const FRANKFURT_LOCATION_RE =
  /(?:^|[\s,])(?:60|61|63|65)\d{3}\s+\w|frankfurt\s*am\s*main|frankfurt\/m\.?|frankfurt\s*\/?\s*main|wiesbaden|offenbach|bad\s+homburg|hanau/i;
/** Frankfurt (Oder) is a different city in Brandenburg — explicitly
 *  exclude it so the FRANKFURT_LOCATION_RE doesn't accidentally match. */
const FRANKFURT_ODER_RE = /frankfurt\s*[/(]\s*oder/i;
const ONLINE_RE = /^online\b/i;

export async function scrapeHsfkFrankfurt(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`hsfk-frankfurt fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];

  for (const m of html.matchAll(ITEM_RE)) {
    const uid = m[1];
    const block = m[2];

    const date = block.match(DATE_RE)?.[1];
    if (!date || date < today) continue;

    const location = stripHtml(decodeEntities(block.match(LOCATION_RE)?.[1] ?? "")).trim();
    if (!isFrankfurtArea(location)) continue;

    const title = stripHtml(decodeEntities(block.match(TITLE_RE)?.[1] ?? "")).trim();
    if (!title) continue;

    const timeMatch = block.match(TIME_RE);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

    const description = stripHtml(decodeEntities(block.match(DESC_RE)?.[1] ?? "")).trim() || null;
    const detailHref = block.match(URL_RE)?.[1];
    const detailUrl = detailHref ? normalizeUrl(decodeEntities(detailHref), BASE) : LIST_URL;

    events.push({
      source_event_id: uid,
      title,
      description,
      date,
      time,
      end_date: null,
      end_time: null,
      detail_url: detailUrl,
      ticket_url: null,
      image_url: null,
      raw_category: location || null,
      labels: [{ label: "talk:vortrag", confidence: 0.85, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "hsfk-frankfurt", display_name: "HSFK / PRIF Frankfurt", events };
}

function isFrankfurtArea(location: string): boolean {
  if (!location) return false;
  if (ONLINE_RE.test(location)) return true;
  if (FRANKFURT_ODER_RE.test(location)) return false;
  return FRANKFURT_LOCATION_RE.test(location);
}
