import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

interface TribeConfig {
  /** Our internal source slug for the hub. */
  slug: string;
  /** Display name for the venue. */
  name: string;
  /** Base URL of the WordPress site. */
  base: string;
}

const VENUES: TribeConfig[] = [
  {
    slug: "kammerspiele-wiesbaden",
    name: "Kammerspiele Wiesbaden",
    base: "https://www.kammerspiele-wiesbaden.de",
  },
  {
    slug: "kuenstlerhaus43",
    name: "kuenstlerhaus43",
    base: "https://kuenstlerhaus43.de",
  },
];

/**
 * Generic Tribe Events (The Events Calendar) REST API scraper. Each
 * WordPress site running the plugin exposes events at:
 *   /wp-json/tribe/events/v1/events?per_page=100&start_date={today}
 *
 * We query each configured venue and expand the results into
 * CanonicalScrapedEvents with date, time, title, description, image,
 * and detail/ticket URLs.
 */
export async function scrapeTribeEvents(): Promise<VenueScrapeResult[]> {
  const today = todayIso();

  const results = await Promise.all(
    VENUES.map(async (venue) => {
      try {
        const url = `${venue.base}/wp-json/tribe/events/v1/events?per_page=100&start_date=${today}`;
        const res = await fetch(url, {
          headers: { "User-Agent": UA, Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as TribeResponse;
        const raw = body.events ?? [];

        const events: CanonicalScrapedEvent[] = [];
        const seen = new Set<string>();

        for (const ev of raw) {
          if (!ev.start_date) continue;
          const start = new Date(ev.start_date.replace(" ", "T"));
          if (isNaN(start.getTime())) continue;
          const date = toBerlinDate(start);
          const time = toBerlinTime(start);

          const endDate = ev.end_date ? new Date(ev.end_date.replace(" ", "T")) : null;
          const endTime = endDate && !isNaN(endDate.getTime()) ? toBerlinTime(endDate) : null;

          const dedupKey = `${ev.id}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          const description = ev.description
            ? stripHtml(ev.description).replace(/\s+/g, " ").trim().slice(0, 2000) || null
            : null;

          const cost = Number(ev.cost_details?.values?.[0]);
          const priceMin = !isNaN(cost) && cost > 0 ? cost : null;

          const venueRoom = ev.venue?.venue ?? null;

          events.push({
            source_event_id: String(ev.id),
            title: ev.title.trim(),
            description,
            date,
            time,
            end_time: endTime && endTime !== time ? endTime : null,
            detail_url: ev.url,
            ticket_url: ev.url, // Tribe events often have info+booking on same page
            image_url: ev.image?.url ?? null,
            price_min: priceMin,
            venue_room: venueRoom,
            labels: buildLabels(ev.title, ev.categories?.[0]?.name ?? null),
          });
        }

        return {
          source_slug: venue.slug,
          display_name: venue.name,
          events,
        };
      } catch (err) {
        console.warn(`_tribe-events ${venue.slug}: ${err instanceof Error ? err.message : String(err)}`);
        return { source_slug: venue.slug, display_name: venue.name, events: [] };
      }
    }),
  );

  return results;
}

function buildLabels(
  title: string,
  category: string | null,
): Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> {
  const labels: Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> = [
    { label: "stage:theater", confidence: 0.95, classifier: "scraper-hardcoded" },
  ];
  const t = title.toLowerCase();
  if (t.includes("konzert") || t.includes("musik") || t.includes("jazz") || t.includes("liederabend")) {
    labels.push({ label: "music:concert", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  if (t.includes("lesung") || t.includes("vortrag") || t.includes("gespräch") || t.includes("diskussion")) {
    labels.push({ label: "talk:lecture", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  if (t.includes("comedy") || t.includes("kabarett") || t.includes("show")) {
    labels.push({ label: "stage:comedy", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  return labels;
}

// ─── Tribe API types ─────────────────────────────────────────────────────

interface TribeResponse {
  events?: TribeEvent[];
  total?: number;
}

interface TribeEvent {
  id: number;
  title: string;
  description: string;
  url: string;
  start_date: string;
  end_date: string;
  image?: { url?: string } | null;
  cost_details?: { values?: number[] } | null;
  venue?: { venue?: string } | null;
  categories?: Array<{ name?: string }> | null;
}
