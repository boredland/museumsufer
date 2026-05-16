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

export interface ScrapeData {
  events: Event[];
}
