/**
 * Deutsche Akademie für Sprache und Dichtung (Darmstadt, Mathildenhöhe).
 *
 * Source: the public English events archive list
 * (`/en/activities/events`) lists every event by year. We scan the current
 * and next years, parse the start date from the list item, then fetch the
 * event detail page for the time and admission price.
 */

import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const LIST_URL = "https://www.deutscheakademie.de/en/activities/events";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const COORDS = { lat: 49.879, lon: 8.668 };

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

interface ListEvent {
  id: string;
  dateText: string;
  title: string;
  href: string;
}

/** "13 July 2026" or "26 – 31 January 2026" -> "2026-07-13" (start day). */
function parseEnglishDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})(?:\s*[-–—]\s*\d{1,2})?\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
}

function parseListEvents(html: string): ListEvent[] {
  const events: ListEvent[] = [];
  const re = /<li[^>]*data-status="(\d{4})"[^>]*>([\s\S]*?)<\/li>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    const _year = match[1];
    const block = match[2];
    const hrefMatch = block.match(/href="([^"]+)"/);
    const idMatch = block.match(/data-target-id="(\d+)"/);
    const text = decodeEntities(stripHtml(block.replace(/&nbsp;/g, " ")))
      .replace(/\s+/g, " ")
      .trim();
    const dateTextMatch = text.match(/(\d{1,2}(?:\s*[-–—]\s*\d{1,2})?\s+[A-Za-z]+\s+\d{4})/);
    const title = text
      .replace(dateTextMatch ? dateTextMatch[0] : "", "")
      .replace(/^\s*[-–—]\s*/, "")
      .trim();
    if (hrefMatch && dateTextMatch && title) {
      events.push({
        id: idMatch ? idMatch[1] : hrefMatch[1],
        dateText: dateTextMatch[0],
        title,
        href: hrefMatch[1],
      });
    }
  }
  return events;
}

function parseDetailMeta(html: string, baseUrl: string) {
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? "";
  const decoded = decodeEntities(stripHtml(description)).replace(/\s+/g, " ").trim();

  const timeMatch = decoded.match(/(\d{1,2})[.:](\d{2})\s*Uhr/i);
  const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

  const prices = [...decoded.matchAll(/€\s*(\d+)/g)].map((m) => Number(m[1]));
  const priceMin = prices.length > 0 ? Math.min(...prices) : null;

  const roomMatch = decoded.match(/Uhr\s+(.+?)\s+Eintritt:/i);
  const venueRoom = roomMatch ? roomMatch[1].trim() : null;

  const titleTag = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
  const title = decodeEntities(stripHtml(titleTag.split(" / ")[0]))
    .replace(/\s+/g, " ")
    .trim();
  const detailUrl = new URL(baseUrl, LIST_URL).href;

  return { title, time, priceMin, venueRoom, detailUrl, description: decoded };
}

export async function scrapeDeutscheAkademieDarmstadt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const listRes = await fetch(LIST_URL, { headers: { "User-Agent": UA } });
  if (!listRes.ok) throw new Error(`Deutsche Akademie list fetch failed: ${listRes.status}`);
  const listHtml = await listRes.text();

  const listEvents = parseListEvents(listHtml).filter((e) => {
    const d = parseEnglishDate(e.dateText);
    return d && d >= today;
  });

  const detailResults = await Promise.all(
    listEvents.map(async (item) => {
      try {
        const url = new URL(item.href, LIST_URL).href;
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        if (!res.ok) return null;
        return { item, html: await res.text(), url };
      } catch {
        return null;
      }
    }),
  );

  const events: CanonicalScrapedEvent[] = [];
  for (const result of detailResults) {
    if (!result) continue;
    const date = parseEnglishDate(result.item.dateText);
    if (!date) continue;
    const meta = parseDetailMeta(result.html, result.url);

    events.push({
      source_event_id: result.item.id,
      title: meta.title || result.item.title,
      subtitle: null,
      description: meta.description || null,
      date,
      time: meta.time,
      detail_url: meta.detailUrl,
      ticket_url: meta.detailUrl,
      price_min: meta.priceMin,
      city: "darmstadt",
      lat: COORDS.lat,
      lon: COORDS.lon,
      venue_room: meta.venueRoom,
      performers: null,
      labels: [{ label: "talk:vortrag", confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  return {
    source_slug: "deutsche-akademie-darmstadt",
    display_name: "Deutsche Akademie für Sprache und Dichtung",
    events,
  };
}
