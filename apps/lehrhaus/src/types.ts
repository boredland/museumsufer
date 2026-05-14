export interface LehrhausSource {
  slug: string;
  name: string;
  short_name?: string;
  url: string;
  lat?: number;
  lon?: number;
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
  category: "Vortrag" | "Diskussion";
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
  category: "Vortrag" | "Diskussion";
  language?: string | null;
  image_url?: string | null;
}
