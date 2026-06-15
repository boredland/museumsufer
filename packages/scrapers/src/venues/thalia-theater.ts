import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.thalia-theater.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeThaliaTheater(): Promise<VenueScrapeResult> {
  const today = todayIso();
  let url: string | null = `${BASE}/de/api/events/?date=${today}`;
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  while (url) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`Thalia API fetch failed: ${res.status} on ${url}`);
    const data = (await res.json()) as any;

    for (const ev of data.results) {
      if (!ev.date_start || !ev.production_name) continue;

      const dateStr = ev.date_start.slice(0, 10);
      const timeStr = ev.date_start.slice(11, 16);
      const endDateTime = ev.date_end;
      const endTimeStr = endDateTime ? endDateTime.slice(11, 16) : null;

      let imageUrl = null;
      if (ev.header_image_thumbs) {
        const thumbs = ev.header_image_thumbs;
        const relativePath = thumbs.medium || thumbs.large || thumbs.small || thumbs.xlarge || thumbs.xsmall;
        if (relativePath) imageUrl = `${BASE}${relativePath}`;
      }

      const detailUrl = ev.production_slug?.de
        ? `${BASE}/de/programm/stuecke/${ev.production_slug.de}`
        : `${BASE}/de/spielplan/`;

      const sourceEventId = String(ev.id);
      if (seen.has(sourceEventId)) continue;
      seen.add(sourceEventId);

      const title = ev.production_name.trim();
      const subtitle = ev.production_subtitle?.trim() || null;
      const description = subtitle;

      events.push({
        source_event_id: sourceEventId,
        title,
        subtitle,
        description,
        date: dateStr,
        time: timeStr !== "00:00" ? timeStr : null,
        end_time: endTimeStr !== "00:00" ? endTimeStr : null,
        detail_url: detailUrl,
        ticket_url: ev.ticket_url_external || null,
        image_url: imageUrl,
        price_min: ev.min_price ? parseFloat(ev.min_price) : null,
        price_max: null,
        performers: null,
        venue_room: ev.stage_name || null,
        raw_category: null,
        labels: resolveStageLabels({ title, subtitle, confidence: 0.9 }),
      });
    }

    url = data.next ? data.next.replace(/^http:/, "https:") : null;
  }

  return { source_slug: "thalia-theater", display_name: "Thalia Theater", events };
}
