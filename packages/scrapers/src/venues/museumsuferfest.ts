import { stripHtml, todayIso } from "@museumsufer/core";
import PQueue from "p-queue";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.museumsuferfest.de";
const SITEMAP_INDEX = `${BASE}/sitemap.xml`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const DETAIL_CONCURRENCY = 8;

/**
 * Museumsuferfest — Frankfurt's museum-embankment festival, three days at the
 * end of August across every riverside house plus open-air stages.
 *
 * The festival publishes no programme PDF. Its TYPO3 site renders one page per
 * event carrying a complete Schema.org `Event` in JSON-LD — name, description,
 * start/end, image, organizer, and the venue's own geo coordinates — so this
 * needs neither an LLM extraction pass nor a geocode, and stays inside the
 * deterministic scrape path.
 *
 * The section listings (`/programm`, `/programm/buehnen`, …) lazy-load and
 * expose only ~52 events between them. The `ndsdestinationdataevent` sitemap is
 * the authoritative index and lists all ~355, so we drive off that instead.
 */
export async function scrapeMuseumsuferfest(): Promise<VenueScrapeResult> {
  const urls = await fetchEventUrls();
  const today = todayIso();

  const queue = new PQueue({ concurrency: DETAIL_CONCURRENCY });
  const events: CanonicalScrapedEvent[] = [];
  for (const url of urls) {
    queue.add(async () => {
      const event = await fetchEvent(url, today);
      if (event) events.push(event);
    });
  }
  await queue.onIdle();

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );
  return { source_slug: "museumsuferfest", display_name: "Museumsuferfest", events };
}

/** The sitemap index points at a dedicated event sitemap whose cHash changes
 *  per deploy, so we resolve it from the index rather than hardcoding it. */
async function fetchEventUrls(): Promise<string[]> {
  const index = await fetchText(SITEMAP_INDEX);
  if (!index) return [];
  const eventSitemap = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(/&amp;/g, "&").trim())
    .find((loc) => loc.includes("sitemap=ndsdestinationdataevent"));
  if (!eventSitemap) return [];

  const xml = await fetchText(eventSitemap);
  if (!xml) return [];
  const urls = new Set<string>();
  for (const m of xml.matchAll(/<loc>([^<]*\/event\/[^<]+)<\/loc>/g)) urls.add(m[1].replace(/&amp;/g, "&").trim());
  return [...urls];
}

async function fetchEvent(url: string, today: string): Promise<CanonicalScrapedEvent | null> {
  const html = await fetchText(url);
  if (!html) return null;

  const event = parseEventLd(html);
  if (!event?.name || !event.startDate) return null;

  const start = splitIsoDateTime(event.startDate);
  const end = event.endDate ? splitIsoDateTime(event.endDate) : null;
  if (!start || start.date < today) return null;

  const place = event.location?.[0];
  const title = stripHtml(event.name).trim();
  const description = event.description ? stripHtml(event.description).trim() || null : null;

  return {
    // The festival reuses one page per recurring slot, so the id needs the
    // occurrence: identifier alone collapses a run into a single event.
    source_event_id: `${event.identifier?.[0] ?? url}|${start.date}|${start.time ?? ""}`,
    title,
    description,
    date: start.date,
    time: start.time,
    // Upstream sets endDate on every event, usually the same day; only a real
    // span is a multi-day event.
    end_date: end && end.date !== start.date ? end.date : null,
    end_time: end && end.date === start.date && end.time !== start.time ? end.time : null,
    detail_url: url,
    image_url: event.image?.[0]?.url ?? null,
    // Upstream pads organizer and place names with a leading space.
    performers: event.organizer?.[0]?.name?.trim() || null,
    venue_room: place?.name?.trim() || null,
    city: place?.address?.addressLocality ?? null,
    lat: place?.geo?.latitude ?? null,
    lon: place?.geo?.longitude ?? null,
    labels: labelsFor(event.keywords),
  };
}

interface LdPlace {
  name?: string;
  address?: { addressLocality?: string };
  geo?: { latitude?: number; longitude?: number };
}

interface LdEvent {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  identifier?: string[];
  startDate?: string;
  endDate?: string;
  keywords?: string | string[];
  image?: Array<{ url?: string }>;
  location?: LdPlace[];
  organizer?: Array<{ name?: string }>;
}

/** Detail pages carry two JSON-LD blocks — the Event and a BreadcrumbList —
 *  and the Event one is an array. Pick by @type rather than by position. */
function parseEventLd(html: string): LdEvent | null {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      const candidate = node as LdEvent;
      const type = candidate["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (types.includes("Event")) return candidate;
    }
  }
  return null;
}

/** The `muf-*` tags are overwhelmingly *venue* identifiers (`muf-staedel`,
 *  `muf-dom`, `muf-liebieg`) rather than formats, so only the handful that name
 *  an actual format earn a label. Everything else — the great majority — falls
 *  through to the hub's classifier pass on title + description, which is what
 *  reads "Führung", "Workshop" or "Konzert" out of the copy anyway. */
const KEYWORD_LABELS: Record<string, string> = {
  "muf-familie": "museum:familie",
  "muf-familien": "museum:familie",
  "muf-film": "film:cinema",
  "muf-fotografie": "museum:ausstellung",
  "muf-foto": "museum:ausstellung",
};

function labelsFor(keywords: string | string[] | undefined): ScrapedLabel[] {
  if (!keywords) return [];
  const raw = Array.isArray(keywords) ? keywords : keywords.split(",");
  const labels: ScrapedLabel[] = [];
  const seen = new Set<string>();
  for (const keyword of raw) {
    const label = KEYWORD_LABELS[keyword.trim().toLowerCase()];
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push({ label, confidence: 0.85, classifier: "upstream-tag" });
  }
  return labels;
}

/** JSON-LD dates are local ISO with an offset ("2026-08-29T15:00:00+02:00");
 *  the wall-clock part is what the festival advertises, so read it directly
 *  rather than going through Date and back out via UTC. */
function splitIsoDateTime(value: string): { date: string; time: string | null } | null {
  const m = value.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  if (!m) return null;
  return { date: m[1], time: m[2] === "00:00" ? null : (m[2] ?? null) };
}

async function fetchText(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  return res.text();
}
