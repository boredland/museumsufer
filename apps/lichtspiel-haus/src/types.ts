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

/** Strip a trailing version marker the cinema baked into its listing title
 *  ("KOKUHO (OmeU)", "EXTRAWURST (DF)"). That information lives in the
 *  `version` badge already, so we only show it once. Only a known marker is
 *  removed — never a title that merely ends in parentheses ("The Party (DF)"
 *  loses the chrome but "(500) Days of Summer" is untouched). */
export function stripVersionChrome(title: string): string {
  return title.replace(/\s*\((?:Om[a-zäöü]*U|OV|DF|stumm)\)\s*$/i, "").trim();
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
  /** English-language synopsis from TMDb. Picked by the front-end when the
   *  visitor's locale is `en`; otherwise the German `description` wins. */
  description_en?: string;
  /** TMDb-canonical German title — preferred over `title` for display
   *  when present, since the cinema's listing often carries series
   *  chrome ("Kino4Kids „Zirkuskind"" → just "Zirkuskind"). */
  title_de?: string;
  /** TMDb-canonical English title. Used when locale === en. */
  title_en?: string;
  /** TMDb genre ids — front-end resolves to localised pills via tmdb-genres.ts. */
  tmdb_genre_ids?: number[];
  /** TMDb user-score (0–10) + vote count — front-end renders the average
   *  as a percentage when the count clears a confidence threshold. */
  tmdb_vote_average?: number;
  tmdb_vote_count?: number;
  /** IMDb id (tt…). Used for the "open on IMDb" deep link + as the OMDb
   *  pivot the hub already resolved at scrape time. */
  imdb_id?: string;
  /** Rotten Tomatoes critic % (0–100). From OMDb. */
  rt_critic?: number;
  /** Canonical rottentomatoes.com URL for the deep-link, when present. */
  rt_url?: string;
  /** IMDb user rating 0–10 + vote count. From OMDb. */
  imdb_rating?: number;
  imdb_votes?: number;
  /** Audience-facing version markers parsed from title/description. */
  version?: Version;
  /** Original language of the print. */
  language?: Language;
  /** Projection format if non-DCP and explicitly noted. */
  format?: Format;
  /** Series this screening belongs to (Nippon Connection, Udo Kier, …). */
  series?: SeriesRef;
  /** Ticket availability when the cinema advertises it; absent means unknown
   *  (the common case — most sources don't expose real-time availability). */
  availability?: "sold_out" | "few_left";
  /** Stable per-film identifier the "mark seen" feature uses. Prefer the
   *  TMDb id (`tmdb:1234`) so a film hides across every date + cinema in
   *  one click; falls back to a slug of the normalised title for screenings
   *  without a TMDb match (those at least hide per repeated venue listing). */
  seen_key?: string;
  /** TMDb id (when the hub enrichment found a match). Front-end uses it
   *  to deep-link to themoviedb.org/{tmdb_kind}/{tmdb_id} from the
   *  screening card. */
  tmdb_id?: number;
  /** "movie" or "tv" — TV match catches MET Opera HD broadcasts and
   *  similar stage-show recordings indexed under TMDb's TV side. */
  tmdb_kind?: "movie" | "tv";
}

export interface ScrapeData {
  screenings: Screening[];
  /** Cities this vertical currently has data for, in display order. */
  supportedCities: string[];
}
