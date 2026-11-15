import { slugify, todayIso, truncate } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { cleanText, fetchVlc, mapPool, musicLabel } from "./_valencia-music";

const BASE = "https://www.jazzvalencia.com";
const MAX_SITEMAPS = 8;

/** Hand-looked-up coordinates (Nominatim, once) for the Valencia-city venues
 *  jazzvalencia.com lists, keyed by slugified venue name. An event whose venue
 *  is not listed is dropped rather than pinned to a guessed spot. */
const VENUES: Record<string, { name: string; lat: number; lon: number }> = {
  loom: { name: "LOOM", lat: 39.4611, lon: -0.3676 },
  "la-vitti": { name: "La Vitti", lat: 39.4757, lon: -0.3508 },
  "cim-benimaclet": { name: "CIM Benimaclet", lat: 39.4853, lon: -0.3603 },
  "la-rambleta": { name: "La Rambleta", lat: 39.4474, lon: -0.3925 },
  "jimmy-glass-jazz-bar": { name: "Jimmy Glass Jazz Bar", lat: 39.4776, lon: -0.3793 },
  "cafe-mercedes": { name: "Café Mercedes", lat: 39.4621, lon: -0.3754 },
  "burning-house": { name: "Burning House", lat: 39.472, lon: -0.3257 },
  "ca-revolta": { name: "Ca Revolta", lat: 39.4748, lon: -0.3811 },
  "auditorio-de-la-unio-de-tres-forques": { name: "Auditorio de la Unió de Tres Forques", lat: 39.4658, lon: -0.3981 },
};
const CITY_RE = /^(val[eè]ncia)$/i;

interface SchemaEvent {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  image?: string;
  offers?: { price?: string };
  location?: { name?: string; address?: { addressLocality?: string } };
}

/**
 * jazzvalencia.com is a regional jazz agenda (EventON on WordPress). Its
 * sitemap lists every event URL with the date embedded in the slug; the slug
 * date is only a hint (promoters re-date posts), so the schema.org MusicEvent
 * block on each detail page is authoritative. Events outside Valencia city
 * (Alcoy, Elche, La Pobla de Vallbona…) are dropped.
 */
export async function scrapeJazzValencia(): Promise<VenueScrapeResult[]> {
  const today = todayIso();
  const urls: string[] = [];
  for (let n = 1; n <= MAX_SITEMAPS; n++) {
    let xml: string;
    try {
      xml = await fetchVlc(`${BASE}/ajde_events-sitemap${n}.xml`, "application/xml");
    } catch {
      break;
    }
    for (const m of xml.matchAll(/<loc>([^<]+\/evento\/[^<]+)<\/loc>/g)) {
      const slugDate = m[1].match(/-(\d{4}-\d{2}-\d{2})-/)?.[1];
      if (slugDate && slugDate >= today) urls.push(m[1]);
    }
  }

  let failed = 0;
  const parsed = await mapPool(urls, 6, async (url) => {
    try {
      return parseDetail(url, await fetchVlc(url), today);
    } catch {
      failed++;
      return null;
    }
  });
  if (urls.length > 0 && failed > urls.length / 2) throw new Error(`jazz-valencia: ${failed}/${urls.length} detail fetches failed`);

  const bySlug = new Map<string, VenueScrapeResult>();
  const seen = new Set<string>();
  for (const item of parsed) {
    const venue = item ? VENUES[slugify(item.venue)] : undefined;
    if (!item || !venue || seen.has(item.event.source_event_id)) continue;
    seen.add(item.event.source_event_id);
    item.event.lat = venue.lat;
    item.event.lon = venue.lon;
    const slug = `jazz-valencia-${slugify(item.venue)}`;
    const res = bySlug.get(slug) ?? { source_slug: slug, display_name: venue.name, events: [] };
    res.events.push(item.event);
    bySlug.set(slug, res);
  }
  const out = [...bySlug.values()];
  for (const r of out) r.events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return out.sort((a, b) => a.source_slug.localeCompare(b.source_slug));
}

function parseDetail(url: string, html: string, today: string): { venue: string; event: CanonicalScrapedEvent } | null {
  const ev = findEvent(html);
  const start = ev?.startDate?.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  const venue = ev?.location?.name?.trim();
  if (!ev?.name || !start || start[1] < today || !venue) return null;
  if (!CITY_RE.test(ev.location?.address?.addressLocality?.trim() ?? "")) return null;

  const price = Number.parseFloat(ev.offers?.price ?? "");
  // EventON fills endDate with 23:50/23:59 when the promoter gives none, and
  // post-midnight ends ("01:50") sort before the start; neither is a real end.
  const endTime = ev.endDate?.match(/T(\d{2}:\d{2})/)?.[1];
  const realEnd = endTime && start[2] && endTime > start[2] && !/^23:(50|59)$/.test(endTime) ? endTime : null;
  const description = ev.description ? truncate(cleanText(ev.description).replace(/https?:\/\/\S+/g, "").trim(), 600) : null;
  return {
    venue,
    event: {
      source_event_id: url.replace(/\/$/, "").split("/").pop() ?? url,
      title: cleanText(ev.name),
      description,
      date: start[1],
      time: start[2] ?? null,
      end_time: realEnd,
      detail_url: url,
      image_url: ev.image ?? null,
      language: "es",
      price_min: price > 0 ? price : null,
      price_max: price > 0 ? price : null,
      venue_room: venue,
      city: "valencia",
      lat: null,
      lon: null,
      raw_category: "jazz",
      labels: musicLabel("jazz", 0.9),
    },
  };
}

function findEvent(html: string): SchemaEvent | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const json = JSON.parse(m[1]) as { "@graph"?: Record<string, unknown>[] } & Record<string, unknown>;
      const hit = (json["@graph"] ?? [json]).find((n) => /Event/.test(JSON.stringify(n["@type"])));
      if (hit) return hit as SchemaEvent;
    } catch {
      // Non-JSON ld+json blocks (plugin noise) are skipped.
    }
  }
  return null;
}
