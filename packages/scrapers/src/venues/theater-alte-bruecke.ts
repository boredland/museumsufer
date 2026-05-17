import { decodeEntities, stripHtml, todayIso, truncate } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.theater-alte-bruecke.de";
const TRIBE_API = `${BASE}/wp-json/tribe/events/v1/events`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Theater Alte Brücke is a WordPress site running The Events Calendar
 * (Tribe Events). Their REST API at `/wp-json/tribe/events/v1/events`
 * exposes the entire programme with title, slug, start/end ISO datetime
 * (Europe/Berlin), description, image, venue, categories, cost, and a
 * `website` field that points at the Reservix booking URL. `per_page`
 * caps at 50, so we paginate via `next_rest_url`.
 */

interface TribeEvent {
  id: number;
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  start_date: string;
  end_date: string;
  timezone: string;
  cost: string;
  cost_details: { values?: string[] };
  website: string;
  url: string;
  status: string;
  image: { url: string } | false | null;
  venue?: { venue?: string };
  categories?: Array<{ name: string }>;
}

interface TribeResponse {
  events: TribeEvent[];
  next_rest_url?: string;
  total?: number;
}

export async function scrapeTheaterAlteBruecke(): Promise<VenueScrapeResult> {
  const events = await fetchAllEvents();
  return parse(events);
}

async function fetchAllEvents(): Promise<TribeEvent[]> {
  const out: TribeEvent[] = [];
  let url: string | undefined = `${TRIBE_API}?per_page=50`;
  let safety = 10;
  while (url && safety-- > 0) {
    const res: Response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) break;
    const data: TribeResponse = (await res.json()) as TribeResponse;
    out.push(...(data.events ?? []));
    url = data.next_rest_url;
  }
  return out;
}

function parse(events: TribeEvent[]): VenueScrapeResult {
  const today = todayIso();
  const out: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const e of events) {
    if (e.status !== "publish") continue;
    const date = e.start_date.slice(0, 10);
    if (date < today) continue;
    const time = e.start_date.slice(11, 16);
    const endTime = e.end_date.slice(11, 16);
    const dedup = `${e.id}|${date}|${time}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    const title = stripHtml(decodeEntities(e.title));
    const subtitle = e.excerpt ? truncate(decodeEntities(e.excerpt), 160) : null;
    const description = e.description ? truncate(decodeEntities(e.description), 800) : null;
    const categoryHint = e.categories?.map((c) => c.name).join(" ") ?? null;

    out.push({
      source_event_id: String(e.id),
      title,
      subtitle,
      description,
      date,
      time: time === "00:00" ? null : time,
      end_time: endTime !== "00:00" && endTime !== time ? endTime : null,
      detail_url: e.url,
      ticket_url: e.website || e.url,
      image_url: e.image && typeof e.image === "object" ? e.image.url : null,
      venue_room: e.venue?.venue ?? null,
      raw_category: categoryHint,
      labels: resolveStageLabels({ title, subtitle, hint: categoryHint, confidence: 0.9 }),
    });
  }

  return { source_slug: "theater-alte-bruecke", display_name: "Theater Alte Brücke", events: out };
}
