import { decodeEntities, normalizeUrl, slugify, stripHtml } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.ensembleresonanz.com";
const CAL_URL = `${BASE}/termine-und-tickets?date=all&filter=all`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeEnsembleResonanz(): Promise<VenueScrapeResult> {
  const res = await fetch(CAL_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`Ensemble Resonanz fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];

  const items = html.split(/<li[^>]*class="[^"]*border-t[^"]*border-black[^"]*"[^>]*>/);

  for (let i = 1; i < items.length; i++) {
    const item = items[i].split("</li>")[0];

    // Detail Url
    const hrefMatch = item.match(/href="(\/termine-und-tickets\/[^"]+)"/i);
    if (!hrefMatch) continue;
    const detailUrl = normalizeUrl(hrefMatch[1], BASE) || CAL_URL;

    // Date from detail URL (ends with YYYY-MM-DD)
    const dateMatch = detailUrl.match(/(\d{4}-\d{2}-\d{2})\/?$/);
    if (!dateMatch) continue;
    const date = dateMatch[1];

    // Title
    const titleMatch = item.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!titleMatch) continue;
    const rawTitle = titleMatch[1];
    // Strip date prefix "Di, 16.06. <br>"
    const titleParts = rawTitle.split(/<br\s*\/?>/i);
    const title = cleanText(titleParts[titleParts.length - 1]);

    // Time & Venue info
    const timeMatch = item.match(/<time>([^<]+)<\/time>/i);
    const timeStr = timeMatch ? timeMatch[1].trim() : null;
    const time = timeStr ? timeStr.replace(/\s*uhr/i, "") : null;

    // Venue room / text
    const textP1Match = item.match(/<div class="text-p1">([\s\S]*?)<\/div>/i);
    let venueText = "";
    if (textP1Match) {
      const pMatch = textP1Match[1].match(/<p>([\s\S]*?)<\/p>/i);
      if (pMatch) {
        // strip time
        const cleanP = stripHtml(pMatch[1])
          .replace(/[\s\S]*Uhr/gi, "")
          .trim();
        venueText = cleanP;
      }
    }

    // Image URL
    let image_url: string | null = null;
    const imgMatch = item.match(/<img[^>]*src="([^"]+)"/i);
    if (imgMatch) {
      image_url = normalizeUrl(decodeEntities(imgMatch[1]), BASE);
    }

    // Ticket Link
    const ticketMatch = item.match(/href="([^"]+)"[^>]*class="btn[^"]*"/i);
    const ticket_url = ticketMatch ? normalizeUrl(decodeEntities(ticketMatch[1]), BASE) : null;

    // Coordinate resolution based on venue text
    let lat = 53.5564; // default to resonanzraum
    let lon = 9.97;
    if (venueText.toLowerCase().includes("elbphilharmonie")) {
      lat = 53.5414;
      lon = 9.9842;
    } else if (venueText.toLowerCase().includes("laeiszhalle")) {
      lat = 53.5561;
      lon = 9.9811;
    } else if (venueText.toLowerCase().includes("mannheim")) {
      // outside geofence, will be dropped
      lat = 49.4875;
      lon = 8.466;
    }

    const showIdMatch = detailUrl.match(/([a-zA-Z0-9-]+)-\d{4}-\d{2}-\d{2}\/?$/);
    const eventId = showIdMatch ? showIdMatch[1] : slugify(title);

    events.push({
      source_event_id: `resonanz-${eventId}|${date}`,
      title,
      subtitle: null,
      description: venueText || null,
      date,
      time: time || null,
      detail_url: detailUrl,
      ticket_url: ticket_url || detailUrl,
      image_url,
      venue_room: venueText || null,
      price_min: null,
      price_max: null,
      lat,
      lon,
      labels: [],
    });
  }

  return {
    source_slug: "ensemble-resonanz",
    display_name: "Ensemble Resonanz",
    events,
  };
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
