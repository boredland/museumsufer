import { MuseumApiConfig } from "./museum-apis";

export interface ApiEvent {
  title: string;
  date: string;
  time: string | null;
  description: string | null;
  detail_url: string | null;
  image_url: string | null;
  price: string | null;
}

export async function fetchEventsFromApi(config: MuseumApiConfig): Promise<ApiEvent[]> {
  switch (config.type) {
    case "tribe-events":
      return fetchTribeEvents(config.endpoint);
    case "historisches":
      return fetchHistorisches(config.endpoint);
    case "juedisches":
      return fetchJuedisches(config.endpoint);
    case "staedel":
      return fetchStaedel(config.endpoint);
    case "schirn":
      return fetchSchirn(config.endpoint);
    case "wp-events":
      return fetchWpEvents(config.endpoint);
  }
}

async function fetchTribeEvents(endpoint: string): Promise<ApiEvent[]> {
  const today = todayIso();
  const url = `${endpoint}?per_page=50&start_date=${today}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as { events?: TribeEvent[] };
  if (!data.events) return [];

  return data.events.map((ev): ApiEvent => ({
    title: stripHtml(ev.title || ""),
    date: ev.start_date?.slice(0, 10) || "",
    time: ev.start_date?.slice(11, 16) || null,
    description: stripHtml(ev.excerpt || ev.description || "").slice(0, 300) || null,
    detail_url: ev.url || null,
    image_url: ev.image?.url || null,
    price: ev.cost || null,
  })).filter(ev => ev.title && ev.date);
}

interface TribeEvent {
  title?: string;
  start_date?: string;
  end_date?: string;
  url?: string;
  description?: string;
  excerpt?: string;
  cost?: string;
  image?: { url?: string };
}

async function fetchHistorisches(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const data = await res.json() as HistorischesEvent[];
  if (!Array.isArray(data)) return [];

  return data.flatMap((ev): ApiEvent[] => {
    if (!ev.title || !ev.dateStart) return [];
    const start = new Date(ev.dateStart * 1000);
    const date = start.toISOString().slice(0, 10);
    if (date < todayIso()) return [];

    const timeMatch = ev.time?.match(/(\d{1,2}:\d{2})/);

    let price: string | null = null;
    if (ev.isFree) price = "Eintritt frei";
    else {
      const priceMatch = ev.summary?.match(/(\d+[.,]?\d*\s*€[^,]*(?:,\s*\d+[.,]?\d*\s*€[^,]*)?)/);
      if (priceMatch) price = priceMatch[1];
    }

    return [{
      title: ev.title,
      date,
      time: timeMatch?.[1] || null,
      description: stripHtml(ev.summary || "").slice(0, 300) || null,
      detail_url: ev.url || null,
      image_url: ev.image || null,
      price,
    }];
  });
}

interface HistorischesEvent {
  title?: string;
  dateStart?: number;
  dateEnd?: number;
  time?: string;
  summary?: string;
  body?: string;
  url?: string;
  image?: string;
  isFree?: boolean;
}

async function fetchJuedisches(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const wrapper = await res.json() as { data?: JuedischesEvent[] } | JuedischesEvent[];
  const data = Array.isArray(wrapper) ? wrapper : wrapper.data || [];

  return data.flatMap((item): ApiEvent[] => {
    const ev = item.data || item;
    if (!ev.headline || !ev.dateTime) return [];
    const start = new Date(ev.dateTime * 1000);
    const date = start.toISOString().slice(0, 10);
    if (date < todayIso()) return [];

    const hours = start.getUTCHours().toString().padStart(2, "0");
    const mins = start.getUTCMinutes().toString().padStart(2, "0");
    const time = `${hours}:${mins}`;

    let imageUrl: string | null = null;
    if (ev.image?.src) {
      imageUrl = ev.image.src.startsWith("http")
        ? ev.image.src
        : `https://www.juedischesmuseum.de${ev.image.src}`;
    }

    return [{
      title: ev.headline,
      date,
      time: time !== "00:00" ? time : null,
      description: stripHtml(ev.copy || ev.subline || "").slice(0, 300) || null,
      detail_url: ev.detailPageLink?.href || null,
      image_url: imageUrl,
      price: null,
    }];
  });
}

interface JuedischesEvent {
  data?: JuedischesEventData;
  headline?: string;
  dateTime?: number;
  subline?: string;
  copy?: string;
  image?: { src?: string };
  detailPageLink?: { href?: string };
}

type JuedischesEventData = Omit<JuedischesEvent, "data">;

async function fetchStaedel(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const data = await res.json() as { events?: StaedelEvent[]; aliases?: Record<string, string> };
  if (!data.events) return [];

  const webBase = data.aliases?.["@web"] || "https://www.staedelmuseum.de";
  const imgBase = data.aliases?.["@images"] || "https://www.staedelmuseum.de";

  return data.events.flatMap((ev): ApiEvent[] => {
    if (!ev.start) return [];
    const date = ev.start.slice(0, 10);
    if (date < todayIso()) return [];
    const time = ev.start.slice(11, 16);

    let url = ev.url || null;
    if (url?.startsWith("@web")) url = url.replace("@web", webBase);

    let thumb = ev.thumbnail || null;
    if (thumb?.startsWith("@images")) thumb = thumb.replace("@images", imgBase);

    return [{
      title: ev.title || ev.description || "",
      date,
      time: time !== "00:00" ? time : null,
      description: ev.description?.slice(0, 300) || null,
      detail_url: url,
      image_url: thumb,
      price: null,
    }];
  }).filter(ev => ev.title);
}

interface StaedelEvent {
  id?: number;
  title?: string;
  description?: string;
  start?: string;
  end?: string;
  url?: string;
  thumbnail?: string;
  status?: string;
}

async function fetchSchirn(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const posts = await res.json() as SchirnOffer[];
  if (!Array.isArray(posts)) return [];

  const events: ApiEvent[] = [];

  for (const post of posts) {
    const eventData = post.meta?.ho_event_data;
    if (!eventData || !Array.isArray(eventData)) continue;

    for (const ed of eventData) {
      if (!ed.date) continue;
      const date = ed.date;
      if (date < todayIso()) continue;

      events.push({
        title: stripHtml(post.title?.rendered || ""),
        date,
        time: ed.startTime || null,
        description: stripHtml(post.excerpt?.rendered || "").slice(0, 300) || null,
        detail_url: post.link || null,
        image_url: null,
        price: null,
      });
    }
  }

  return events;
}

interface SchirnOffer {
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  link?: string;
  meta?: {
    ho_event_data?: Array<{
      date?: string;
      startTime?: string;
      endTime?: string;
    }>;
  };
}

async function fetchWpEvents(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Museumsufer/1.0)" },
  });
  if (!res.ok) return [];
  const posts = await res.json() as WpEvent[];
  if (!Array.isArray(posts)) return [];

  return posts.flatMap((post): ApiEvent[] => {
    const date = post.date?.slice(0, 10);
    if (!date || date < todayIso()) return [];

    return [{
      title: stripHtml(post.title?.rendered || ""),
      date,
      time: post.date?.slice(11, 16) || null,
      description: stripHtml(post.excerpt?.rendered || "").slice(0, 300) || null,
      detail_url: post.link || null,
      image_url: null,
      price: null,
    }];
  }).filter(ev => ev.title);
}

interface WpEvent {
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  date?: string;
  link?: string;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
