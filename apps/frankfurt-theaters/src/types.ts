export interface Env {
  DB: D1Database;
  AI: Ai;
  SCRAPE_SECRET?: string;
  DEEPL_API_KEY?: string;
}

export type AvailabilityStatus = "unknown" | "available" | "few_left" | "sold_out" | "cancelled";

export type TicketingProvider = "eventim_inhouse" | "frankfurt_ticket" | "reservix" | "wordpress" | "custom" | null;

export interface Theater {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  website_url: string | null;
  ticketing_provider: TicketingProvider;
  description: string | null;
  image_url: string | null;
}

export interface Show {
  id: number;
  theater_id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  language: string | null;
  age_recommendation: string | null;
  image_url: string | null;
  detail_url: string | null;
  season: string | null;
}

export interface Performance {
  id: number;
  show_id: number;
  date: string;
  time: string | null;
  end_time: string | null;
  end_date: string | null;
  venue_room: string | null;
  provider_event_id: string | null;
  ticket_url: string | null;
  status: AvailabilityStatus;
  available_seats: number | null;
  total_seats: number | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  availability_checked_at: string | null;
}

export interface ScrapedShow {
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  language?: string | null;
  age_recommendation?: string | null;
  image_url?: string | null;
  detail_url?: string | null;
  season?: string | null;
}

export interface ScrapedPerformance {
  show_slug: string;
  date: string;
  time: string | null;
  end_time?: string | null;
  end_date?: string | null;
  venue_room?: string | null;
  provider_event_id?: string | null;
  ticket_url?: string | null;
  status?: AvailabilityStatus;
  price_min?: number | null;
  price_max?: number | null;
}

export interface ScrapeResult {
  theater_slug: string;
  shows: ScrapedShow[];
  performances: ScrapedPerformance[];
}
