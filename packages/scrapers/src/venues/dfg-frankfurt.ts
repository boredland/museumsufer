import { classifyEvent, classifyTalk, eventTypeToLabel } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.dfg-frankfurt.de";
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

interface TribeEvent {
  id: number;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  excerpt?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  image?: { url?: string | null } | null;
  cost?: string | null;
  venue?: { venue?: string | null } | null;
}

interface TribeResponse {
  events?: TribeEvent[] | null;
}

/**
 * Deutsch-Französische Gesellschaft Frankfurt — French-cultural Verein
 * running talks, receptions, and the annual Französische Filmwoche at
 * Cinéma Frankfurt. WordPress + The Events Calendar plugin, so we hit
 * /wp-json/tribe/events/v1/events directly. Each event gets classified
 * (Vortrag / Film / …) by the keyword classifier — Filmwoche entries
 * automatically end up tagged film:cinema.
 */
export async function scrapeDfgFrankfurt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const url = `${BASE}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`dfg-frankfurt fetch failed: ${res.status}`);
  const data = (await res.json()) as TribeResponse;
  const tribeEvents = data.events ?? [];

  const events: CanonicalScrapedEvent[] = [];
  for (const ev of tribeEvents) {
    if (!ev.title || !ev.start_date) continue;
    const [date, timeFull] = ev.start_date.split(" ");
    if (!date || date < today) continue;
    const time = timeFull && timeFull !== "00:00:00" ? timeFull.slice(0, 5) : null;

    const endDateRaw = ev.end_date?.split(" ")[0];
    const endTimeRaw = ev.end_date?.split(" ")[1];
    const endDate = endDateRaw && endDateRaw !== date ? endDateRaw : null;
    const endTime =
      endTimeRaw && endTimeRaw !== "00:00:00" && endTimeRaw.slice(0, 5) !== time ? endTimeRaw.slice(0, 5) : null;

    const title = decodeHtmlEntities(stripHtml(ev.title)).replace(/\s+/g, " ").trim();
    if (!title) continue;
    const description = ev.excerpt
      ? stripHtml(ev.excerpt).replace(/\s+/g, " ").trim() || null
      : ev.description
        ? stripHtml(ev.description).replace(/\s+/g, " ").trim() || null
        : null;

    events.push({
      source_event_id: String(ev.id),
      title,
      description,
      date,
      time,
      end_date: endDate,
      end_time: endTime,
      detail_url: ev.url ?? null,
      image_url: ev.image?.url ?? null,
      venue_room: ev.venue?.venue ?? null,
      labels: labelsFor(title, description),
    });
  }

  return { source_slug: "dfg-frankfurt", display_name: "Deutsch-Französische Gesellschaft Frankfurt", events };
}

function labelsFor(title: string, description: string | null): ScrapedLabel[] {
  const type = classifyEvent(title, description);
  if (type === "Film") return [{ label: "film:cinema", confidence: 0.85, classifier: "keyword:event" }];
  if (type === "Vortrag") {
    const sub = classifyTalk(title, description).toLowerCase();
    return [{ label: `talk:${sub}`, confidence: 0.85, classifier: "keyword:event" }];
  }
  if (type === "Konzert") return [{ label: "music:classical", confidence: 0.7, classifier: "keyword:event" }];
  const mapped = eventTypeToLabel(type);
  return [{ label: mapped ?? "event:venue", confidence: 0.6, classifier: "keyword:event" }];
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#8211;/g, "–")
    .replace(/&#8222;/g, "„")
    .replace(/&#8220;/g, "„")
    .replace(/&#8221;/g, '"')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#x2026;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}
