import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://koerber-stiftung.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

interface SearchResponse {
  results?: Array<{
    group: string;
    items: Array<{
      id: number;
      html: string;
    }>;
  }>;
}

export async function scrapeKoerberStiftung(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  let start = 0;
  const limit = 4;
  let keepGoing = true;

  // 1. Paginate through search results until we hit past events
  while (keepGoing) {
    const searchUrl = `${BASE}/search/?group=event&q=K%C3%B6rber&limit=${limit}&start=${start}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": UA,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!res.ok) {
      throw new Error(`koerber-stiftung search failed at start=${start}: ${res.status}`);
    }

    const json = (await res.json()) as SearchResponse;
    const eventGroup = json.results?.find((g) => g.group === "event");
    if (!eventGroup || !eventGroup.items || eventGroup.items.length === 0) {
      break;
    }

    let pageHasFutureEvent = false;

    for (const item of eventGroup.items) {
      const html = item.html;

      // Extract href
      const hrefMatch = html.match(/href="([^"]+)"/);
      if (!hrefMatch) continue;
      const detailPath = hrefMatch[1];
      const detailUrl = detailPath.startsWith("http") ? detailPath : `${BASE}${detailPath}`;

      // Unique check
      const eventId = `koerber-${item.id}`;
      if (seen.has(eventId)) continue;
      seen.add(eventId);

      // Extract datetime
      const datetimeMatch = html.match(/datetime="([^"]+)"/);
      if (!datetimeMatch) continue;
      const datetime = datetimeMatch[1];
      const date = datetime.split("T")[0];

      if (date < today) {
        // Since list is descending, once we hit past event, we stop paginating.
        continue;
      }

      pageHasFutureEvent = true;

      // Extract title
      const titleMatch = html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/);
      const title = titleMatch ? stripHtml(decodeEntities(titleMatch[1])).trim() : "Körber-Stiftung Veranstaltung";

      // Extract time
      const time = datetime.includes("T") ? datetime.split("T")[1].substring(0, 5) : null;

      // Extract teaser image
      const imgMatch = html.match(/src="([^"]+)"/);
      const imageUrl = imgMatch ? (imgMatch[1].startsWith("http") ? imgMatch[1] : `${BASE}${imgMatch[1]}`) : null;

      // Extract location name if available
      const locMatch = html.match(/class="eventteaser_content_meta_location"[^>]*title="Ort:\s*([^"]+)"/);
      const rawCategory = locMatch ? locMatch[1].trim() : null;

      events.push({
        source_event_id: eventId,
        title,
        description: null, // Filled below
        date,
        time,
        end_date: null,
        end_time: null,
        detail_url: detailUrl,
        ticket_url: detailUrl,
        image_url: imageUrl,
        raw_category: rawCategory,
        labels: [],
      });
    }

    if (!pageHasFutureEvent) {
      // If none of the events on this page are in the future, stop paginating
      keepGoing = false;
    } else {
      start += limit;
    }
  }

  // 2. Fetch detail pages of future events to extract descriptions and coordinates
  const concurrency = 6;
  const pool: Promise<void>[] = [];

  for (const ev of events) {
    if (!ev.detail_url) continue;

    if (pool.length >= concurrency) {
      await Promise.race(pool);
    }

    const p = (async () => {
      try {
        const detailRes = await fetch(ev.detail_url!, { headers: { "User-Agent": UA } });
        if (!detailRes.ok) return;
        const html = await detailRes.text();

        // 1. Description
        const summaryMatch = html.match(/<div\s+class="event_summary">([\s\S]*?)<\/div>/);
        const summary = summaryMatch ? stripHtml(decodeEntities(summaryMatch[1])).trim() : "";

        const textMatch = html.match(/<div\s+class="event_text content">([\s\S]*?)<\/div>/);
        const text = textMatch ? stripHtml(decodeEntities(textMatch[1])).trim() : "";

        const description = [summary, text].filter(Boolean).join("\n\n");
        ev.description = description || null;

        // 2. Coordinates from mapbox static image
        const mapImageMatch = html.match(
          /api\.mapbox\.com\/styles\/v1\/[\s\S]*?\/static\/pin-m-[^"]+\/([0-9.]+),([0-9.]+)/,
        );
        if (mapImageMatch) {
          ev.lon = parseFloat(mapImageMatch[1]);
          ev.lat = parseFloat(mapImageMatch[2]);
        }

        // 3. Classify labels
        const type = classifyEvent(ev.title, description);
        const mapped = type ? eventTypeToLabel(type) : null;
        ev.labels = mapped
          ? [{ label: mapped, confidence: 0.8, classifier: "keyword:event" }]
          : [{ label: "talk:vortrag", confidence: 0.7, classifier: "scraper-hardcoded" }];
      } catch (err) {
        console.warn(`koerber-stiftung detail fetch failed for ${ev.detail_url}: ${(err as Error).message}`);
      }
    })();

    pool.push(p);
    p.then(() => {
      const idx = pool.indexOf(p);
      if (idx !== -1) pool.splice(idx, 1);
    });
  }

  await Promise.all(pool);

  return {
    source_slug: "koerber-stiftung",
    display_name: "Körber-Stiftung",
    events,
  };
}
