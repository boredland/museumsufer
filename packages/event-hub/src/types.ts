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
  lat?: number;
  lon?: number;
  raw_category?: string;
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
}
