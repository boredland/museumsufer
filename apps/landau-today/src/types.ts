// biome-ignore lint/complexity/noBannedTypes: empty Env shape — no D1 / no secrets bound to the worker. Reserve for future bindings.
export type Env = {};

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
}

export interface ScrapeData {
  events: Event[];
  generatedAt: string;
}
