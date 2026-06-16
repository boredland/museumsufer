import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const SPIELPLAN_URL = "https://muttheater.de/programm/";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * MUT! Theater — Intercultural theater in Hamburg Schanzenviertel.
 * Parses the /programm/ HTML which contains scheduled performances.
 */
export async function scrapeMutTheater(): Promise<VenueScrapeResult> {
  let html = "";
  try {
    const res = await fetch(SPIELPLAN_URL, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "de-DE,de;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`MUT! Theater fetch failed: ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.warn("MUT! Theater fetch error:", err);
    return { source_slug: "mut-theater", display_name: "MUT! Theater", events: [] };
  }

  const events = parseEvents(html);
  return { source_slug: "mut-theater", display_name: "MUT! Theater", events };
}

function parseEvents(html: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const out: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  /**
   * MUT! Theater uses the WooCommerce Bookings / Stacked Slider plugin.
   * Each performance is a `<li class="wcs-class ...">` element containing:
   *   - `<time datetime="2026-06-19 7:30 p.m." class="wcs-class__time">...</time>`
   *   - `<h3 class="wcs-class__title">TITLE</h3>`
   *   - An eventim-light ticket link: href="https://www.eventim-light.com/..."
   *   - An image: `<div class="wcs-class__image" style="background-image: url(...)">`
   */

  // Split on wcs-class list items
  const blocks = html.split(/class="wcs-class\s+wcs-class--filterable/i);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // Title from wcs-class__title h3
    const titleMatch = block.match(/<h3\s+class="wcs-class__title[^"]*"\s*>\s*([^<]+)\s*<\/h3>/i);
    const title = titleMatch ? cleanText(titleMatch[1]) : "";
    if (!title) continue;

    // Datetime from <time datetime="2026-06-19 7:30 p.m.">
    const datetimeMatch = block.match(/datetime="(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s*(a\.m\.|p\.m\.)?"/i);
    if (!datetimeMatch) continue;

    const date = datetimeMatch[1];
    if (date < today) continue;

    // Parse time (12h → 24h)
    const rawTime = datetimeMatch[2];
    const meridiem = datetimeMatch[3]?.toLowerCase() ?? "";
    let [h, m] = rawTime.split(":").map(Number);
    if (meridiem === "p.m." && h !== 12) h += 12;
    if (meridiem === "a.m." && h === 12) h = 0;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    // Ticket link from eventim-light href
    const ticketMatch = block.match(/href='(https?:\/\/www\.eventim-light\.com\/[^']+)'/i);
    const ticketUrl = ticketMatch ? decodeEntities(ticketMatch[1]) : null;

    // Image URL from background-image style
    const imgMatch = block.match(/background-image:\s*url\(([^)]+)\)/i);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    const uid = `${slugify(title)}|${date}|${time}`;
    if (seen.has(uid)) continue;
    seen.add(uid);

    out.push({
      source_event_id: uid,
      title,
      subtitle: null,
      description: null,
      date,
      time,
      detail_url: SPIELPLAN_URL,
      ticket_url: ticketUrl || SPIELPLAN_URL,
      image_url: imageUrl,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: "MUT! Theater",
      raw_category: null,
      labels: resolveStageLabels({
        title,
        subtitle: null,
        defaultLabel: "stage:theater",
        confidence: 0.85,
      }),
    });
  }

  return out;
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
