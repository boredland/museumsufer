import { decodeEntities, normalizeUrl, slugify, stripHtml } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.sankt-petri.de";
const CAL_URL = `${BASE}/musik/konzertkalender`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeHauptkircheStPetri(): Promise<VenueScrapeResult> {
  const res = await fetch(CAL_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`St. Petri fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];

  const items = html.split(/<!--[\s\S]*?Partials\/List\/EventItem\.html[\s\S]*?-->/i);

  for (let i = 1; i < items.length; i++) {
    const item = items[i].split("<!--")[0]; // split at next template block

    // Date
    const dateMatch = item.match(/<div[^>]*class="event-date[^"]*"[^>]*>([\d.]+)<\/div>/i);
    if (!dateMatch) continue;
    const dateRaw = dateMatch[1]; // e.g. "17.06.26"
    const dateParts = dateRaw.split(".");
    if (dateParts.length < 3) continue;
    const year = `20${dateParts[2]}`;
    const month = dateParts[1].padStart(2, "0");
    const day = dateParts[0].padStart(2, "0");
    const date = `${year}-${month}-${day}`;

    // Time
    const timeMatch = item.match(/<time[^>]*datetime="([^"]+)"/i);
    const time = timeMatch ? timeMatch[1] : null;

    // Title & Detail Url
    const titleMatch = item.match(
      /<a[^>]*itemprop="url"[^>]*href="([^"]+)"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>\s*<\/a>/i,
    );
    if (!titleMatch) continue;
    const detailUrl = normalizeUrl(titleMatch[1], BASE) || CAL_URL;
    const title = cleanText(titleMatch[2]);

    // Description
    const descMatch = item.match(/<\/a>\s*<p class="">([\s\S]*?)<\/p>/i);
    const description = descMatch ? cleanText(descMatch[1]) : null;

    // Ticket Link
    let ticket_url: string | null = null;
    const ticketMatch = item.match(/href="([^"]*ticket[^"]*)"/i);
    if (ticketMatch) {
      ticket_url = normalizeUrl(decodeEntities(ticketMatch[1]), BASE);
    }

    const showIdMatch = detailUrl.match(/-(\d+)$/);
    const eventId = showIdMatch ? showIdMatch[1] : slugify(title);

    events.push({
      source_event_id: `petri-${eventId}|${date}`,
      title,
      subtitle: null,
      description: description || null,
      date,
      time: time || null,
      detail_url: detailUrl,
      ticket_url: ticket_url || detailUrl,
      image_url: null,
      venue_room: null,
      price_min: null,
      price_max: null,
      labels: [{ label: "music:sacred", confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return {
    source_slug: "hauptkirche-st-petri",
    display_name: "Hauptkirche St. Petri",
    events,
  };
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
