import { decodeEntities, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.alleetheater.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeAlleeTheater(): Promise<VenueScrapeResult> {
  const res = await fetch(BASE, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Allee Theater fetch failed: ${res.status}`);
  const html = await res.text();

  const calendarStart = html.indexOf('<div id="calendar">');
  if (calendarStart === -1) {
    return { source_slug: "alleetheater", display_name: "Allee Theater", events: [] };
  }

  const calendarHtml = html.slice(calendarStart, calendarStart + 500000);
  const events: CanonicalScrapedEvent[] = [];
  const today = todayIso();
  const seen = new Set<string>();

  const itemRe =
    /<div\s+class="item\s+([^"]+)">\s*<a\s+href="([^"]+)"[^>]*>\s*<span\s+class="time">([^<]+)<\/span>\s*<span\s+class="title">([\s\S]*?)<\/span>\s*<\/a>\s*<\/div>/g;
  const perfHeaderRe = /<div\s+class="performance[^"]*"\s+id="(\d+)">/g;

  let m: RegExpExecArray | null;
  while ((m = perfHeaderRe.exec(calendarHtml)) !== null) {
    const timestampSec = parseInt(m[1], 10);
    const dateStr = new Date(timestampSec * 1000).toISOString().slice(0, 10);
    if (dateStr < today) continue;

    const startIdx = m.index + m[0].length;
    const nextMatch = perfHeaderRe.exec(calendarHtml);
    const endIdx = nextMatch ? nextMatch.index : calendarHtml.indexOf("</div></div></div>", startIdx);

    // Reset nextMatch exec pointer
    perfHeaderRe.lastIndex = startIdx;

    const block = calendarHtml.slice(startIdx, endIdx);
    const itemMatches = [...block.matchAll(itemRe)];

    for (const itemM of itemMatches) {
      const type = itemM[1].trim();
      const href = decodeEntities(itemM[2]);
      const timeStr = itemM[3].replace("h", "").trim();
      const title = decodeEntities(itemM[4]).trim();

      const eventId = href.match(/[?&]event=(\d+)/)?.[1] ?? `${dateStr}|${timeStr}`;
      if (seen.has(eventId)) continue;
      seen.add(eventId);

      const venueRoom = type === "kammeroper" ? "Hamburger Kammeroper" : "Theater für Kinder";

      events.push({
        source_event_id: eventId,
        title,
        date: dateStr,
        time: timeStr,
        detail_url: href,
        ticket_url: href,
        venue_room: venueRoom,
        labels: resolveStageLabels({
          title,
          defaultLabel: "stage:theater",
          confidence: 0.9,
        }),
      });
    }

    if (nextMatch) {
      perfHeaderRe.lastIndex = nextMatch.index;
    } else {
      break;
    }
  }

  return { source_slug: "alleetheater", display_name: "Allee Theater", events };
}
