import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * ztix.de is a Next.js (app-router) ticketing SPA used across the Darmstadt
 * cluster (Centralstation, Theater Moller Haus, TIP, IMD/Ferienkurse). Its
 * organizer listing (`/<org>/events`) is client-rendered with no event slugs
 * in the served HTML, but every event *detail* page is server-rendered with a
 * complete Schema.org `Event` JSON-LD block (name / startDate / endDate /
 * image / description / offers).
 *
 * So the listing comes from each venue's OWN server-rendered site (which embeds
 * `ztix.de/<org>/events/<slug>` booking links); we collect those slugs, then
 * fan out one fetch per detail page and parse its JSON-LD. Deterministic given
 * identical upstream: slugs are de-duped + sorted and events sorted by
 * date/time/id.
 */

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const JSON_LD_RE = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;

export interface ZtixVenueOptions {
  /** ztix organizer slug, e.g. "centralstation". */
  org: string;
  /** Venue-owned, server-rendered pages that embed ztix event links. */
  listingUrls: string[];
  source_slug: string;
  display_name: string;
  /** Declarative CitySlug — ztix omits a usable geo, all shows are at the venue. */
  city: string;
  lat: number;
  lon: number;
  /** Fixed labels for single-genre venues. When unset, labels are resolved
   *  per event via the shared stage/music/talk classifier. */
  labels?: ScrapedLabel[];
  /** Fallback label when no keyword fires — `"stage:theater"` for theaters
   *  (the default), `"music:classical"` for concert halls. */
  defaultLabel?: string;
}

interface ZtixEventLd {
  startDate?: string;
  endDate?: string;
  name?: string;
  description?: string;
  image?: string | string[];
  offers?: unknown;
  url?: string;
}

export async function scrapeZtixVenue(opts: ZtixVenueOptions): Promise<VenueScrapeResult> {
  const slugs = await collectSlugs(opts.org, opts.listingUrls);
  const today = todayIso();
  const detailBase = `https://www.ztix.de/${opts.org}/events/`;

  const settled = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const r = await fetch(detailBase + slug, { headers: { "User-Agent": UA } });
        if (!r.ok) return null;
        return { slug, ld: extractEventLd(await r.text()) };
      } catch {
        return null;
      }
    }),
  );

  const events: CanonicalScrapedEvent[] = [];
  for (const item of settled) {
    if (!item?.ld?.startDate) continue;
    const [date, timeFull] = item.ld.startDate.split("T");
    if (!date || date < today) continue;
    const time = timeFull ? timeFull.slice(0, 5) : null;
    const endTime = item.ld.endDate?.includes("T") ? item.ld.endDate.split("T")[1].slice(0, 5) : null;

    const title = (item.ld.name ?? "").replace(/\s+/g, " ").trim();
    if (!title) continue;
    const description = item.ld.description ? stripHtml(item.ld.description).replace(/\s+/g, " ").trim() : null;

    events.push({
      source_event_id: item.slug,
      title,
      description: description || null,
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      detail_url: item.ld.url ?? detailBase + item.slug,
      ticket_url: detailBase + item.slug,
      image_url: pickImage(item.ld.image),
      price_min: pickPrice(item.ld.offers),
      city: opts.city,
      lat: opts.lat,
      lon: opts.lon,
      labels:
        opts.labels ??
        resolveStageLabels({
          title,
          hint: description,
          defaultLabel: opts.defaultLabel ?? "stage:theater",
          classifier: "scraper-hardcoded",
          confidence: 0.75,
        }),
    });
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return { source_slug: opts.source_slug, display_name: opts.display_name, events };
}

async function collectSlugs(org: string, urls: string[]): Promise<string[]> {
  const re = new RegExp(`ztix\\.de/(?:[a-z]{2}/)?${org}/events/([A-Za-z0-9-]+)`, "g");
  const set = new Set<string>();
  await Promise.all(
    urls.map(async (u) => {
      try {
        const r = await fetch(u, { headers: { "User-Agent": UA } });
        if (!r.ok) return;
        const html = await r.text();
        for (const m of html.matchAll(re)) set.add(m[1]);
      } catch {}
    }),
  );
  return [...set].sort();
}

function extractEventLd(html: string): ZtixEventLd | null {
  for (const m of html.matchAll(JSON_LD_RE)) {
    try {
      const parsed: unknown = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === "object" && "@type" in item && item["@type"] === "Event") {
          return item;
        }
      }
    } catch {}
  }
  return null;
}

function pickImage(image: string | string[] | undefined): string | null {
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image.find((v) => typeof v === "string");
    return first ?? null;
  }
  return null;
}

function pickPrice(offers: unknown): number | null {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  let min: number | null = null;
  for (const o of list) {
    if (!o || typeof o !== "object") continue;
    const raw = "lowPrice" in o ? o.lowPrice : "price" in o ? o.price : undefined;
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseFloat(raw.replace(",", ".")) : NaN;
    if (Number.isFinite(n) && (min === null || n < min)) min = n;
  }
  return min;
}
