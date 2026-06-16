import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const SPIELPLAN_URL = "https://almahoppe.de/Spielplan";
const BASE = "https://almahoppe.de";
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

export async function scrapeAlmaHoppesLustspielhaus(): Promise<VenueScrapeResult> {
  const events: CanonicalScrapedEvent[] = [];

  try {
    const res = await fetch(SPIELPLAN_URL, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) throw new Error(`Alma Hoppe fetch failed: ${res.status}`);
    const html = await res.text();

    const ROW_RE = /<div class="spielplan-row">([\s\S]+?)<\/div>\s*<\/div>\s*<\/div>/g;
    const IMG_RE = /<img[^>]+class="spielplan-img"[^>]+src="([^"]+)"/;
    const TITLE_RE = /<div class="spielplan-title">([\s\S]+?)<\/div>/;
    const BADGE_RE = /<span class="spielplan-badge[^"]*">([\s\S]*?)<\/span>/;
    const DATE_RE = /spielplan-date">[\s\S]*?\b(?:Mo|Di|Mi|Do|Fr|Sa|So)\s*(\d{2})\.(\d{2})\.(\d{4})\s*(\d{2}:\d{2})/i;
    const INFO_LINK_RE = /href="(\/programm\?id=\d+)"/;
    const TICKET_LINK_RE = /href="(\/Tickets\?id=\d+)"/;

    const rows = [...html.matchAll(ROW_RE)];
    const today = todayIso();

    for (const r of rows) {
      const content = r[1];

      const imgMatch = content.match(IMG_RE);
      const imageUrl = imgMatch ? `${BASE}${imgMatch[1]}` : null;

      const titleMatch = content.match(TITLE_RE);
      if (!titleMatch) continue;
      const title = stripHtml(decodeEntities(titleMatch[1])).replace(/\s+/g, " ").trim();

      const dateMatch = content.match(DATE_RE);
      if (!dateMatch) continue;
      const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
      if (date < today) continue;
      const time = dateMatch[4];

      const infoMatch = content.match(INFO_LINK_RE);
      const detailUrl = infoMatch ? `${BASE}${infoMatch[1]}` : SPIELPLAN_URL;

      const ticketMatch = content.match(TICKET_LINK_RE);
      const ticketUrl = ticketMatch ? `${BASE}${ticketMatch[1]}` : detailUrl;

      const badgeMatch = content.match(BADGE_RE);
      const badge = badgeMatch ? stripHtml(decodeEntities(badgeMatch[1])).trim() : null;

      const sourceEventId = `${slugify(title)}|${date}|${time}`;

      events.push({
        source_event_id: sourceEventId,
        title,
        subtitle: null,
        description: null,
        date,
        time,
        detail_url: detailUrl,
        ticket_url: ticketUrl,
        image_url: imageUrl,
        price_min: null,
        price_max: null,
        performers: null,
        venue_room: "Alma Hoppes Lustspielhaus",
        raw_category: badge ? slugify(badge) : null,
        labels: resolveStageLabels({
          title,
          subtitle: null,
          defaultLabel: "stage:theater",
          confidence: 0.85,
        }),
      });
    }
  } catch (err) {
    console.warn("Alma Hoppes Lustspielhaus fetch error:", err);
  }

  // Sort events chronologically
  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

  return {
    source_slug: "alma-hoppes-lustspielhaus",
    display_name: "Alma Hoppes Lustspielhaus",
    events,
  };
}
