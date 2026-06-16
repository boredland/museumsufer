import { decodeEntities, slugify, stripHtml } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.st-michaelis.de";
const CAL_URL = `${BASE}/veranstaltungen-am-michel`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeHauptkircheStMichaelis(): Promise<VenueScrapeResult> {
  const res = await fetch(CAL_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`St. Michaelis fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];

  const rows = html.split(/<div[^>]*class="cal-row"[^>]*itemscope[^>]*itemtype="http:\/\/schema\.org\/Event"[^>]*>/);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].split("</div>s*</div>s*</div>")[0];

    // Date / Time from startDate content
    const dateMatch = row.match(/itemprop="startDate"\s+content="([^"]+)"/i);
    if (!dateMatch) continue;
    const datetimeStr = dateMatch[1]; // e.g. "2026-06-20T16:00"
    const date = datetimeStr.substring(0, 10);
    const time = datetimeStr.substring(11, 16);

    // Title
    const titleMatch = row.match(/<h3[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/h3>/i);
    if (!titleMatch) continue;
    const title = cleanText(titleMatch[1]);

    // Subtitle
    const subtitleMatch = row.match(/<div class="title">[\s\S]*?<p>([\s\S]*?)<\/p>/i);
    const subtitle = subtitleMatch ? cleanText(subtitleMatch[1]) : null;

    // Description
    const descMatch = row.match(/itemprop="description"[\s\S]*?>([\s\S]*?)<\/div>/i);
    const description = descMatch ? cleanText(descMatch[1]) : null;

    // Ticket link
    const ticketMatch = row.match(/href="([^"]+)"[^>]*class="ticket-link"/i);
    const ticket_url = ticketMatch ? decodeEntities(ticketMatch[1]) : null;

    // Source Event ID
    const source_event_id = `${slugify(title)}|${date}`;

    events.push({
      source_event_id,
      title,
      subtitle,
      description: description || subtitle,
      date,
      time: time || null,
      detail_url: CAL_URL,
      ticket_url: ticket_url || CAL_URL,
      image_url: null,
      venue_room: null,
      price_min: null,
      price_max: null,
      labels: [{ label: "music:sacred", confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return {
    source_slug: "hauptkirche-st-michaelis",
    display_name: "Hauptkirche St. Michaelis",
    events,
  };
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
