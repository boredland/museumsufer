import { dateOffset, decodeEntities, stripHtml, todayIso, truncate } from "@museumsufer/core";
import { classify } from "../genre-heuristics";
import type { ScrapedEvent, ScrapeResult } from "../types";

const BASE = "https://www.alteoper.de";
const API = `${BASE}/de/api/events/`;
const UA = "konzert.haus crawler / contact: jonas@bgdlabs.com";

interface AofEvent {
  id: number;
  slug: string;
  room: string | null;
  start_date: string;
  end_date: string | null;
  headline: string;
  subtitle: string;
  introduction: string;
  organizer: string;
  title: string;
  ticket_link: string;
  image: { url?: string } | null;
  thumbs: { large?: string; medium?: string; small?: string } | null;
  ticket_status: string;
  single_price: boolean | number;
  lowest_price: number | null;
  is_past: boolean;
}

interface AofResponse {
  count: number;
  next: string | null;
  results: AofEvent[];
}

const MAX_PAGES = 25;

export async function scrapeAlteOper(): Promise<ScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(120);
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();
  let url: string | null = `${API}?from_date=${today}`;
  let pages = 0;

  while (url && pages < MAX_PAGES) {
    const res: Response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`alte-oper fetch failed: ${url} → ${res.status}`);
    const data: AofResponse = (await res.json()) as AofResponse;
    let pastHorizon = false;
    for (const raw of data.results ?? []) {
      if (raw.is_past) continue;
      const date = raw.start_date.slice(0, 10);
      if (date < today) continue;
      if (date > horizon) {
        pastHorizon = true;
        continue;
      }
      const time = raw.start_date.slice(11, 16);
      const endTime = raw.end_date?.slice(11, 16) ?? null;

      const title = stripHtml(decodeEntities(raw.title)).trim();
      const subtitle = raw.subtitle ? stripHtml(decodeEntities(raw.subtitle)).trim() : null;
      const headline = raw.headline ? stripHtml(decodeEntities(raw.headline)).trim() : null;
      const description = raw.introduction ? truncate(stripHtml(decodeEntities(raw.introduction)), 800) : null;
      const performers = raw.organizer ? stripHtml(decodeEntities(raw.organizer)).trim() : null;
      const room = raw.room ? stripHtml(decodeEntities(raw.room)).trim() : null;

      const imageUrl = raw.thumbs?.large || raw.thumbs?.medium || raw.thumbs?.small || raw.image?.url || null;
      const detailUrl = `${BASE}/de/programm/${raw.slug}/`;

      const priceMin = raw.lowest_price != null ? Number(raw.lowest_price) : null;

      const dedup = `${raw.slug}|${date}|${time}|${room ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      events.push({
        slug: raw.slug,
        title,
        subtitle: subtitle || headline || null,
        description,
        date,
        time: time === "00:00" ? null : time,
        end_time: endTime && endTime !== "00:00" && endTime !== time ? endTime : null,
        genre: classify(title, subtitle, headline, "classical"),
        image_url: imageUrl ? absoluteUrl(imageUrl) : null,
        detail_url: detailUrl,
        ticket_url: raw.ticket_link || null,
        price_min: priceMin,
        price_max: null,
        venue_room: room || null,
        performers,
      });
    }
    if (pastHorizon) break;
    url = data.next;
    pages++;
    if (url) await sleep(200);
  }

  return { venue_slug: "alte-oper", events };
}

function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${BASE}${path}`;
  return `${BASE}/${path}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
