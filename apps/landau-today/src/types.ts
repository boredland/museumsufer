import type { FeedbackEnv } from "@museumsufer/core";

export interface Env extends FeedbackEnv {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export type EventSource =
  | "kulturnetz"
  | "landau-de"
  | "hambacher-schloss"
  | "rptu-campuskultur"
  | "suew"
  | "pfalz-de"
  | "stiftskirche";

/**
 * A single event in Landau. Multi-day events (Ausstellung, Festival) are
 * the same shape with `end_date` set. `category` is one of the unified
 * slugs from `./categories.ts`. `source_uid` is the upstream stable ID
 * (Kulturnetz slug or landau.de FID) used for dedup across runs.
 */
export interface Event {
  id: number;
  source: EventSource;
  source_uid: string;
  title: string;
  date: string;
  time?: string;
  end_date?: string;
  end_time?: string;
  category: string;
  venue?: string;
  /** City / village name. Used in the meta line so the user can tell
   *  Landau-proper events apart from outlying SÜW villages at a glance. */
  city?: string;
  organizer?: string;
  description?: string;
  detail_url: string;
  image_url?: string;
  price?: string;
  /** Editorial highlight from upstream (e.g., Kulturnetz "Tipp"). */
  featured?: boolean;
  /** Venue coordinates — set by the scrape-time geocoder when the
   *  (venue, city) pair resolves against Nominatim. Used client-side for
   *  the "in der Nähe" sort. Optional — events whose venue can't be
   *  geocoded sort to the bottom when distance-sort is active. */
  lat?: number;
  lng?: number;
}

export interface ScrapeData {
  events: Event[];
  generatedAt: string;
}
