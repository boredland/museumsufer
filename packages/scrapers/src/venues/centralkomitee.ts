import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const SPIELPLAN_URL = "https://centralkomitee.de/programm/";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Centralkomitee Hamburg — Cabaret, stand-up comedy and theater stage in St. Georg.
 * Powered by TicketToaster.
 */
export async function scrapeCentralkomitee(): Promise<VenueScrapeResult> {
  let html = "";
  try {
    const res = await fetch(SPIELPLAN_URL, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`Centralkomitee fetch failed: ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.warn("Centralkomitee fetch error:", err);
    return { source_slug: "centralkomitee", display_name: "Centralkomitee", events: [] };
  }

  const events = parseEvents(html);
  return { source_slug: "centralkomitee", display_name: "Centralkomitee", events };
}

function parseEvents(html: string): CanonicalScrapedEvent[] {
  const today = todayIso();
  const out: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // TicketToaster event listings usually use specific html patterns
  const blocks = html.split(/class="[^"]*event-list-item[^"]*"/gi);
  if (blocks.length <= 1) {
    return [];
  }

  const year = new Date(today).getFullYear();

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // Find link and title
    const titleMatch =
      block.match(/<h[234][^>]*>(.*?)<\/h[234]>/i) || block.match(/class="[^"]*title[^"]*"[^>]*>(.*?)<\//i);
    const title = titleMatch ? cleanText(titleMatch[1]) : "";
    if (!title) continue;

    const linkMatch = block.match(/href="([^"]+)"/i);
    const detailUrl = linkMatch ? decodeEntities(linkMatch[1]) : SPIELPLAN_URL;

    // Date/time
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
      venue_room: "Centralkomitee",
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
