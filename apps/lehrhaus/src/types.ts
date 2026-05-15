import type { FeedbackEnv, PushEnv } from "@museumsufer/core";

export interface Env extends FeedbackEnv, PushEnv {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export interface LehrhausSource {
  slug: string;
  name: string;
  short_name?: string;
  url: string;
  lat?: number;
  lon?: number;
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
