import type { FeedbackEnv, PushEnv } from "@museumsufer/core";

export interface Env extends FeedbackEnv, PushEnv {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export type AppEnv = { Bindings: Env; Variables: { city: string } };

export interface LehrhausSource {
  slug: string;
  name: string;
  short_name?: string;
  url: string;
  lat?: number;
  lon?: number;
  /** Wikidata Q-id (without the "Q" prefix). Surfaced as schema.org
   *  `sameAs` for entity disambiguation. Populated only for sources
   *  with a known Wikidata entry. */
  wikidata?: string;
  /** 40-80 word editorial blurb shown on /quelle/:slug above the
   *  event list. Lifts thin pages above the 500-word floor and
   *  populates the Organization.description schema field. */
  description?: string;
  /** Public phone number, when listed. NAP signal for local pack. */
  telephone?: string;
  /** "<street>, <PLZ> <city>" -- parsed into a PostalAddress at
   *  render time. Same pattern as theater-config + concert-config. */
  address?: string;
}

export type Category = "Vortrag" | "Diskussion" | "Lesung";

export const CATEGORIES: readonly Category[] = ["Vortrag", "Diskussion", "Lesung"] as const;

export function parseCategory(value: string | undefined | null): Category | null {
  if (!value) return null;
  return (CATEGORIES as readonly string[]).includes(value) ? (value as Category) : null;
}

export interface LehrhausEvent {
  id: number;
  source_slug: string;
  source_name: string;
  title: string;
  date: string;
  time?: string;
  end_time?: string;
  description?: string;
  detail_url?: string;
  ticket_url?: string;
  category: Category;
  /** ISO 639-1 language code. Absent means German (the Frankfurt default). */
  language?: string;
  image_url?: string;
  city: string;
}

export interface ScrapeData {
  sources: LehrhausSource[];
  events: LehrhausEvent[];
}

export interface ScrapedEvent {
  title: string;
  date: string;
  time?: string | null;
  end_time?: string | null;
  description?: string | null;
  detail_url?: string | null;
  ticket_url?: string | null;
  category: Category;
  language?: string | null;
  image_url?: string | null;
}
