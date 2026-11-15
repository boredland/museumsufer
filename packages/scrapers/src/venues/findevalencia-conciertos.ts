import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { cleanText, fetchVlc, genreFromText, musicLabel, type VlcGenre } from "./_valencia-music";

const LIST_URL = "https://findevalencia.es/agenda/conciertos/";

interface VenueConfig {
  slug: string;
  name: string;
  /** Matches the free-text `location.name` the aggregator emits (spelling varies). */
  match: RegExp;
  lat: number;
  lon: number;
  /** Genre assumed when the title has no genre word; null means "only keep
   *  events whose title proves an in-scope genre" (arenas, mixed-programme halls). */
  fallback: VlcGenre | null;
}

/**
 * Venues deliberately absent: Palau de la Música and Les Arts (own scrapers),
 * rock/pop clubs, Roig Arena (pop arena; a title keyword like "orquesta" would
 * mislabel salsa/pop acts as classical), and jazz venues covered by jazz-valencia.
 */
const VENUES: VenueConfig[] = [
  { slug: "ateneo-mercantil-valencia", name: "Ateneo Mercantil de Valencia", match: /Ateneo Mercantil/i, lat: 39.4708, lon: -0.376, fallback: null },
  { slug: "teatro-olympia-valencia", name: "Teatro Olympia", match: /Teatro Olympia/i, lat: 39.4708, lon: -0.378, fallback: null },
  { slug: "col-legi-major-rector-peset", name: "Col·legi Major Rector Peset", match: /Rector Peset/i, lat: 39.4755, lon: -0.3796, fallback: "chamber" },
  { slug: "capella-de-la-sapiencia-valencia", name: "Capella de la Sapiència (La Nau)", match: /Capella de la Sapi[eè]ncia/i, lat: 39.4746, lon: -0.3763, fallback: "classical" },
  { slug: "muvim-valencia", name: "MuVIM", match: /^MuVIM$/i, lat: 39.4701, lon: -0.3828, fallback: "classical" },
  { slug: "jardi-botanic-auditori-valencia", name: "Auditori del Jardí Botànic", match: /Jard[ií] Bot[aà]nic/i, lat: 39.4769, lon: -0.3867, fallback: "classical" },
  { slug: "ivam-valencia", name: "IVAM", match: /IVAM/i, lat: 39.4796, lon: -0.3829, fallback: "world" },
  { slug: "caixaforum-valencia", name: "CaixaForum València", match: /CaixaForum/i, lat: 39.454, lon: -0.3496, fallback: "classical" },
];

interface ListEvent {
  name: string;
  startDate: string;
  url?: string;
  location?: { name?: string };
}

const madrid = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * findevalencia.es aggregates concerts of ~40 venues into one schema.org
 * ItemList. `startDate` is a true UTC instant, so it is converted to Madrid
 * wall-clock; midnight local means the source only knew the day.
 */
export async function scrapeFindeValenciaConciertos(): Promise<VenueScrapeResult[]> {
  const today = todayIso();
  const html = await fetchVlc(LIST_URL);
  const items = extractItems(html);
  if (items.length === 0) throw new Error("findevalencia: no ItemList in JSON-LD");

  const bySlug = new Map<string, VenueScrapeResult>();
  const seen = new Set<string>();
  for (const it of items) {
    const venue = VENUES.find((v) => v.match.test(it.location?.name ?? ""));
    if (!venue || !it.url) continue;
    const when = toMadrid(it.startDate);
    if (!when || when.date < today) continue;
    const title = cleanText(it.name).replace(/\s+en (?:el |la )?(?:València|Valencia|Roig Arena.*)$/i, "").trim();
    const genre = genreFromText(title, venue.fallback);
    if (!genre) continue;
    const id = it.url.replace(/\/$/, "").split("/").pop() ?? it.url;
    if (seen.has(`${venue.slug}|${id}`)) continue;
    seen.add(`${venue.slug}|${id}`);

    const ev: CanonicalScrapedEvent = {
      source_event_id: `${id}-${when.date}`,
      title,
      date: when.date,
      time: when.time,
      detail_url: it.url,
      language: "es",
      city: "valencia",
      lat: venue.lat,
      lon: venue.lon,
      raw_category: "concierto",
      labels: musicLabel(genre, venue.fallback === genre ? 0.7 : 0.8),
    };
    const res = bySlug.get(venue.slug) ?? { source_slug: venue.slug, display_name: venue.name, events: [] };
    res.events.push(ev);
    bySlug.set(venue.slug, res);
  }
  const out = [...bySlug.values()];
  for (const r of out) r.events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return out.sort((a, b) => a.source_slug.localeCompare(b.source_slug));
}

function toMadrid(iso: string): { date: string; time: string | null } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(madrid.formatToParts(d).map((x) => [x.type, x.value]));
  const time = `${p.hour}:${p.minute}`;
  return { date: `${p.year}-${p.month}-${p.day}`, time: time === "00:00" ? null : time };
}

function extractItems(html: string): ListEvent[] {
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const json = JSON.parse(m[1]) as { "@graph"?: { "@type"?: string; itemListElement?: { item?: ListEvent }[] }[] };
      const list = json["@graph"]?.find((n) => n["@type"] === "ItemList");
      if (list?.itemListElement) return list.itemListElement.flatMap((e) => (e.item ? [e.item] : []));
    } catch {
      // Other ld+json blocks on the page are not JSON-clean; only the ItemList matters.
    }
  }
  return [];
}
