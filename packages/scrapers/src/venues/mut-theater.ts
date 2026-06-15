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

  // Simple regex parser based on the observed HTML:
  // Each block contains date details, title, and a link to tickets (eventim-light).
  // E.g. dates are written in blocks like "19 Juni", "Freitag, 19:30"
  // Let's use a robust matcher for the list items/blocks if possible.
  // We can look for Tickets/Eventim-light links and walk backwards or structure it.

  // We can extract event sections by finding ticket links
  const _TICKET_RE = /href="(https:\/\/www\.eventim-light\.com\/[^"]+)"[^>]*>Tickets<\/a>/g;
  let _m: RegExpExecArray | null;

  // As a fallback / simple parser, we search for blocks.
  // In the markdown step 2251, each event has date, title, details, and [Tickets](url) link.
  // We'll extract blocks using regex or parse simple patterns.
  // Since we cannot rely on complex DOM parsing without libraries (we only have basic regex & helper functions),
  // let's do a regex block matcher or look for list items.

  // Each event is usually in an event-block or list item.
  // Let's match `<div class="event...` or `<li>` elements, or simply partition by `<hr>` or ticket links.
  const blocks = html.split(/<div\s+class="[^"]*event[^"]*"/gi);
  if (blocks.length <= 1) {
    return [];
  }

  const year = new Date(today).getFullYear();

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // Find ticket link
    const ticketMatch = block.match(/href="(https:\/\/[^"]*eventim-light\.com[^"]+)"/i);
    const ticketUrl = ticketMatch ? decodeEntities(ticketMatch[1]) : null;

    // Find title
    // Usually inside <h3> or <h4> or a class="event-title"
    const titleMatch =
      block.match(/<h[34][^>]*>(.*?)<\/h[34]>/i) || block.match(/class="[^"]*title[^"]*"[^>]*>(.*?)<\//i);
    const title = titleMatch ? cleanText(titleMatch[1]) : "";
    if (!title) continue;

    // Find date and time
    // Look for patterns like "19. Juni" or "19.06." or similar
    // And time like "19:30"
    const timeMatch = block.match(/(\d{2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : "19:30";

    const dateMatch = block.match(/(\d{1,2})\.\s*(Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)/i);
    let date = today;
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, "0");
      const monthStr = dateMatch[2].toLowerCase();
      const monthMap: Record<string, string> = {
        jan: "01",
        feb: "02",
        mär: "03",
        apr: "04",
        mai: "05",
        jun: "06",
        jul: "07",
        aug: "08",
        sep: "09",
        okt: "10",
        nov: "11",
        dez: "12",
      };
      const month = monthMap[monthStr.slice(0, 3)] || "01";
      date = `${year}-${month}-${day}`;
      if (date < today) {
        // Assume next year
        date = `${year + 1}-${month}-${day}`;
      }
    }

    const uid = `${slugify(title)}|${date}|${time}`;
    if (seen.has(uid)) continue;
    seen.add(uid);

    // Image URL
    const imgMatch = block.match(/src="([^"]+\.(?:jpg|jpeg|png|webp))"/i);
    const imageUrl = imgMatch ? imgMatch[1] : null;

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
