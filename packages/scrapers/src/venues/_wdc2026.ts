import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core/date";
import { slugify } from "@museumsufer/core/html";
import { type ProxyConfig, proxyFetch } from "../proxy";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://wdc2026.org";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

/**
 * World Design Capital Frankfurt RheinMain 2026 — a year-long, region-wide
 * cultural programme published from a Payload CMS. The REST API exposes the
 * whole event collection at /api/events. Dates are stored as UTC instants
 * with a separate `_tz` (Europe/Berlin), so each is converted to Berlin
 * local before splitting into date/time.
 *
 * WDC is an aggregator, not a venue: its events happen at dozens of real
 * places (Jüdisches Museum, Kunstverein Montez, …). We fan out one
 * `VenueScrapeResult` per host venue — slugged from the location title and
 * namespaced under `wdc2026-` — so consumers attribute each event to where
 * it actually happens rather than to the umbrella programme.
 *
 * Event-type slugs map onto the shared label vocabulary; unmapped types are
 * emitted label-less for the hub keyword pass. Events without geocoordinates
 * (online / region-only) are skipped — the geofence has no source default.
 */
const EVENT_TYPE_LABELS: Record<string, string> = {
  "talk-diskussion": "talk:diskussion",
  konferenz: "talk:vortrag",
  ausstellung: "museum:ausstellung",
  "fuehrung-spaziergang": "museum:fuehrung",
  workshop: "museum:workshop",
  "bildung-vermittlung": "museum:workshop",
  "performance-tanz-theater": "stage:theater",
  filmscreening: "film:cinema",
};

const FALLBACK_SLUG = "wdc2026";
const FALLBACK_NAME = "World Design Capital Frankfurt RheinMain 2026";

const SELECT_FIELDS = [
  "title",
  "description",
  "slug",
  "startDate",
  "endDate",
  "datePrecision",
  "_status",
  "eventTypes",
  "location",
  "hero",
] as const;

interface WdcEventType {
  slug?: string | null;
}

interface WdcLocation {
  title?: string | null;
  openstreetmap?: { coordinate?: [number, number] | null } | null;
  location?: { address?: { city?: string | null } | null } | null;
}

interface WdcEvent {
  slug: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  datePrecision?: string | null;
  _status?: string | null;
  eventTypes?: WdcEventType[] | null;
  location?: WdcLocation | WdcLocation[] | null;
  hero?: { slide?: Array<{ media?: { url?: string | null } | null }> | null } | null;
}

interface Venue {
  sourceSlug: string;
  displayName: string;
  events: CanonicalScrapedEvent[];
}

function firstLocation(loc: WdcEvent["location"]): WdcLocation | null {
  return Array.isArray(loc) ? (loc[0] ?? null) : (loc ?? null);
}

function imageFrom(hero: WdcEvent["hero"]): string | null {
  const url = hero?.slide?.find((s) => s?.media?.url)?.media?.url;
  return url ? `${BASE}${url}` : null;
}

function labelsFor(eventTypes: WdcEvent["eventTypes"]): ScrapedLabel[] {
  const seen = new Set<string>();
  const labels: ScrapedLabel[] = [];
  for (const t of eventTypes ?? []) {
    const mapped = t?.slug ? EVENT_TYPE_LABELS[t.slug] : undefined;
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped);
      labels.push({ label: mapped, confidence: 0.95, classifier: "upstream-tag" });
    }
  }
  return labels;
}

export async function scrapeWdc2026(proxy: ProxyConfig | null): Promise<VenueScrapeResult[]> {
  const params = new URLSearchParams({ depth: "1", limit: "2000", sort: "startDate" });
  params.append("where[_status][equals]", "published");
  for (const f of SELECT_FIELDS) params.append(`select[${f}]`, "true");

  const res = await proxyFetch(`${BASE}/api/events?${params}`, proxy, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`wdc2026 fetch failed: ${res.status}`);
  const body = (await res.json()) as { docs?: WdcEvent[] };

  const today = todayIso();
  const venues = new Map<string, Venue>();

  for (const doc of body.docs ?? []) {
    if (doc._status && doc._status !== "published") continue;
    if (!doc.startDate || !doc.slug) continue;

    const loc = firstLocation(doc.location);
    const coord = loc?.openstreetmap?.coordinate;
    if (!Array.isArray(coord) || typeof coord[0] !== "number" || typeof coord[1] !== "number") continue;

    const hasTime = doc.datePrecision === "time";
    const date = toBerlinDate(new Date(doc.startDate));
    const time = hasTime ? toBerlinTime(new Date(doc.startDate)) : null;

    let endDate: string | null = null;
    let endTime: string | null = null;
    if (doc.endDate) {
      const end = new Date(doc.endDate);
      const endDay = toBerlinDate(end);
      if (endDay !== date) endDate = endDay;
      if (hasTime) endTime = toBerlinTime(end);
    }

    if ((endDate ?? date) < today) continue;

    const venueName = loc?.title?.trim() || FALLBACK_NAME;
    const sourceSlug = venueName === FALLBACK_NAME ? FALLBACK_SLUG : `wdc2026-${slugify(venueName)}`;
    let venue = venues.get(sourceSlug);
    if (!venue) {
      venue = { sourceSlug, displayName: venueName, events: [] };
      venues.set(sourceSlug, venue);
    }

    venue.events.push({
      source_event_id: doc.slug,
      title: doc.title,
      description: doc.description ?? null,
      date,
      time,
      end_date: endDate,
      end_time: endTime,
      detail_url: `${BASE}/de/events/${doc.slug}`,
      image_url: imageFrom(doc.hero),
      city: loc?.location?.address?.city?.replace(/[\s.]+$/, "") || null,
      lat: coord[1],
      lon: coord[0],
      raw_category:
        (doc.eventTypes ?? [])
          .map((t) => t?.slug)
          .filter(Boolean)
          .join(",") || null,
      labels: labelsFor(doc.eventTypes),
    });
  }

  return [...venues.values()]
    .map((v) => ({ source_slug: v.sourceSlug, display_name: v.displayName, events: v.events }))
    .sort((a, b) => a.source_slug.localeCompare(b.source_slug));
}
