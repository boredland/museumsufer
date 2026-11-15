import { slugify, todayIso, truncate } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { cleanText, fetchVlc, mapPool, musicLabel } from "./_valencia-music";

const BASE = "https://www.jazzvalencia.com";
const MAX_SITEMAPS = 8;

/** Hand-looked-up coordinates for venues jazzvalencia.com lists inside the
 *  city. Venues not listed here still emit, pooled under `jazz-valencia`
 *  without coordinates, rather than getting a guessed pin. */
const VENUES: Record<string, { lat: number; lon: number }> = {
  LOOM: { lat: 39.4611, lon: -0.3676 },
  "La Vitti": { lat: 39.4758, lon: -0.3508 },
  "CIM Benimaclet": { lat: 39.4853, lon: -0.3603 },
  "La Rambleta": { lat: 39.4474, lon: -0.3925 },
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

  const parsed = await mapPool(urls, 6, async (url) => {
    try {
      return parseDetail(url, await fetchVlc(url), today);
    } catch {
      return null;
    }
  });

  const bySlug = new Map<string, VenueScrapeResult>();
  const seen = new Set<string>();
  for (const item of parsed) {
    if (!item || seen.has(item.event.source_event_id)) continue;
    seen.add(item.event.source_event_id);
    const known = item.venue in VENUES;
    const slug = known ? `jazz-valencia-${slugify(item.venue)}` : "jazz-valencia";
    const res = bySlug.get(slug) ?? {
      source_slug: slug,
      display_name: known ? item.venue : "Jazz Valencia",
      events: [],
    };
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
  const coords = VENUES[venue];
  const description = ev.description ? truncate(cleanText(ev.description).replace(/https?:\/\/\S+/g, "").trim(), 600) : null;
  return {
    venue,
    event: {
      source_event_id: url.replace(/\/$/, "").split("/").pop() ?? url,
      title: cleanText(ev.name),
      description,
      date: start[1],
      time: start[2] ?? null,
      end_time: ev.endDate?.match(/T(\d{2}:\d{2})/)?.[1] ?? null,
      detail_url: url,
      image_url: ev.image ?? null,
      language: "es",
      price_min: price > 0 ? price : null,
      price_max: price > 0 ? price : null,
      venue_room: venue,
      city: "valencia",
      lat: coords?.lat ?? null,
      lon: coords?.lon ?? null,
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
