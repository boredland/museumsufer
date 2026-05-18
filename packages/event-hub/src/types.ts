/**
 * Canonical event record persisted to the hub's data/events.ts. Apps
 * import this slice at build time and filter by label to populate their
 * own scrape-data.ts.
 */
export interface CanonicalEvent {
  /** FNV-1a hash of `source_slug|source_event_id` — stable across runs. */
  id: string;
  source_slug: string;
  source_event_id: string;
  title: string;
  subtitle?: string;
  description?: string;
  date: string;
  time?: string;
  /** End date for multi-day events (Ausstellungen, festivals); ISO YYYY-MM-DD.
   *  Absent for single-day events. */
  end_date?: string;
  end_time?: string;
  detail_url?: string;
  ticket_url?: string;
  image_url?: string;
  language?: string;
  price_min?: number;
  price_max?: number;
  performers?: string;
  venue_room?: string;
  city?: string;
  /** Canonical coordinates used for the hub's bbox geofence and downstream
   *  distance sorts. Auto-filled by the runner from VENUE_COORDS / MUSEUMS
   *  config when the scraper doesn't emit per-event coordinates. */
  lat: number;
  lon: number;
  raw_category?: string;
  /** Set by the post-scrape TMDb enrichment pass for film:cinema events.
   *  Front-ends use it to link out to themoviedb.org/{kind}/{id} from the
   *  screening card. Image_url and description are also auto-populated
   *  from TMDb when the scraper didn't carry them (or when TMDb has
   *  better copy). */
  tmdb_id?: number;
  /** "movie" by default; "tv" when a TV-search fallback caught e.g.
   *  Metropolitan Opera HD broadcasts. Determines the deep-link path
   *  prefix (/movie vs /tv) on themoviedb.org. */
  tmdb_kind?: "movie" | "tv";
  /** English-language synopsis, when TMDb has one. Apps with multi-locale
   *  rendering pick this for en visitors and fall back to `description`
   *  (the German overview) otherwise. */
  description_en?: string;
  labels: Label[];
  first_seen_at: string;
  last_seen_at: string;
}

export interface Label {
  label: string;
  confidence: number;
  classifier: string;
}

export interface EventHubData {
  events: CanonicalEvent[];
  /** Editorial display names keyed by source_slug. Aggregated by the
   *  runner from each VenueScrapeResult.display_name. Apps read this
   *  to render human-readable venue labels. */
  venueNames?: Record<string, string>;
}
