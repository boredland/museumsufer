export interface Env {
  DB: D1Database;
  AI: Ai;
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
}

export interface Event {
  id: number;
  museum_id: number;
  title: string;
  date: string;
  time: string | null;
  description: string | null;
  url: string | null;
  detail_url: string | null;
  image_url: string | null;
  price: string | null;
  museum_name?: string;
}