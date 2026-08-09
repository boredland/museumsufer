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
  /** Ticket availability when the source advertises it; absent means unknown.
   *  Front-ends (lichtspiel.haus) surface this as a sold-out / few-left badge. */
  availability?: "sold_out" | "few_left";
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
  /** TMDb-canonical title in German. Front-ends use this in place of the
   *  cinema's listing-field title (which often carries series chrome like
   *  "Kino4Kids „Zirkuskind"" or "Spotlight: Milestones #12"). */
  title_de?: string;
  /** TMDb-canonical title in English. Picked when the visitor's locale
   *  is `en`; falls back to title_de, then to the cinema's title. */
  title_en?: string;
  /** English-language synopsis, when TMDb has one. Apps with multi-locale
   *  rendering pick this for en visitors and fall back to `description`
   *  (the German overview) otherwise. */
  description_en?: string;
  /** TMDb genre ids — fixed namespace shared across movies and TV. Front-
   *  ends own the id-to-localised-name mapping so the canonical record
   *  stays small (~3 ints per event vs ~30 chars). */
  tmdb_genre_ids?: number[];
  /** TMDb user-score, 0–10. Front-ends typically render as a percentage. */
  tmdb_vote_average?: number;
  /** TMDb vote count — used to hide low-confidence scores. */
  tmdb_vote_count?: number;
  /** IMDb id (tt…). Useful as a stable third-party pivot + for the
   *  "open on IMDb" deep-link some front-ends offer. */
  imdb_id?: string;
  /** Rotten Tomatoes critic % (0–100). From OMDb. */
  rt_critic?: number;
  /** Canonical rottentomatoes.com URL for the deep-link, when OMDb has one. */
  rt_url?: string;
  /** IMDb user rating 0–10 + vote count. From OMDb. */
  imdb_rating?: number;
  imdb_votes?: number;
  labels: Label[];
  /** Date (YYYY-MM-DD) the event was first and last confirmed by its source.
   *  Deliberately day-granular, not a full ISO timestamp: `last_seen_at` is
   *  rewritten for every event on every scrape, and at second precision that
   *  re-serialised ~89% of the bundle's lines on each of the ~150 monthly
   *  scrape commits — the dominant source of repository growth. Day
   *  granularity keeps the line byte-identical between same-day runs while
   *  still driving the STALE_TTL_DAYS cutoff, which only compares dates. */
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
