/**
 * The canonical scraped-event shape returned by hub scrapers. Each scraper
 * emits zero or more of these per upstream item; downstream classification
 * adds labels (the source-signal pass) before persisting to the hub store.
 */
export interface CanonicalScrapedEvent {
  /** Stable upstream id when available; otherwise derived from detail_url. */
  source_event_id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  date: string;
  time?: string | null;
  /** End date for multi-day events (Ausstellungen, festivals); ISO YYYY-MM-DD.
   *  Absent for single-day events. */
  end_date?: string | null;
  end_time?: string | null;
  detail_url?: string | null;
  ticket_url?: string | null;
  image_url?: string | null;
  /** ISO 639-1 code; absent means German (the Frankfurt default). */
  language?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  performers?: string | null;
  venue_room?: string | null;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  /** Upstream category tag verbatim, preserved so re-classification stays cheap. */
  raw_category?: string | null;
  /** Labels the scraper can justify with high confidence (URL slug, upstream tag).
   *  The hub's classifier pass adds more from title/description heuristics. */
  labels: ScrapedLabel[];
}

export interface ScrapedLabel {
  label: string;
  confidence: number;
  classifier: ClassifierName;
}

export type ClassifierName =
  | "url-slug"
  | "upstream-tag"
  | "upstream-category"
  | "scraper-hardcoded"
  | "keyword:event"
  | "keyword:music"
  | "keyword:talk"
  | "keyword:landau";

export interface VenueScrapeResult {
  source_slug: string;
  /** Editorial display name (e.g., "Senckenberg Naturmuseum"). The runner
   *  collects these into the hub's venue-names map so apps can render
   *  human-readable labels for each source slug. When unset, consumers
   *  fall back to a titleized slug — used for brand-new venues that
   *  haven't been curated yet. */
  display_name?: string;
  events: CanonicalScrapedEvent[];
}

import type { ProxyConfig } from "./proxy";

/** Per-run context handed to each scraper. `proxy` is set only when the
 *  caller has FETCH_PROXY_* configured; most scrapers ignore it. */
export interface ScraperContext {
  proxy: ProxyConfig | null;
}

/**
 * Most scrapers return a single VenueScrapeResult. The museum orchestrator
 * is the exception: one entry that fans out to ~27 results, one per museum.
 * The runner normalises both shapes via Array.isArray.
 */
export type VenueScraper = (ctx: ScraperContext) => Promise<VenueScrapeResult | VenueScrapeResult[]>;
