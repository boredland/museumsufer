import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://filmforum-hoechst.com";
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

interface TribeEvent {
  id: number;
  url?: string | null;
  title?: string | null;
  excerpt?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  image?: { url?: string | null } | null;
  venue?: { venue?: string | null } | null;
}

interface TribeResponse {
  events?: TribeEvent[] | null;
}

/**
 * Filmforum Höchst — Frankfurt's municipal Programmkino (vhs-Stadtteilkino
 * in Höchst). WordPress + The Events Calendar plugin, /wp-json/tribe/events/v1.
 * Pure film programme; every event tagged film:cinema directly.
 */
export async function scrapeFilmforumHoechst(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const url = `${BASE}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`filmforum-hoechst fetch failed: ${res.status}`);
  const data = (await res.json()) as TribeResponse;
  const tribeEvents = data.events ?? [];

  const events: CanonicalScrapedEvent[] = [];
  for (const ev of tribeEvents) {
    if (!ev.title || !ev.start_date) continue;
    const [date, timeFull] = ev.start_date.split(" ");
    if (!date || date < today) continue;
    const time = timeFull && timeFull !== "00:00:00" ? timeFull.slice(0, 5) : null;
    const endTime =
      ev.end_date?.includes(" ") && ev.end_date.split(" ")[1] !== "00:00:00"
        ? ev.end_date.split(" ")[1].slice(0, 5)
        : null;

    const title = decodeHtmlEntities(stripHtml(ev.title)).replace(/\s+/g, " ").trim();
    if (!title) continue;
    const description = ev.excerpt ? stripHtml(ev.excerpt).replace(/\s+/g, " ").trim() || null : null;

    events.push({
      source_event_id: String(ev.id),
      title,
      description,
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      detail_url: ev.url ?? null,
      image_url: ev.image?.url ?? null,
      venue_room: ev.venue?.venue ?? null,
      labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "filmforum-hoechst", display_name: "Filmforum Höchst Frankfurt", events };
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#8211;/g, "–")
    .replace(/&#8222;/g, "„")
    .replace(/&#8220;/g, "„")
    .replace(/&#8221;/g, '"')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}
