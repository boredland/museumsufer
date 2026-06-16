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

  /**
   * Theater das Zimmer uses the All-in-One Event Calendar (ai1ec) WordPress plugin.
   * The calendar shows a monthly table. Each event produces:
   *   - an `<a class="ai1ec-event-container ...">` anchor with the Veranstaltung href
   *   - inside: `<span class="ai1ec-event-title">TITLE</span>`
   *   - inside: `<span class="ai1ec-event-time">HH:MM</span>`
   *   - a popup `<div class="ai1ec-popover ...">` that contains:
   *     - `<a class="ai1ec-load-event" href="...">TITLE</a>` (HTML-entity-encoded)
   *     - `<div class="ai1ec-event-time">MONTHNAME DAY um HH:MM</div>`
   *     - `data-ticket-url="..."` on the inner ai1ec-event div
   *
   * We split on the popup's event-time text (which has full "MonName DAY um HH:MM")
   * and walk backwards to get title and forward to get ticket URL.
   */

  // Split on ai1ec-event-container blocks
  const blocks = html.split(/class="ai1ec-event-container/i);

  const GERMAN_MONTHS: Record<string, string> = {
    Januar: "01",
    Februar: "02",
    März: "03",
    April: "04",
    Mai: "05",
    Juni: "06",
    Juli: "07",
    August: "08",
    September: "09",
    Oktober: "10",
    November: "11",
    Dezember: "12",
  };

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // Title from ai1ec-event-title span
    const titleMatch = block.match(/<span\s+class="ai1ec-event-title"\s*>\s*([^<]+)\s*<\/span>/i);
    const title = titleMatch ? cleanText(titleMatch[1]) : "";
    if (!title) continue;

    // Full date+time from popup "MonName DAY um HH:MM"
    const popupTimeMatch = block.match(/class="ai1ec-event-time">\s*(\w+)\s+(\d{1,2})\s+um\s+(\d{2}:\d{2})/i);
    if (!popupTimeMatch) continue;

    const monthName = popupTimeMatch[1];
    const dayStr = popupTimeMatch[2].padStart(2, "0");
    const time = popupTimeMatch[3];
    const monthNum = GERMAN_MONTHS[monthName];
    if (!monthNum) continue;

    // Year: infer from today — if month+day < today assume next year
    const year = new Date(today).getFullYear();
    let date = `${year}-${monthNum}-${dayStr}`;
    if (date < today) date = `${year + 1}-${monthNum}-${dayStr}`;

    // Ticket URL from data-ticket-url attribute
    const ticketMatch = block.match(/data-ticket-url="([^"]+)"/i);
    const ticketUrl = ticketMatch ? decodeEntities(ticketMatch[1]) : null;

    // Detail URL from first Veranstaltung href in this block (HTML-entity-encoded)
    const hrefMatch = block.match(
      /href="(https?(?:&#x3A;|:)(?:&#x2F;&#x2F;|\/\/)www\.theater-das-zimmer\.de(?:&#x2F;|\/)?Veranstaltung[^"]+)"/i,
    );
    const detailUrl = hrefMatch
      ? decodeEntities(hrefMatch[1].replace(/&#x3A;/g, ":").replace(/&#x2F;/g, "/"))
      : SPIELPLAN_URL;

    // Image URL
    const imgMatch = block.match(/src="([^"]+\.(?:jpg|jpeg|png|webp))"/i);
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
      detail_url: detailUrl,
      ticket_url: ticketUrl || detailUrl,
      image_url: imageUrl,
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
