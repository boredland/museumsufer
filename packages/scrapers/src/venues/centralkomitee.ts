import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE_URL = "https://tickets.centralkomitee.de";
const PRODUCTS_URL = `${BASE_URL}/faceless/pwa/1/catalog/products`;
const EVENTS_URL = `${BASE_URL}/faceless/pwa/1/catalog/events`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

export async function scrapeCentralkomitee(): Promise<VenueScrapeResult> {
  const events: CanonicalScrapedEvent[] = [];

  try {
    const [productsRes, eventsRes] = await Promise.all([
      fetch(PRODUCTS_URL, { headers: { "User-Agent": UA } }),
      fetch(EVENTS_URL, { headers: { "User-Agent": UA } }),
    ]);

    if (!productsRes.ok || !eventsRes.ok) {
      throw new Error(`fetch failed: products=${productsRes.status}, events=${eventsRes.status}`);
    }

    const products = (await productsRes.json()) as any[];
    const rawEvents = (await eventsRes.json()) as any[];

    const today = todayIso();
    const eventMap = new Map<number, any>();
    for (const ev of rawEvents) {
      eventMap.set(ev.id, ev);
    }

    for (const p of products) {
      if (p.type !== "Ticket") continue;
      const date = p.valid_start_on;
      if (!date || date < today) continue;

      const time = p.time_begin || "20:00";
      const eventInfo = p.event_id ? eventMap.get(p.event_id) : null;
      const description = eventInfo?.description ? cleanText(eventInfo.description) : null;

      const ticketUrl = `${BASE_URL}/product/${p.id}/${p.ptitle}`;
      const imageUrl = p.image?.url ? `${BASE_URL}${p.image.url}` : null;

      const uid = `${slugify(p.title)}|${date}|${time}`;

      events.push({
        source_event_id: uid,
        title: p.title,
        subtitle: null,
        description,
        date,
        time,
        detail_url: ticketUrl,
        ticket_url: ticketUrl,
        image_url: imageUrl,
        price_min: p.min_price ? parseFloat(p.min_price) : null,
        price_max: p.max_price ? parseFloat(p.max_price) : null,
        performers: null,
        venue_room: "Centralkomitee",
        raw_category: null,
        labels: resolveStageLabels({
          title: p.title,
          subtitle: null,
          defaultLabel: "stage:theater",
          confidence: 0.85,
        }),
      });
    }
  } catch (err) {
    console.warn("Centralkomitee fetch error:", err);
  }

  // Sort events chronologically
  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

  return {
    source_slug: "centralkomitee",
    display_name: "Centralkomitee",
    events,
  };
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
