import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const API_URL = "https://muwi.gomus.de/api/v4/events";
const DETAIL_BASE = "https://museum-wiesbaden.de/kalender";
const TICKET_BASE = "https://muwi-shop.gomus.de/#/product/event";
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

/**
 * Museum Wiesbaden — Hessisches Landesmuseum für Kunst & Natur. The
 * calendar is powered by GoMus v4; we query /api/v4/events for the full
 * event catalogue, expand each event's `upcoming_bookings_start_times`
 * into one dated entry, and skip anything before today. The API returns
 * bare datetime strings ("2026-06-26 14:00:00") in Europe/Berlin. No
 * pagination needed — the full catalogue fits under 200 items.
 */
export async function scrapeMuseumWiesbaden(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(`${API_URL}?per_page=200`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`museum-wiesbaden fetch failed: ${res.status}`);
  const body = (await res.json()) as GoMusEventsResponse;
  const eventList = body.events ?? [];

  const results: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const ev of eventList) {
    const title = (ev.title ?? "").trim();
    if (!title) continue;
    const description = ev.description ? stripHtml(ev.description).trim().slice(0, 2000) || null : null;
    const image = ev.picture?.teaser_3x2 ?? ev.picture?.original ?? null;
    const categoryName = ev.category?.name ?? null;

    const upcoming = ev.upcoming_bookings_start_times ?? [];
    for (const rawStart of upcoming) {
      const parsed = parseBerlinDt(rawStart);
      if (!parsed) continue;
      const { date, time } = parsed;
      if (date < today) continue;

      // Deduplicate: same event on same date
      const dedupKey = `${ev.id}|${date}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      // End time from duration (minutes).
      let endTime: string | null = null;
      if (typeof ev.duration === "number" && ev.duration > 0 && time) {
        const [h, m] = time.split(":").map(Number);
        const end = new Date(0, 0, 0, h, m + ev.duration);
        endTime = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
      }

      const detailUrl = `${DETAIL_BASE}?event=${ev.id}`;
      const ticketUrl = `${TICKET_BASE}/${ev.id}`;

      // Meeting point (room) from dates vs event-level; prefer date-specific.
      // Since the events endpoint doesn't carry per-date meeting_point, we
      // use null here — the dates endpoint would have it, but the event
      // endpoint with upcoming_bookings_start_times gives us the full horizon.

      results.push({
        source_event_id: `${ev.id}-${date}`,
        title,
        description,
        date,
        time,
        end_time: endTime,
        detail_url: detailUrl,
        ticket_url: ticketUrl,
        image_url: image,
        labels: buildLabels(title, description, categoryName),
      });
    }
  }

  return { source_slug: "museum-wiesbaden", display_name: "Museum Wiesbaden", events: results };
}

// ─── helpers ────────────────────────────────────────────────────────────

/** Parse a GoMus upcoming bookings datetime like "2026-06-26 14:00:00"
 *  (Europe/Berlin, no timezone). Returns date ISO + time HH:MM or null. */
function parseBerlinDt(raw: string): { date: string; time: string | null } | null {
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}):\d{2}$/);
  if (!m) return null;
  return { date: m[1], time: m[2] };
}

function buildLabels(
  _title: string,
  _description: string | null,
  categoryName: string | null,
): Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> {
  const labels: Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> = [
    { label: "museum:event", confidence: 0.95, classifier: "scraper-hardcoded" },
  ];
  // Category hint — helps the hub classifier prioritise.
  if (categoryName === "Führung") {
    labels.push({ label: "museum:fuehrung", confidence: 0.8, classifier: "scraper-hardcoded" });
  } else if (categoryName === "Vortrag") {
    labels.push({ label: "talk:lecture", confidence: 0.7, classifier: "scraper-hardcoded" });
  } else if (categoryName === "Konzert") {
    labels.push({ label: "music:classical", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  return labels;
}

// ─── GoMus v4 API types ─────────────────────────────────────────────────

interface GoMusPicture {
  original?: string;
  teaser_3x2?: string;
}

interface GoMusCategory {
  id: number;
  name: string;
}

interface GoMusLocation {
  name?: string;
  city?: string;
  street?: string;
  zip?: string;
  latitude?: string;
  longitude?: string;
}

interface GoMusEvent {
  id: number;
  title: string | null;
  sub_title?: string | null;
  description: string | null;
  duration: number | null;
  entry_fee: number | null;
  category?: GoMusCategory | null;
  picture?: GoMusPicture | null;
  location?: GoMusLocation | null;
  upcoming_bookings_start_times?: string[] | null;
  event_title?: string | null;
  event_sub_title?: string | null;
}

interface GoMusEventsResponse {
  events?: GoMusEvent[];
  meta?: { total_count: number; page: number; per_page: number };
}
