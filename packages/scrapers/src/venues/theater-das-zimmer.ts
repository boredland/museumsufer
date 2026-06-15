import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const SPIELPLAN_URL = "https://www.theater-das-zimmer.de/termine/";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Theater das Zimmer — Germany's smallest private theater (40 seats).
 * Uses All-in-One Event Calendar (ai1ec) for WordPress.
 */
export async function scrapeTheaterDasZimmer(): Promise<VenueScrapeResult> {
  let html = "";
  try {
    const res = await fetch(SPIELPLAN_URL, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`Theater das Zimmer fetch failed: ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.warn("Theater das Zimmer fetch error:", err);
    return { source_slug: "theater-das-zimmer", display_name: "Theater das Zimmer", events: [] };
  }

  const events = parseEvents(html);
  return { source_slug: "theater-das-zimmer", display_name: "Theater das Zimmer", events };
}

function parseEvents(html: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const out: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // ai1ec events typically render with classes like "ai1ec-event"
  // Let's split the HTML by the event wrappers
  const blocks = html.split(/class="[^"]*ai1ec-event[^"]*"/gi);
  if (blocks.length <= 1) {
    return [];
  }

  const year = new Date(today).getFullYear();

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // Extract title & link
    const linkMatch = block.match(/href="([^"]*\/Veranstaltung\/[^"]+)"[^>]*>(.*?)<\/a>/i);
    if (!linkMatch) continue;

    const detailUrl = decodeEntities(linkMatch[1]);
    const title = cleanText(linkMatch[2]);
    if (!title) continue;

    // Extract time & date
    const timeMatch = block.match(/(\d{2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : "20:00";

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
        date = `${year + 1}-${month}-${day}`;
      }
    }

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
      detail_url: detailUrl,
      ticket_url: detailUrl,
      image_url: null,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: "Theater das Zimmer",
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
