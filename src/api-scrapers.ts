import { MuseumApiConfig } from "./museum-apis";

export interface ApiEvent {
  title: string;
  date: string;
  time: string | null;
  description: string | null;
  detail_url: string | null;
  image_url: string | null;
  price: string | null;
  museum_slug_override?: string;
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
    case "senckenberg":
      return fetchSenckenberg(config.endpoint);
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

const HISTORISCHES_TITLE_BLOCKLIST = [
  "bibliothek der generationen",
];

async function fetchHistorisches(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const data = await res.json() as HistorischesEvent[];
  if (!Array.isArray(data)) return [];

  return data.flatMap((ev): ApiEvent[] => {
    if (!ev.title || !ev.dateStart) return [];
    if (HISTORISCHES_TITLE_BLOCKLIST.some((b) => ev.title!.toLowerCase().includes(b))) return [];
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
  const wrapper = await res.json() as { items?: JuedischesItem[] };
  const items = wrapper.items || [];

  return items.flatMap((item): ApiEvent[] => {
    const ev = item.data;
    if (!ev?.headline || !ev.dateTime) return [];
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

    const location = ev.locationAlt || ev.location || "";
    const isJudengasse = location.toLowerCase().includes("judengasse");

    return [{
      title: ev.headline.trim(),
      date,
      time: time !== "00:00" ? time : null,
      description: stripHtml(ev.copy || ev.subline || "").slice(0, 300) || null,
      detail_url: ev.detailPageLink?.href || null,
      image_url: imageUrl,
      price: null,
      museum_slug_override: isJudengasse ? "juedisches-museum-museum-judengasse-frankfurt" : undefined,
    }];
  });
}

interface JuedischesItem {
  type: string;
  id: number;
  data: {
    headline?: string;
    dateTime?: number;
    duration?: number;
    category?: string;
    subline?: string;
    copy?: string;
    image?: { src?: string };
    detailPageLink?: { href?: string };
    location?: string;
    locationAlt?: string;
    iCalUrl?: string;
  };
}

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

async function fetchSenckenberg(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Museumsufer/1.0)" },
  });
  if (!res.ok) return [];
  const posts = await res.json() as SenckenbergEvent[];
  if (!Array.isArray(posts)) return [];

  return posts.flatMap((post): ApiEvent[] => {
    const acf = post.acf;
    if (!acf) return [];
    if (acf.event_canceled) return [];
    if (acf.hide_event) return [];

    const startTime = acf.event_start_time;
    if (!startTime) return [];

    const date = startTime.slice(0, 10);
    if (date < todayIso()) return [];
    const time = startTime.slice(11, 16);

    const title = acf.event_title || stripHtml(post.title?.rendered || "");
    if (!title) return [];

    return [{
      title,
      date,
      time: time !== "00:00" ? time : null,
      description: stripHtml(acf.event_decription || "").slice(0, 300) || null,
      detail_url: post.link || null,
      image_url: null,
      price: null,
    }];
  });
}

interface SenckenbergEvent {
  title?: { rendered?: string };
  link?: string;
  acf?: {
    event_start_time?: string;
    event_stop_time?: string;
    event_title?: string;
    event_subtitle?: string;
    event_canceled?: boolean;
    event_sold_out?: boolean;
    hide_event?: boolean;
    event_decription?: string;
  };
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
