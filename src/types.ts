export interface Env {
  DB: D1Database;
  AI: Ai;
  SCRAPE_SECRET?: string;
  DEEPL_API_KEY?: string;
}

export interface MuseumInfo {
  name: string;
  website: string | null;
}

export interface Museum {
  id: number;
  name: string;
  slug: string;
  museumsufer_url: string;
  website_url: string | null;
  opening_hours: string | null;
}

export interface Exhibition {
  id: number;
  museum_id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  image_url: string | null;
  detail_url: string | null;
  museum_name?: string;
  museum_slug?: string;
}

export interface Event {
  id: number;
  museum_id: number;
  title: string;
  date: string;
  time: string | null;
  end_time: string | null;
  end_date: string | null;
  description: string | null;
  url: string | null;
  detail_url: string | null;
  image_url: string | null;
  price: string | null;
  museum_name?: string;
  museum_slug?: string;
}
