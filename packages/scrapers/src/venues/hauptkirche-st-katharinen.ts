import { decodeEntities, normalizeUrl, slugify, stripHtml } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.katharinen-hamburg.de";
const CAL_URL = `${BASE}/musik/terminkalender/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const MONTH_MAP: Record<string, string> = {
  januar: "01",
  jan: "01",
  februar: "02",
  feb: "02",
  märz: "03",
  mrz: "03",
  april: "04",
  apr: "04",
  mai: "05",
  juni: "06",
  jun: "06",
  juli: "07",
  jul: "07",
  august: "08",
  aug: "08",
  september: "09",
  sep: "09",
  sept: "09",
  oktober: "10",
  okt: "10",
  november: "11",
  nov: "11",
  dezember: "12",
  dez: "12",
};

export async function scrapeHauptkircheStKatharinen(): Promise<VenueScrapeResult> {
  const res = await fetch(CAL_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`St. Katharinen fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];

  const items = html.split(/<div[^>]*class="[^"]*single-upcoming-event[^"]*"/);

  for (let i = 1; i < items.length; i++) {
    const item = items[i].split("</div></div></div></div>")[0];

    // Date parsing
    const dateMatch = item.match(
      /<div[^>]*class="event-date"[^>]*>\s*(\d+)\.\s*<br>\s*([a-zA-ZäöüÄÖÜß]+)\s*<br>\s*(\d+)/i,
    );
    if (!dateMatch) continue;
    const day = dateMatch[1].padStart(2, "0");
    const monthName = dateMatch[2].toLowerCase();
    const year = dateMatch[3];
    const month = MONTH_MAP[monthName];
    if (!month) continue;
    const date = `${year}-${month}-${day}`;

    // Title and Detail Link
    const titleMatch = item.match(
      /href="([^"]+)"[^>]*>\s*<span[^>]*itemprop="headline"[^>]*>([\s\S]*?)<\/span>\s*<\/a>/i,
    );
    if (!titleMatch) continue;
    const detailUrl = normalizeUrl(titleMatch[1], BASE) || CAL_URL;
    const title = cleanText(titleMatch[2]);

    // Time and Location Description
    const descMatch = item.match(/<div[^>]*itemprop="description"[^>]*>\s*([\d:]+)\s*Uhr\s*\|\s*([\s\S]*?)<\/div>/i);
    let time: string | null = null;
    let locationRoom: string | null = null;
    if (descMatch) {
      time = descMatch[1];
      locationRoom = cleanText(descMatch[2]);
    }

    // Image URL
    let image_url: string | null = null;
    const imgMatch = item.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
    if (imgMatch) {
      image_url = normalizeUrl(decodeEntities(imgMatch[1]), BASE);
    }

    const showIdMatch = detailUrl.match(/\/(\d+)-[^/]+\/?$/);
    const eventId = showIdMatch ? showIdMatch[1] : slugify(title);

    events.push({
      source_event_id: `katharinen-${eventId}|${date}`,
      title,
      subtitle: null,
      description: locationRoom || null,
      date,
      time: time || null,
      detail_url: detailUrl,
      ticket_url: `https://katharinenkirche.reservix.de`, // Default ticket store for St. Katharinen
      image_url,
      venue_room: locationRoom || null,
      price_min: null,
      price_max: null,
      labels: [{ label: "music:sacred", confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return {
    source_slug: "hauptkirche-st-katharinen",
    display_name: "Hauptkirche St. Katharinen",
    events,
  };
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
