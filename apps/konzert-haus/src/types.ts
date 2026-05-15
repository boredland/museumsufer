import type { FeedbackEnv, PushEnv } from "@museumsufer/core";

export interface Env extends FeedbackEnv, PushEnv {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export type Genre = "classical" | "jazz" | "sacred" | "world" | "experimental" | "chamber";

export const GENRES: readonly Genre[] = ["classical", "jazz", "sacred", "world", "experimental", "chamber"] as const;

export function parseGenre(value: string | undefined | null): Genre | null {
  if (!value) return null;
  return (GENRES as readonly string[]).includes(value) ? (value as Genre) : null;
}

export type ScraperName =
  | "alte-oper"
  | "oper"
  | "dr-hochs"
  | "hfmdk"
  | "ensemble-modern"
  | "hr-sinfonieorchester"
  | "hr-bigband"
  | "holzhausenschloesschen"
  | "jazz-frankfurt"
  | "jazz-palmengarten"
  | "brotfabrik"
  | "romanfabrik"
  | "andreas-koehs"
  | "kirchenmusik-dreikoenig"
  | "stk-musik"
  | "kronberg-academy"
  | "rheingau-festival"
  | "bad-homburg-schloss"
  | "bad-soden"
  | "evangelische-akademie"
  | "denkbar"
  | "naxos"
  | "waggong"
  | "musikschule-frankfurt";

export interface Event {
  id: number;
  venue_slug: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  date: string;
  time?: string;
  end_time?: string;
  genre: Genre;
  image_url?: string;
  detail_url?: string;
  ticket_url?: string;
  price_min?: number;
  price_max?: number;
  venue_room?: string;
  performers?: string;
}

export interface ScrapedEvent {
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  date: string;
  time?: string | null;
  end_time?: string | null;
  genre?: Genre | null;
  image_url?: string | null;
  detail_url?: string | null;
  ticket_url?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  venue_room?: string | null;
  performers?: string | null;
}

export interface ScrapeResult {
  venue_slug: string;
  events: ScrapedEvent[];
}

export interface ScrapeData {
  events: Event[];
}
