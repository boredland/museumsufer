import { stripHtml, todayIso } from "@museumsufer/core";
import PQueue from "p-queue";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.museumsuferfest.de";
const SITEMAP_INDEX = `${BASE}/sitemap.xml`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const DETAIL_CONCURRENCY = 8;
const FESTIVAL_SLUG = "museumsuferfest";

/** Festival venue name → the museum's own hub slug.
 *
 *  Fanning the programme out per museum is what makes it dedupe: the
 *  museumsufer app keys both of its dedup passes on `museum_id`, resolved from
 *  `source_slug`, so festival events filed under one festival-wide slug would
 *  never be compared against the same event scraped from the museum's own site
 *  (and, since that slug is not in the museum directory, would be dropped
 *  outright).
 *
 *  Venue coordinates are the museum's festival *booth* on the riverbank, not
 *  its building, so they sit up to a few hundred metres from the museum's
 *  config coordinates — the Geldmuseum's booth is 4.7 km from its Ginnheim
 *  premises. That offset is expected and not a mismapping.
 *
 *  Stages, open-air spots and non-museum venues (`… Bühne`, Holbeinsteg,
 *  Drachenbootwettkämpfe) have no museum to belong to and stay under the
 *  festival's own slug. */
const MUSEUM_SLUG_BY_VENUE: Record<string, string> = {
  "Archäologisches Museum Frankfurt": "archaeologisches-museum-frankfurt",
  "Bibelhaus Erlebnis Museum": "bibelhaus-erlebnismuseum",
  "Caricatura Museum Frankfurt": "caricatura-museum-frankfurt",
  "DFF – Deutsches Filminstitut & Filmmuseum": "dff-deutsches-filminstitut-filmmuseum",
  "Deutsches Architekturmuseum": "deutsches-architekturmuseum",
  "Deutsches Romantik Museum": "deutsches-romantik-museum",
  "Deutsches Romantik-Museum": "deutsches-romantik-museum",
  "Dommuseum Frankfurt": "dommuseum-frankfurt",
  "Fotografie Forum Frankfurt": "fotografie-forum-frankfurt",
  "Frankfurter Goethe-Haus": "frankfurter-goethe-haus",
  "Frankfurter Kunstverein": "frankfurter-kunstverein",
  "Geldmuseum auf dem Museumsuferfest": "geldmuseum-der-deutschen-bundesbank",
  "Historisches Museum Frankfurt": "historisches-museum-frankfurt",
  "Ikonenmuseum Frankfurt": "ikonenmuseum-frankfurt",
  "Institut für Stadtgeschichte": "institut-fuer-stadtgeschichte",
  "Institut für Stadtgeschichte / Karmeliterkloster": "institut-fuer-stadtgeschichte",
  "Junges Museum Frankfurt": "junges-museum-frankfurt",
  "Jüdisches Museum Frankfurt": "juedisches-museum-frankfurt",
  "Liebieghaus Skulpturensammlung": "liebieghaus-skulpturensammlung",
  "MGGU - Museum Giersch der Goethe-Universität": "museum-giersch-der-goethe-universitaet",
  "MOMEM - Museum of Modern Electronic Music": "momem-museum-of-modern-electronic-music",
  "Museum Angewandte Kunst": "museum-angewandte-kunst",
  "Museum Judengasse": "juedisches-museum-museum-judengasse-frankfurt",
  "Museum für Kommunikation": "museum-fuer-kommunikation-frankfurt",
  "Städel Museum": "staedel-museum",
  "Struwwelpeter Museum": "struwwelpeter-museum",
  "TOWER MMK – MUSEUM MMK FÜR MODERNE KUNST": "tower-mmk-museum-mmk-fuer-moderne-kunst",
  "Weltkulturen Museum": "weltkulturen-museum",
};

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
export async function scrapeMuseumsuferfest(): Promise<VenueScrapeResult[]> {
  const urls = await fetchEventUrls();
  const today = todayIso();

  const queue = new PQueue({ concurrency: DETAIL_CONCURRENCY });
  const parsed: Array<{ slug: string; event: CanonicalScrapedEvent }> = [];
  for (const url of urls) {
    queue.add(async () => {
      const hit = await fetchEvent(url, today);
      if (hit) parsed.push(hit);
    });
  }
  await queue.onIdle();

  const bySlug = new Map<string, CanonicalScrapedEvent[]>();
  for (const { slug, event } of parsed) {
    const bucket = bySlug.get(slug);
    if (bucket) bucket.push(event);
    else bySlug.set(slug, [event]);
  }

  const results: VenueScrapeResult[] = [];
  for (const [slug, events] of bySlug) {
    events.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time ?? "").localeCompare(b.time ?? "") ||
        a.source_event_id.localeCompare(b.source_event_id),
    );
    results.push({
      source_slug: slug,
      // Only the festival's own bucket names itself; a museum's bucket must not
      // relabel that museum's venue name in the hub.
      ...(slug === FESTIVAL_SLUG ? { display_name: "Museumsuferfest" } : {}),
      events,
    });
  }
  results.sort((a, b) => a.source_slug.localeCompare(b.source_slug));
  return results;
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

async function fetchEvent(url: string, today: string): Promise<{ slug: string; event: CanonicalScrapedEvent } | null> {
  const html = await fetchText(url);
  if (!html) return null;

  const event = parseEventLd(html);
  if (!event?.name || !event.startDate) return null;

  const start = splitIsoDateTime(event.startDate);
  const end = event.endDate ? splitIsoDateTime(event.endDate) : null;
  if (!start || start.date < today) return null;

  const place = event.location?.[0];
  const venueName = place?.name?.trim() || null;
  const title = stripHtml(event.name).trim();
  const description = event.description ? stripHtml(event.description).trim() || null : null;

  const canonical: CanonicalScrapedEvent = {
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
    // Upstream pads the organizer name with a leading space.
    performers: event.organizer?.[0]?.name?.trim() || null,
    venue_room: venueName,
    city: place?.address?.addressLocality ?? null,
    lat: place?.geo?.latitude ?? null,
    lon: place?.geo?.longitude ?? null,
    labels: labelsFor(event.keywords),
  };
  return { slug: (venueName && MUSEUM_SLUG_BY_VENUE[venueName]) || FESTIVAL_SLUG, event: canonical };
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
