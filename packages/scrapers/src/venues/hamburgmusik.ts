import { decodeEntities, normalizeUrl, slugify, stripHtml } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.elbphilharmonie.de";
const SPIELPLAN_URL = `${BASE}/de/programm`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeHamburgMusik(): Promise<VenueScrapeResult[]> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`Elbphilharmonie fetch failed: ${res.status}`);
  const html = await res.text();

  const elphiEvents: CanonicalScrapedEvent[] = [];
  const laeiszhalleEvents: CanonicalScrapedEvent[] = [];

  // Parse list items with class event-item
  const eventItems = html.split(/<li[^>]*class="[^"]*event-item[^"]*"[^>]*>/);

  for (let i = 1; i < eventItems.length; i++) {
    const item = eventItems[i].split("</li>")[0];

    // Date/Time
    const timeMatch = item.match(/<time\s+datetime="([^"]+)"/i);
    if (!timeMatch) continue;
    const datetimeStr = timeMatch[1]; // e.g. "2026-06-16T19:30:00+02:00"
    const date = datetimeStr.substring(0, 10);
    const time = datetimeStr.substring(11, 16);

    // Venue Room
    const venueMatch = item.match(
      /<div\s+class="[^"]*place-cell">\s*<span\s+class="caption[^"]*">\s*<strong>\s*([^<]+)\s*<\/strong>\s*([^<]+)/i,
    );
    if (!venueMatch) continue;
    const venueName = cleanText(venueMatch[1]);
    const venueRoom = cleanText(venueMatch[2]);

    // Title & Detail Url
    const titleMatch = item.match(/<p\s+class="event-title[^"]*">\s*<a\s+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    if (!titleMatch) continue;
    const detailUrl = normalizeUrl(titleMatch[1], BASE) || SPIELPLAN_URL;
    const title = cleanText(titleMatch[2]);

    // Subtitle
    const subtitleMatch = item.match(/<p\s+class="event-subtitle">([\s\S]*?)<\/p>/i);
    const subtitle = subtitleMatch ? cleanText(subtitleMatch[1]) : null;

    // Image Url
    let image_url: string | null = null;
    const imgMatch = item.match(/<img\s+src="([^"]+)"/i);
    if (imgMatch) {
      image_url = normalizeUrl(decodeEntities(imgMatch[1]), BASE);
    } else {
      const srcsetMatch = item.match(/srcset="([^"]+)"/i);
      if (srcsetMatch) {
        const firstSrc = srcsetMatch[1].split(",")[0].trim().split(" ")[0];
        image_url = normalizeUrl(decodeEntities(firstSrc), BASE);
      }
    }

    // Ticket Url
    const ticketMatch = item.match(/<a\s+class="[^"]*link-ticket"[^>]*href="([^"]+)"/i);
    const ticket_url = ticketMatch ? normalizeUrl(decodeEntities(ticketMatch[1]), BASE) : null;

    // Derive stable source event ID
    const showIdMatch = detailUrl.match(/\/(\d+)$/);
    const eventId = showIdMatch ? showIdMatch[1] : slugify(title);
    const source_event_id = `${eventId}|${date}`;

    const canonicalEvent: CanonicalScrapedEvent = {
      source_event_id,
      title,
      subtitle,
      description: subtitle,
      date,
      time,
      detail_url: detailUrl,
      ticket_url: ticket_url || detailUrl,
      image_url,
      venue_room: venueRoom || null,
      price_min: null,
      price_max: null,
      labels: [], // classification pass will label this
    };

    if (venueName.toLowerCase().includes("laeiszhalle")) {
      laeiszhalleEvents.push(canonicalEvent);
    } else {
      // Default to Elbphilharmonie
      elphiEvents.push(canonicalEvent);
    }
  }

  return [
    {
      source_slug: "elbphilharmonie",
      display_name: "Elbphilharmonie Hamburg",
      events: elphiEvents,
    },
    {
      source_slug: "laeiszhalle",
      display_name: "Laeiszhalle Hamburg",
      events: laeiszhalleEvents,
    },
  ];
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
