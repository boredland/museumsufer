import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * Theater Altes Heizkraftwerk — independent stage in a former power station
 * in Hamburg-Eppendorf. Wix site whose Wix Events app server-renders its
 * programme into the `wix-warmup-data` JSON blob (no separate REST call, no
 * headless render needed): a `…events.events[]` array carrying each
 * performance's title, description, `scheduling.config.startDate` (UTC ISO),
 * geo-coordinates, image and ticketing. We read that array; the public
 * `?ical=1`-style detail URLs are JS-built client-side, so we point detail/
 * ticket links at the spielplan page.
 */
const SPIELPLAN_URL = "https://www.theater-altes-heizkraftwerk.de/spielplan";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface WixEvent {
  id?: string;
  title?: string;
  description?: string;
  slug?: string;
  status?: number;
  scheduling?: { config?: { startDate?: string; endDate?: string } };
  mainImage?: { url?: string };
  registration?: {
    ticketing?: {
      lowestTicketPrice?: { amount?: string };
      highestTicketPrice?: { amount?: string };
      soldOut?: boolean;
    };
  };
}

export async function scrapeHeizkraftwerkHamburg(): Promise<VenueScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`heizkraftwerk-hamburg fetch failed: ${res.status}`);
  const html = await res.text();
  const today = todayIso();

  const warm = html.match(/<script[^>]*id="wix-warmup-data"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!warm) throw new Error("heizkraftwerk-hamburg: wix-warmup-data not found");
  const data = JSON.parse(warm) as unknown;

  // The Wix Events widget key is unstable, so locate the events array by
  // shape rather than by its appsWarmupData GUID/widget path.
  const wixEvents = findWixEvents(data);

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const ev of wixEvents) {
    const startDate = ev.scheduling?.config?.startDate;
    const title = ev.title?.trim();
    if (!startDate || !title) continue;

    const date = toBerlinDate(new Date(startDate));
    if (date < today) continue;

    const sourceEventId = ev.id ?? `${date}|${ev.slug ?? title}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const ticketing = ev.registration?.ticketing;
    const subtitle = ev.description?.trim() || null;

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle,
      description: null,
      date,
      time: toBerlinTime(new Date(startDate)),
      end_time: ev.scheduling?.config?.endDate ? toBerlinTime(new Date(ev.scheduling.config.endDate)) : null,
      detail_url: SPIELPLAN_URL,
      ticket_url: SPIELPLAN_URL,
      image_url: ev.mainImage?.url ?? null,
      price_min: parsePrice(ticketing?.lowestTicketPrice?.amount),
      price_max: parsePrice(ticketing?.highestTicketPrice?.amount),
      performers: null,
      venue_room: null,
      raw_category: null,
      availability: ticketing?.soldOut ? "sold_out" : null,
      labels: resolveStageLabels({
        title,
        subtitle,
        defaultLabel: "stage:theater",
        confidence: 0.85,
        classifier: "scraper-hardcoded",
      }),
    });
  }

  return { source_slug: "heizkraftwerk-hamburg", display_name: "Theater Altes Heizkraftwerk", events };
}

function parsePrice(amount: string | undefined): number | null {
  if (!amount) return null;
  const n = Number.parseFloat(amount);
  return Number.isFinite(n) ? n : null;
}

/** Depth-first search for the Wix Events `{ events: WixEvent[] }` container. */
function findWixEvents(node: unknown): WixEvent[] {
  if (node == null || typeof node !== "object") return [];
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findWixEvents(child);
      if (hit.length) return hit;
    }
    return [];
  }
  const rec = node as Record<string, unknown>;
  const list = rec.events;
  if (Array.isArray(list) && list.length > 0) {
    const first = list[0] as Record<string, unknown> | null;
    if (first && typeof first === "object" && "scheduling" in first && "title" in first) {
      return list as WixEvent[];
    }
  }
  for (const value of Object.values(rec)) {
    const hit = findWixEvents(value);
    if (hit.length) return hit;
  }
  return [];
}
