import type { FeedbackEnv, PushEnv } from "@museumsufer/core";

export interface Env extends FeedbackEnv, PushEnv {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

/** Original-language tag of the print (not the audience-facing OmU/DF marker). */
export type Language = "de" | "en" | "fr" | "es" | "it" | "ja" | "ko" | "zh" | "ru" | "other";

/** Audience-facing version: how the audience will hear/read the film tonight. */
export type Version = "OmU" | "OmeU" | "DF" | "OV" | "stumm";

export const VERSIONS: readonly Version[] = ["OmU", "OmeU", "DF", "OV", "stumm"] as const;

export function parseVersion(value: string | undefined | null): Version | null {
  if (!value) return null;
  return (VERSIONS as readonly string[]).includes(value) ? (value as Version) : null;
}

/** Projection format. DCP is the modern default; 35mm/16mm/digital are the
 *  noteworthy departures we surface as badges. */
export type Format = "DCP" | "35mm" | "16mm" | "digital" | "70mm";

export const FORMATS: readonly Format[] = ["DCP", "35mm", "16mm", "digital", "70mm"] as const;

export interface SeriesRef {
  /** Slug derived from the canonical `film:reihe:*` label, kebab-cased. */
  slug: string;
  /** Display label as the scraper recorded it (e.g. "Nippon Connection"). */
  name: string;
}

export interface Screening {
  id: number;
  cinema_slug: string;
  /** Source-stable event id; used in detail URLs (/film/:id keys off `id`). */
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  date: string;
  time?: string;
  end_time?: string;
  image_url?: string;
  detail_url?: string;
  ticket_url?: string;
  price_min?: number;
  price_max?: number;
  /** Auditorium / hall — only set when the venue scrapes it. */
  venue_room?: string;
  /** Director, performers, Q&A guest — free-form from the scraper. */
  credits?: string;
  /** Audience-facing version markers parsed from title/description. */
  version?: Version;
  /** Original language of the print. */
  language?: Language;
  /** Projection format if non-DCP and explicitly noted. */
  format?: Format;
  /** Series this screening belongs to (Nippon Connection, Udo Kier, …). */
  series?: SeriesRef;
  /** TMDb movie id (when the hub enrichment found a match). Front-end uses
   *  it to deep-link to themoviedb.org/movie/{id} from the screening card. */
  tmdb_id?: number;
}

export interface ScrapeData {
  screenings: Screening[];
}
