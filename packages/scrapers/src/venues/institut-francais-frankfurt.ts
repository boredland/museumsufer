import { stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Institut français Frankfurt — the national portal's event list is a JS app
 * (`y1_aec_events_frontend_v2`) backed by a same-origin JSON proxy. `locationId=35`
 * is the Frankfurt centre; the Drupal HTML listing this scraper used to parse is
 * gone (404), the JSON endpoint is what the page itself calls.
 *
 * Events happen at partner venues (Cinéma, DFF, Campus Westend, FIT), which the
 * response carries in `location.information`, so that becomes the room.
 */
const BASE = "https://www.institutfrancais.de";
const API = `${BASE}/events-proxy-v2/events`;
const DETAIL_BASE = `${BASE}/de/veranstaltungen/veranstaltung`;
const FRANKFURT_CENTRE_ID = 35;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const PAGE_LIMIT = 100;
const MAX_PAGES = 5;

interface IfEvent {
  id: number;
  name: string;
  date: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  price?: number | null;
  reducedPrice?: number | null;
  shortDescription?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isSoldOut?: boolean;
  registerLink?: string | null;
  tags?: Array<{ id: number; name: string }>;
  location?: { information?: string | null } | null;
}

interface IfResponse {
  totalPages?: number;
  events?: IfEvent[];
}

/** Tag ids on the portal; the emoji prefix in the name is decoration. First hit wins. */
const LABEL_BY_TAG: Array<[number, ScrapedLabel]> = [
  [4, { label: "film:cinema", confidence: 0.9, classifier: "upstream-tag" }],
  [14, { label: "stage:theater", confidence: 0.85, classifier: "upstream-tag" }],
  [13, { label: "music:classical", confidence: 0.8, classifier: "upstream-tag" }],
  [12, { label: "talk:lesung", confidence: 0.85, classifier: "upstream-tag" }],
  [5, { label: "talk:vortrag", confidence: 0.85, classifier: "upstream-tag" }],
  [3, { label: "museum:ausstellung", confidence: 0.8, classifier: "upstream-tag" }],
];
const FALLBACK_LABEL: ScrapedLabel = { label: "talk:vortrag", confidence: 0.5, classifier: "scraper-hardcoded" };

export async function scrapeInstitutFrancaisFrankfurt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<number>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${API}?locationId=${FRANKFURT_CENTRE_ID}&limit=${PAGE_LIMIT}&page=${page}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`institut-francais-frankfurt fetch failed: ${res.status}`);
    const body = (await res.json()) as IfResponse;
    if (!Array.isArray(body.events)) throw new Error("institut-francais-frankfurt: response has no events array");

    for (const ev of body.events) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      const end_date = ev.endDate && ev.endDate !== ev.date ? ev.endDate : null;
      if ((end_date ?? ev.date) < today) continue;
      const title = stripHtml(ev.name);
      if (!title) continue;

      const intro = stripHtml(ev.shortDescription ?? "");
      const body = stripHtml(ev.description ?? "");
      const tagIds = new Set((ev.tags ?? []).map((t) => t.id));
      const label = LABEL_BY_TAG.find(([id]) => tagIds.has(id))?.[1] ?? FALLBACK_LABEL;
      const link = ev.registerLink?.trim() || null;

      events.push({
        source_event_id: String(ev.id),
        title,
        description: [intro, body].filter(Boolean).join(" — ") || null,
        date: ev.date,
        time: hhmm(ev.startTime),
        end_date,
        end_time: hhmm(ev.endTime),
        detail_url: `${DETAIL_BASE}/${ev.id}`,
        ticket_url: link,
        image_url: ev.imageUrl ?? null,
        venue_room: stripHtml(ev.location?.information ?? "") || null,
        price_min: ev.reducedPrice ?? ev.price ?? null,
        price_max: ev.price ?? null,
        availability: ev.isSoldOut ? "sold_out" : null,
        language: "fr",
        labels: [label],
      });
    }

    if (page >= (body.totalPages ?? 1)) break;
  }

  return { source_slug: "institut-francais-frankfurt", display_name: "Institut français Frankfurt", events };
}

/** "20:00:00" → "20:00"; the portal sends "00:00:00" for "no end time". */
function hhmm(value: string | null | undefined): string | null {
  const t = value?.slice(0, 5);
  return t && t !== "00:00" ? t : null;
}
