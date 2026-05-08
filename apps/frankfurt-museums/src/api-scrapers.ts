import { dateOffset, inferYear, toBerlinDate, toBerlinTime, todayIso } from "./date";
import { proxyFetch } from "./fetch-utils";
import type { EventApiType, ExhibitionApiType, ProxyConfig } from "./museum-config";
import {
  classifyEvent,
  GERMAN_MONTHS,
  GERMAN_MONTHS_SHORT,
  normalizeUrl,
  nullIfMidnight,
  stripHtml,
  truncateHtml,
  USER_AGENT,
} from "./shared";

export interface ApiEvent {
  title: string;
  date: string;
  time: string | null;
  end_time: string | null;
  end_date: string | null;
  description: string | null;
  detail_url: string | null;
  image_url: string | null;
  price: string | null;
  museum_slug_override?: string;
  category?: string | null;
}

export interface EventApiConfig {
  type: EventApiType;
  endpoint: string;
}

export interface ApiExhibition {
  title: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  detail_url: string | null;
  image_url: string | null;
  museum_slug_override?: string;
}

export interface ExhibitionApiConfig {
  type: ExhibitionApiType;
  endpoint: string;
}

export async function fetchExhibitionsFromApi(
  config: ExhibitionApiConfig,
  proxy?: ProxyConfig,
): Promise<ApiExhibition[]> {
  switch (config.type) {
    case "mmk-cms":
      return fetchMmkExhibitions(config.endpoint);
    case "schirn":
      return fetchSchirnExhibitions(config.endpoint);
    case "weltkulturen":
      return fetchWeltkulturenExhibitions(config.endpoint);
    case "caricatura":
      return fetchCaricaturaExhibitions(config.endpoint);
    case "giersch":
      return fetchGierschExhibitions(config.endpoint);
    case "fff":
      return fetchFffExhibitions(config.endpoint);
    case "staedel":
      return fetchStaedelExhibitions(config.endpoint);
    case "liebieghaus":
      return fetchLiebieghausExhibitions(config.endpoint);
    case "historisches":
      return fetchHistorischesExhibitions(config.endpoint);
    case "senckenberg":
      return fetchSenckenbergExhibitions(config.endpoint);
    case "juedisches":
      return fetchJuedischesExhibitions(config.endpoint);
    case "mak":
      return fetchMakExhibitions(config.endpoint);
    case "ledermuseum":
      return fetchLedermuseumExhibitions(config.endpoint);
    case "fkv":
      return fetchFkvExhibitions(config.endpoint);
    case "fdh":
      return fetchFdhExhibitions(config.endpoint);
    case "dff":
      return fetchDffExhibitions(config.endpoint);
    case "archaeologisches":
      return fetchArchaeologischesExhibitions(config.endpoint);
    case "dam-tribe":
      return fetchDamTribeExhibitions(config.endpoint);
    case "mfk":
      return fetchMfkExhibitions(config.endpoint);
    default: {
      void proxy;
      const _exhaustive: never = config.type;
      return [];
    }
  }
}

export async function fetchEventsFromApi(config: EventApiConfig, proxy?: ProxyConfig): Promise<ApiEvent[]> {
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
    case "my-calendar":
      return fetchMyCalendar(config.endpoint);
    case "liebieghaus":
      return fetchLiebieghaus(config.endpoint);
    case "mak":
      return fetchMak(config.endpoint);
    case "stadtgeschichte-rss":
      return fetchStadtgeschichteRss(config.endpoint);
    case "dommuseum":
      return fetchDommuseum(config.endpoint);
    case "ledermuseum":
      return fetchLedermuseum(config.endpoint);
    case "bibelhaus":
      return fetchBibelhaus(config.endpoint, proxy);
    case "fkv":
      return fetchFkv(config.endpoint);
    case "fdh":
      return fetchFdh(config.endpoint);
    case "dff-kino":
      return fetchDffKino(config.endpoint);
    case "archaeologisches":
      return fetchArchaeologisches(config.endpoint);
    case "fritz-bauer-wollheim":
      return fetchFritzBauerWollheim(config.endpoint);
    case "experiminta":
      return fetchExperiminta(config.endpoint);
    case "caricatura":
      return fetchCaricatura(config.endpoint);
    case "weltkulturen":
      return fetchWeltkulturen(config.endpoint);
    case "eventon":
      return fetchEventon(config.endpoint);
    case "buergerstiftung":
      return fetchBuergerstiftung(config.endpoint);
    case "schirn":
      return fetchSchirn(config.endpoint);
    case "mmk":
      return fetchMmk(config.endpoint);
    case "giersch":
      return fetchGiersch(config.endpoint);
    case "fff":
      return fetchFff(config.endpoint);
    default: {
      const _exhaustive: never = config.type;
      return [];
    }
  }
}

async function fetchTribeEvents(endpoint: string): Promise<ApiEvent[]> {
  const today = todayIso();
  const url = `${endpoint}?per_page=50&start_date=${today}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { events?: TribeEvent[] };
  if (!data.events) return [];

  return data.events
    .map((ev): ApiEvent => {
      const endDate = ev.end_date?.slice(0, 10) || null;
      const startDate = ev.start_date?.slice(0, 10) || "";
      return {
        title: stripHtml(ev.title || ""),
        date: startDate,
        time: nullIfMidnight(ev.start_date?.slice(11, 16) || null),
        end_time: nullIfMidnight(ev.end_date?.slice(11, 16) || null),
        end_date: endDate !== startDate ? endDate : null,
        description: truncateHtml(ev.excerpt || ev.description || ""),
        detail_url: ev.url || null,
        image_url: ev.image?.url || null,
        price: ev.cost || null,
      };
    })
    .filter((ev) => ev.title && ev.date);
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

const HISTORISCHES_TITLE_BLOCKLIST = ["bibliothek der generationen"];
const HISTORISCHES_EXTRA_TYPES = ["fuehrung", "workshop", "stadtgang"];
const HISTORISCHES_LOCATION_SLUGS: Record<string, string> = {
  c93ff959: "junges-museum-frankfurt",
  "6fb0dfb1": "porzellan-museum-frankfurt",
};

async function fetchHistorischesUrl(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok) {
    await r.body?.cancel();
    return null;
  }
  return r.json();
}

async function fetchHistorisches(endpoint: string): Promise<ApiEvent[]> {
  const responses = await Promise.all([
    fetchHistorischesUrl(endpoint),
    ...HISTORISCHES_EXTRA_TYPES.map((t) => fetchHistorischesUrl(`${endpoint}?type=${t}`)),
  ]);

  const seen = new Set<string>();
  const allEvents: HistorischesEvent[] = [];
  for (const data of responses) {
    if (!data) continue;
    const events: HistorischesEvent[] = Array.isArray(data)
      ? data
      : ((data as { events?: HistorischesEvent[] }).events ?? []);
    if (!Array.isArray(events)) continue;
    for (const ev of events) {
      if (!ev.title || !ev.dateStart || ev.type === "specialExhibition") continue;
      const key = `${ev.title}::${ev.dateStart}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allEvents.push(ev);
    }
  }

  return allEvents.flatMap((ev): ApiEvent[] => {
    if (HISTORISCHES_TITLE_BLOCKLIST.some((b) => ev.title!.toLowerCase().includes(b))) return [];
    const start = new Date(ev.dateStart! * 1000);
    const date = toBerlinDate(start);
    if (date < todayIso()) return [];

    const timeMatch = ev.time?.match(/(\d{1,2}:\d{2})/);

    let endTime: string | null = null;
    let endDate: string | null = null;
    if (ev.dateEnd) {
      const end = new Date(ev.dateEnd * 1000);
      const ed = toBerlinDate(end);
      endTime = nullIfMidnight(toBerlinTime(end));
      if (ed !== date) endDate = ed;
    }

    let price: string | null = null;
    if (ev.isFree) price = "Eintritt frei";
    else {
      const stripped = ev.summary?.replace(/<[^>]+>/g, " ");
      const priceMatch = stripped?.match(/(\d+[.,]?\d*\s*€[^,]*(?:,\s*\d+[.,]?\d*\s*€[^,]*)?)/);
      if (priceMatch) price = priceMatch[1].trim();
    }

    const locationSlug = ev.locations?.[0] ? HISTORISCHES_LOCATION_SLUGS[ev.locations[0]] : undefined;

    return [
      {
        title: ev.title!,
        date,
        time: nullIfMidnight(timeMatch?.[1] || null),
        end_time: endTime,
        end_date: endDate,
        description: truncateHtml(ev.summary || ""),
        detail_url: ev.url || null,
        image_url: ev.image || null,
        price,
        museum_slug_override: locationSlug,
      },
    ];
  });
}

interface HistorischesEvent {
  title?: string;
  type?: string;
  locations?: string[];
  dateStart?: number;
  dateEnd?: number;
  time?: string;
  summary?: string;
  body?: string;
  url?: string;
  image?: string;
  isFree?: boolean;
}

const JUEDISCHES_CATEGORY_MAP: Record<string, string> = {
  führung: "Führung",
  rundgang: "Führung",
  workshop: "Workshop",
  kurs: "Workshop",
  atelier: "Workshop",
  werkstatt: "Workshop",
  vortrag: "Vortrag",
  buchvorstellung: "Vortrag",
  buchpräsentation: "Vortrag",
  lesung: "Vortrag",
  gespräch: "Vortrag",
  podiumsdiskussion: "Vortrag",
  diskussion: "Vortrag",
  konzert: "Konzert",
  musik: "Konzert",
  vernissage: "Vernissage",
  eröffnung: "Vernissage",
  familienprogramm: "Familie",
  familie: "Familie",
  kinder: "Familie",
  film: "Film",
  kino: "Film",
};

function mapJuedischesCategory(raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return JUEDISCHES_CATEGORY_MAP[key] || null;
}

async function fetchJuedisches(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const wrapper = (await res.json()) as { items?: JuedischesItem[] };
  const items = wrapper.items || [];

  return items.flatMap((item): ApiEvent[] => {
    const ev = item.data;
    if (!ev?.headline || !ev.dateTime) return [];
    const start = new Date(ev.dateTime * 1000);
    const date = toBerlinDate(start);
    if (date < todayIso()) return [];

    const time = toBerlinTime(start);

    let imageUrl: string | null = null;
    if (ev.image?.src) {
      imageUrl = ev.image.src.startsWith("http") ? ev.image.src : `https://www.juedischesmuseum.de${ev.image.src}`;
    }

    const location = ev.locationAlt || ev.location || "";
    const isJudengasse = location.toLowerCase().includes("judengasse");

    let endTime: string | null = null;
    if (ev.duration && ev.duration > 0) {
      const endMs = (ev.dateTime + ev.duration * 60) * 1000;
      endTime = toBerlinTime(new Date(endMs));
    }

    return [
      {
        title: ev.headline.trim(),
        date,
        time: nullIfMidnight(time),
        end_time: endTime,
        end_date: null,
        description: truncateHtml(ev.copy || ev.subline || ""),
        detail_url: ev.detailPageLink?.href || null,
        image_url: imageUrl,
        price: null,
        category: mapJuedischesCategory(ev.category),
        museum_slug_override: isJudengasse ? "juedisches-museum-museum-judengasse-frankfurt" : undefined,
      },
    ];
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
  const data = (await res.json()) as { events?: StaedelEvent[]; aliases?: Record<string, string> };
  if (!data.events) return [];

  const webBase = data.aliases?.["@web"] || "https://www.staedelmuseum.de";
  const imgBase = data.aliases?.["@images"] || "https://www.staedelmuseum.de";

  return data.events
    .flatMap((ev): ApiEvent[] => {
      if (!ev.start) return [];
      const date = ev.start.slice(0, 10);
      if (date < todayIso()) return [];
      const time = ev.start.slice(11, 16);

      let url = ev.url || null;
      if (url?.startsWith("@web")) url = url.replace("@web", webBase);

      let thumb = ev.thumbnail || null;
      if (thumb?.startsWith("@images")) thumb = thumb.replace("@images", imgBase);

      let endTime: string | null = null;
      let endDate: string | null = null;
      if (ev.end) {
        const et = ev.end.slice(11, 16);
        const ed = ev.end.slice(0, 10);
        endTime = nullIfMidnight(et);
        if (ed !== date) endDate = ed;
      }

      // The API has no title; description is generic ("Die wichtigsten
      // Werke der Ausstellung auf einen Blick"). The URL slug carries the
      // real type — e.g. /programm/ueberblicksfuehrung-monets-kueste/...
      const slugWords = (ev.url || "").match(/\/programm\/([^/]+)/)?.[1].replace(/-/g, " ");

      return [
        {
          title: ev.title || ev.description || "",
          date,
          time: nullIfMidnight(time),
          end_time: endTime,
          end_date: endDate,
          description: ev.description?.slice(0, 300) || null,
          detail_url: url,
          image_url: thumb,
          price: null,
          category: classifyEvent(`${ev.title || ""} ${slugWords || ""}`, ev.description),
        },
      ];
    })
    .filter((ev) => ev.title);
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
  // The WP REST API caps per_page at 100, sorts by post-creation date (not
  // event date), and exposes no event_start_time filter. So future events
  // are interleaved across pages — we have to walk all of them.
  const pageUrl = (n: number) => `${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${n}`;
  const fetchJson = async (n: number): Promise<{ posts: SenckenbergEvent[]; totalPages: number }> => {
    const res = await fetch(pageUrl(n), { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return { posts: [], totalPages: 1 };
    const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10) || 1;
    const data = await res.json();
    return { posts: Array.isArray(data) ? (data as SenckenbergEvent[]) : [], totalPages };
  };

  const first = await fetchJson(1);
  const remainingPages = Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) => i + 2);
  const rest = await Promise.all(remainingPages.map((n) => fetchJson(n)));
  const posts: SenckenbergEvent[] = [...first.posts, ...rest.flatMap((r) => r.posts)];
  if (posts.length === 0) return [];

  // The event_title is intentionally generic (e.g. "Alle Jahre wieder…");
  // the type — "Öffentliche Führung", "Diskussion", "Vortrag", etc. — only
  // shows up via the event_type taxonomy. Fetch the term names once.
  const typeMap = new Map<number, string>();
  try {
    const base = endpoint.split("/wp-json/")[0];
    const tRes = await fetch(`${base}/wp-json/wp/v2/event_type?per_page=100`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (tRes.ok) {
      const terms = (await tRes.json()) as Array<{ id?: number; name?: string }>;
      for (const t of terms) {
        if (typeof t.id === "number" && t.name) typeMap.set(t.id, stripHtml(t.name));
      }
    }
  } catch {}

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

    let endTime: string | null = null;
    let endDate: string | null = null;
    if (acf.event_stop_time) {
      const ed = acf.event_stop_time.slice(0, 10);
      const et = acf.event_stop_time.slice(11, 16);
      endTime = nullIfMidnight(et);
      if (ed !== date) endDate = ed;
    }

    const typeNames = (post.event_type || [])
      .map((id) => typeMap.get(id) || "")
      .filter(Boolean)
      .join(" ");

    return [
      {
        title,
        date,
        time: nullIfMidnight(time),
        end_time: endTime,
        end_date: endDate,
        description: truncateHtml(acf.event_decription || ""),
        detail_url: post.link || null,
        image_url: null,
        price: null,
        category: classifyEvent(`${title} ${typeNames}`, acf.event_decription),
      },
    ];
  });
}

interface SenckenbergEvent {
  title?: { rendered?: string };
  link?: string;
  event_type?: number[];
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

async function fetchMyCalendar(endpoint: string): Promise<ApiEvent[]> {
  const today = todayIso();
  const weekAhead = dateOffset(30);
  const url = `${endpoint}?from=${today}&to=${weekAhead}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, MyCalendarEvent[]>;
  if (typeof data !== "object" || Array.isArray(data)) return [];

  const events: ApiEvent[] = [];
  for (const [, dayEvents] of Object.entries(data)) {
    if (!Array.isArray(dayEvents)) continue;
    for (const ev of dayEvents) {
      if (!ev.event_title || !ev.occur_begin) continue;
      if (ev.event_title.startsWith("ENTFÄLLT")) continue;

      const date = ev.occur_begin.slice(0, 10);
      if (date < today) continue;

      let time = ev.event_time && ev.event_time !== "00:00:00" ? ev.event_time.slice(0, 5) : null;

      if (!time && ev.event_desc) {
        const withMinutes = ev.event_desc.match(/(\d{1,2})[.:](\d{2})\s*(?:Uhr|h\b)/);
        if (withMinutes) {
          time = `${withMinutes[1].padStart(2, "0")}:${withMinutes[2]}`;
        } else {
          const hourOnly = ev.event_desc.match(/(?:ab\s+)?(\d{1,2})\s*Uhr/);
          if (hourOnly) {
            time = `${hourOnly[1].padStart(2, "0")}:00`;
          }
        }
      }

      const detailUrl = ev.event_post ? `https://www.mfk-frankfurt.de/?p=${ev.event_post}` : null;

      const endTime = ev.event_endtime && ev.event_endtime !== "00:00:00" ? ev.event_endtime.slice(0, 5) : null;

      events.push({
        title: ev.event_title,
        date,
        time,
        end_time: endTime,
        end_date: null,
        description: truncateHtml(ev.event_short || ""),
        detail_url: detailUrl,
        image_url: ev.event_image || null,
        price: null,
      });
    }
  }

  return events;
}

interface MyCalendarEvent {
  event_title?: string;
  event_short?: string;
  event_desc?: string;
  event_time?: string;
  event_endtime?: string;
  event_image?: string;
  event_post?: string;
  event_url?: string;
  occur_begin?: string;
  occur_end?: string;
}

async function fetchLiebieghaus(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return [];
  const html = await res.text();

  const events: ApiEvent[] = [];
  const blockRe = /itemtype="http:\/\/schema\.org\/Event"([\s\S]*?)(?=itemtype="http:\/\/schema\.org\/Event"|<\/main)/g;
  let match;

  while ((match = blockRe.exec(html)) !== null) {
    const block = match[1];

    const startMatch = block.match(/itemprop="startDate" datetime="([^"]+)"/);
    const nameMatch = block.match(/itemprop="name">([^<]+)/);
    if (!startMatch || !nameMatch) continue;

    const dt = startMatch[1];
    const date = dt.slice(0, 10);
    if (date < todayIso()) continue;

    const time = dt.slice(11, 16);
    const title = nameMatch[1].trim();

    const detailMatch = block.match(/href="(\/de\/angebote\/[^"]+)"[^>]*>Mehr zu diesem Angebot/);
    const imgMatch = block.match(/data-src-set="([^ ]+)/);
    const priceMatch = block.match(/(?:Kosten|Eintritt|Preis)[^<]*?(\d+[.,]?\d*\s*(?:Euro|€)[^<]*)/i);

    const durationMatch = block.match(/itemprop="duration" datetime="P[^"]*T(\d+)H(?:(\d+)M)?/);
    let endTime: string | null = null;
    if (durationMatch && time !== "00:00") {
      const h = parseInt(time.split(":")[0], 10) + parseInt(durationMatch[1], 10);
      const m = time.split(":")[1];
      endTime = `${(h % 24).toString().padStart(2, "0")}:${m}`;
    }

    events.push({
      title,
      date,
      time: time !== "00:00" ? time : null,
      end_time: endTime,
      end_date: null,
      description: null,
      detail_url: detailMatch ? `https://www.liebieghaus.de${detailMatch[1]}` : null,
      image_url: imgMatch ? `https://www.liebieghaus.de${imgMatch[1]}` : null,
      price: priceMatch ? priceMatch[0].trim() : null,
    });
  }

  return events;
}

async function fetchDommuseum(endpoint: string): Promise<ApiEvent[]> {
  const ua = { "User-Agent": USER_AGENT };
  const res = await fetch(endpoint, { headers: ua });
  if (!res.ok) return [];
  const html = await res.text();

  const events: ApiEvent[] = [];
  const blockRe = /<div class="event-image">([\s\S]*?)(?=<div class="event-image">|<div class="pagination|$)/g;
  let match;

  while ((match = blockRe.exec(html)) !== null) {
    const block = match[1];
    if (block.includes("event-canceled")) continue;

    const icsMatch = block.match(/href="([^"]*format%5D=ics[^"]*)"/);
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
    const linkMatch = block.match(/href="(\/besuchen\/kalender\/[^?"]+)"/);
    if (!icsMatch) continue;

    const icsUrl = `https://dommuseum-frankfurt.de${icsMatch[1].replace(/&amp;/g, "&")}`;
    try {
      const icsRes = await fetch(icsUrl, { headers: ua });
      if (!icsRes.ok) continue;
      const ics = await icsRes.text();

      const summary = ics.match(/SUMMARY:(.+)/)?.[1]?.trim();
      const dtStart = ics.match(/DTSTART:(\d{8}T\d{6})/)?.[1];
      const dtEnd = ics.match(/DTEND:(\d{8}T\d{6})/)?.[1];
      const desc = ics.match(/DESCRIPTION:(.+)/)?.[1]?.trim();
      if (!summary || !dtStart) continue;

      const startDate = new Date(
        `${dtStart.slice(0, 4)}-${dtStart.slice(4, 6)}-${dtStart.slice(6, 8)}T${dtStart.slice(9, 11)}:${dtStart.slice(11, 13)}:${dtStart.slice(13, 15)}Z`,
      );
      const date = toBerlinDate(startDate);
      if (date < todayIso()) continue;
      const time = toBerlinTime(startDate);

      let endTime: string | null = null;
      let endDate: string | null = null;
      if (dtEnd) {
        const endD = new Date(
          `${dtEnd.slice(0, 4)}-${dtEnd.slice(4, 6)}-${dtEnd.slice(6, 8)}T${dtEnd.slice(9, 11)}:${dtEnd.slice(11, 13)}:${dtEnd.slice(13, 15)}Z`,
        );
        endTime = toBerlinTime(endD);
        const ed = toBerlinDate(endD);
        if (ed !== date) endDate = ed;
      }

      const detailPath = linkMatch ? linkMatch[1] : null;

      events.push({
        title: summary,
        date,
        time: nullIfMidnight(time),
        end_time: endTime !== "00:00" ? endTime : null,
        end_date: endDate,
        description: desc ? stripHtml(desc).slice(0, 300) : null,
        detail_url: detailPath ? `https://dommuseum-frankfurt.de${detailPath}` : null,
        image_url: imgMatch ? `https://dommuseum-frankfurt.de${imgMatch[1]}` : null,
        price: null,
      });
    } catch {}
  }

  return events;
}

async function fetchMak(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return [];
  const html = await res.text();

  const events: ApiEvent[] = [];
  const articleRe = /<article[^>]*class="[^"]*mak-event-item[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  let match;

  while ((match = articleRe.exec(html)) !== null) {
    const block = match[1];

    const dayMatch = block.match(/class="mak-event-day">([^<]+)/);
    const headingMatch = block.match(/class="mak-event-heading">([^<]+)/);
    if (!dayMatch || !headingMatch) continue;

    const dayStr = dayMatch[1].trim();
    const heading = headingMatch[1].trim();

    const dateMatch = dayStr.match(/(\d{1,2})\s+(\w+)/);
    if (!dateMatch) continue;
    const [, day, monthName] = dateMatch;
    const monthNum = GERMAN_MONTHS_SHORT[monthName.toLowerCase().slice(0, 3)];
    if (!monthNum) continue;

    const date = `${inferYear(monthNum, day)}-${monthNum}-${day.padStart(2, "0")}`;
    if (date < todayIso()) continue;

    const timeRangeMatch = heading.match(
      /^(\d{1,2}(?:[.:]\d{2})?)\s*(?:[–-]\s*(\d{1,2}(?:[.:]\d{2})?))?(?:\s*Uhr)?\s*[–-]\s*/,
    );
    let time: string | null = null;
    let endTime: string | null = null;
    let title = heading;
    if (timeRangeMatch) {
      const rawStart = timeRangeMatch[1].replace(".", ":");
      time = rawStart.includes(":") ? rawStart : `${rawStart}:00`;
      if (timeRangeMatch[2]) {
        const rawEnd = timeRangeMatch[2].replace(".", ":");
        endTime = rawEnd.includes(":") ? rawEnd : `${rawEnd}:00`;
      }
      title = heading.slice(timeRangeMatch[0].length).trim();
    }

    const subMatch = block.match(/class="mak-event-subheading">([^<]+)/);
    const linkMatch = block.match(/href="(\/de\/veranstaltungen\/[^"]+)"/);
    const accordionMatch = block.match(/class="mak-accordion-content[^"]*"[^>]*>([\s\S]*?)$/);
    const accordionText = accordionMatch ? truncateHtml(accordionMatch[1]) : null;

    const sub = subMatch ? subMatch[1].trim() : null;
    const description = accordionText ? (sub ? `${sub} – ${accordionText}` : accordionText) : sub;

    let price: string | null = null;
    if (accordionText) {
      const priceMatch = accordionText.match(
        /(?:Im Eintrittspreis inbegriffen|Eintritt frei|kostenlos|kostenfrei|\d+[\s,.]?\d*\s*€)/i,
      );
      if (priceMatch) price = priceMatch[0];
    }

    const finalTitle = title || heading;
    const isIkonenmuseum = /ikonenmuseum/i.test(finalTitle);

    events.push({
      title: finalTitle,
      date,
      time: nullIfMidnight(time),
      end_time: nullIfMidnight(endTime),
      end_date: null,
      description,
      detail_url: linkMatch ? `https://www.museumangewandtekunst.de${linkMatch[1]}` : null,
      image_url: null,
      price,
      ...(isIkonenmuseum && { museum_slug_override: "ikonenmuseum-frankfurt" }),
    });
  }

  return events;
}

async function fetchStadtgeschichteRss(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const xml = await res.text();

  const events: ApiEvent[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRe.exec(xml)) !== null) {
    const item = match[1];

    const titleMatch = item.match(/<title>([^<]+)/);
    const linkMatch = item.match(/<link>([^<]+)/);
    const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>/);
    if (!titleMatch || !descMatch) continue;

    const desc = descMatch[1];
    const title = titleMatch[1].trim();

    const dateMatch = desc.match(/(\d{1,2})\.\s*(\w+)\s*(\d{4})/);
    if (!dateMatch) continue;
    const [, day, monthName, year] = dateMatch;
    const monthNum = GERMAN_MONTHS[monthName.toLowerCase()];
    if (!monthNum) continue;
    const date = `${year}-${monthNum}-${day.padStart(2, "0")}`;
    if (date < todayIso()) continue;

    const timeMatch = desc.match(/(\d{1,2}:\d{2})\s*Uhr/);
    const endTimeMatch = desc.match(/\d{1,2}:\d{2}\s*Uhr\s*bis\s*(\d{1,2}:\d{2})\s*Uhr/);
    const imgMatch = desc.match(/<img[^>]+src="([^"]+)"/);
    const priceMatch = desc.match(/(\d+\s*€[^<,]*(?:,\s*ermäßigt\s*\d+\s*€)?)/i);

    let image_url: string | null = null;
    if (imgMatch) {
      image_url = imgMatch[1].startsWith("http") ? imgMatch[1] : `https://www.stadtgeschichte-ffm.de${imgMatch[1]}`;
    }

    events.push({
      title,
      date,
      time: nullIfMidnight(timeMatch ? timeMatch[1] : null),
      end_time: nullIfMidnight(endTimeMatch ? endTimeMatch[1] : null),
      end_date: null,
      description: truncateHtml(desc),
      detail_url: linkMatch ? linkMatch[1].trim() : null,
      image_url,
      price: priceMatch ? priceMatch[1].trim() : null,
    });
  }

  return events;
}

async function fetchLedermuseum(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const events: ApiEvent[] = [];
  const itemRe = /<li class="quarter[^"]*">([\s\S]*?)<\/li>/g;
  let match;

  while ((match = itemRe.exec(html)) !== null) {
    const block = match[1];
    const titleMatch = block.match(/<h4>([^<]+)/);
    const dateSpans = block.match(/<div class="date">([\s\S]*?)<\/div>/);
    const linkMatch = block.match(/<a\s+href="([^"]+)"/);
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
    const subtitleMatch = block.match(/<p>([^<]+)/);
    if (!titleMatch || !dateSpans) continue;

    const dateText = stripHtml(dateSpans[1]);
    const dayMonth = dateText.match(/(\d{1,2})\.\s*(\w+)/);
    if (!dayMonth) continue;
    const monthNum =
      GERMAN_MONTHS_SHORT[dayMonth[2].toLowerCase().slice(0, 3)] || GERMAN_MONTHS[dayMonth[2].toLowerCase()];
    if (!monthNum) continue;
    const date = `${inferYear(monthNum, dayMonth[1])}-${monthNum}-${dayMonth[1].padStart(2, "0")}`;
    if (date < today) continue;

    const timeMatch = dateText.match(/(\d{1,2}:\d{2})/);

    events.push({
      title: titleMatch[1].trim(),
      date,
      time: nullIfMidnight(timeMatch ? timeMatch[1] : null),
      end_time: null,
      end_date: null,
      description: subtitleMatch ? subtitleMatch[1].trim() : null,
      detail_url: linkMatch ? normalizeUrl(linkMatch[1], "https://www.ledermuseum.de") : null,
      image_url: imgMatch ? normalizeUrl(imgMatch[1], "https://www.ledermuseum.de") : null,
      price: null,
    });
  }

  return events;
}

async function fetchBibelhaus(endpoint: string, proxy?: ProxyConfig): Promise<ApiEvent[]> {
  const res = proxy
    ? await proxyFetch(endpoint, proxy)
    : await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const events: ApiEvent[] = [];
  const itemRe = /<li[^>]*class="bmBase--eventsItem"[^>]*>([\s\S]*?)<\/li>/g;
  let match;

  while ((match = itemRe.exec(html)) !== null) {
    const block = match[1];
    if (/geschlossen|Schließzeit/i.test(block)) continue;

    const titleMatch = block.match(/bmBase--eventsLabelTitle[^>]*>([^<]+)/);
    const dateDay = block.match(/bmBase--eventsDateDay[^>]*>([^<]+)/);
    const dateTime = block.match(/bmBase--eventsDateTime[^>]*>([^<]+)/);
    const linkMatch = block.match(/<a[^>]+href="([^"]+)"/);
    if (!titleMatch || !dateDay) continue;

    const dayText = dateDay[1].trim();
    const dayMonth = dayText.match(/(\d{1,2})\.\s*(\w+)/);
    if (!dayMonth) continue;
    const monthNum =
      GERMAN_MONTHS_SHORT[dayMonth[2].toLowerCase().slice(0, 3)] || GERMAN_MONTHS[dayMonth[2].toLowerCase()];
    if (!monthNum) continue;
    const date = `${inferYear(monthNum, dayMonth[1])}-${monthNum}-${dayMonth[1].padStart(2, "0")}`;
    if (date < today) continue;

    let time: string | null = null;
    if (dateTime) {
      const tm = dateTime[1].match(/(\d{1,2}(?:[.:]\d{2})?)\s*Uhr/);
      if (tm) {
        const raw = tm[1].replace(".", ":");
        time = raw.includes(":") ? raw : `${raw}:00`;
      }
    }

    events.push({
      title: titleMatch[1].trim(),
      date,
      time: nullIfMidnight(time),
      end_time: null,
      end_date: null,
      description: null,
      detail_url: linkMatch ? normalizeUrl(linkMatch[1], "https://www.bibelhaus-frankfurt.de") : null,
      image_url: null,
      price: null,
    });
  }

  return events;
}

async function fetchFkv(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const events: ApiEvent[] = [];
  // Listing markup wraps each <article> with <a class="tile-link" href="...">…</a>
  const tileRe =
    /<a[^>]+class="tile-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>|<a[^>]+href="([^"]+)"[^>]+class="tile-link"[^>]*>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = tileRe.exec(html)) !== null) {
    const href = match[1] || match[3];
    const block = match[2] || match[4];
    if (!href || !block) continue;

    const titleMatch = block.match(/archive-title[^>]*>([^<]+)/);
    const subtitleMatch = block.match(/<p class="subtitle">([^<]+)/);
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
    if (!titleMatch || !subtitleMatch) continue;

    const dm = subtitleMatch[1].match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!dm) continue;
    const date = `${dm[3]}-${dm[2]}-${dm[1]}`;
    if (date < today) continue;

    const timeMatch = subtitleMatch[1].match(/(\d{1,2}):(\d{2})\s*Uhr/);
    let time: string | null = null;
    if (timeMatch) {
      time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
    }

    events.push({
      title: titleMatch[1].trim(),
      date,
      time: nullIfMidnight(time),
      end_time: null,
      end_date: null,
      description: null,
      detail_url: normalizeUrl(href, "https://www.fkv.de"),
      image_url: imgMatch ? normalizeUrl(imgMatch[1], "https://www.fkv.de") : null,
      price: null,
    });
  }

  return events;
}

async function fetchFdh(endpoint: string): Promise<ApiEvent[]> {
  const baseUrl = new URL(endpoint).origin;
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const events: ApiEvent[] = [];

  const linkRe = /<a[^>]+class="o-program-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const detailUrls: string[] = [];
  let linkMatch;
  while ((linkMatch = linkRe.exec(html)) !== null) {
    const url = normalizeUrl(linkMatch[1], baseUrl);
    if (url) detailUrls.push(url);
  }

  for (const url of detailUrls) {
    try {
      const detailRes = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!detailRes.ok) continue;
      const detailHtml = await detailRes.text();

      const eventRe = /c-event-item__date__title[^>]*>([^<]+)[\s\S]*?c-event-item__date__subtitle[^>]*>([^<]+)/g;
      let eventMatch;
      while ((eventMatch = eventRe.exec(detailHtml)) !== null) {
        const dateStr = eventMatch[1].trim();
        const timeStr = eventMatch[2].trim();

        const dm = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (!dm) continue;
        const date = `${dm[3]}-${dm[2]}-${dm[1]}`;
        if (date < today) continue;

        const tm = timeStr.match(/(\d{1,2}(?:[.:]\d{2})?)\s*Uhr/);
        let time: string | null = null;
        if (tm) {
          const raw = tm[1].replace(".", ":");
          time = raw.includes(":") ? raw : `${raw}:00`;
        }

        const titleMatch = detailHtml.match(/c-event-detail__title[^>]*>([^<]+)/);
        const imgMatch = detailHtml.match(/c-event-detail__image[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/);

        events.push({
          title: titleMatch ? titleMatch[1].trim() : "",
          date,
          time: nullIfMidnight(time),
          end_time: null,
          end_date: null,
          description: null,
          detail_url: url,
          image_url: imgMatch ? normalizeUrl(imgMatch[1], baseUrl) : null,
          price: null,
        });
      }
    } catch {}
  }

  return events;
}

const GERMAN_WEEKDAYS = /^(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s+/;

interface CinetixxShow {
  id: number;
  displayDateTime: string; // ISO 8601
  _UrlBooking: string;
}

interface CinetixxEvent {
  id: number;
  title: string;
  movieName?: string;
  shortDescription?: string;
  longDescription?: string;
  imageUrlArtwork?: string;
  actors?: string;
  director?: string;
  genre?: string;
  duration?: number;
  shows: CinetixxShow[];
}

async function fetchDffKino(endpoint: string): Promise<ApiEvent[]> {
  const today = todayIso();
  const events: ApiEvent[] = [];

  // 1. Fetch the cinema program from the Cinetixx JSON API
  try {
    const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const data = (await res.json()) as CinetixxEvent[];
      for (const movie of data) {
        // Build description from metadata
        const metadata = [
          movie.director ? `Regie: ${movie.director}` : null,
          movie.actors ? `Darsteller: ${movie.actors}` : null,
          movie.duration ? `${movie.duration} Min.` : null,
          movie.genre && movie.genre !== "-" ? movie.genre : null,
        ]
          .filter(Boolean)
          .join(" | ");

        const combinedDescription = [
          metadata ? `<strong>${metadata}</strong>` : null,
          movie.shortDescription,
          movie.longDescription,
        ]
          .filter(Boolean)
          .join("<br /><br />");

        const description = truncateHtml(combinedDescription, 800);

        for (const show of movie.shows) {
          const start = new Date(show.displayDateTime);
          const date = toBerlinDate(start);
          const time = toBerlinTime(start);

          if (date < today) continue;

          // Categorize: Default to "Film", but check for "Familie" or "Vortrag"
          let category = "Film";
          const genre = (movie.genre || "").toLowerCase();
          const lowerTitle = (movie.title || movie.movieName || "").toLowerCase();

          if (
            genre.includes("animation") ||
            genre.includes("familie") ||
            genre.includes("kinder") ||
            genre.includes("kinderfilm")
          ) {
            category = "Familie";
          } else if (
            genre.includes("vortrag") ||
            genre.includes("lecture") ||
            lowerTitle.includes("vortrag") ||
            lowerTitle.includes("lecture") ||
            lowerTitle.includes("buchpräsentation")
          ) {
            category = "Vortrag";
          }

          events.push({
            title: movie.title || movie.movieName || "Unbenannter Film",
            date,
            time: nullIfMidnight(time),
            end_time: null,
            end_date: null,
            description,
            detail_url: show._UrlBooking || null,
            image_url: movie.imageUrlArtwork || null,
            price: null,
            category,
          });
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch DFF cinema API:", e);
  }

  // 2. Also fetch tribe-events for non-cinema museum events (workshops, tours, etc.)
  try {
    const tribeEvents = await fetchTribeEvents("https://www.dff.film/wp-json/tribe/events/v1/events");
    // Deduplicate: cinema entries take priority if same title+date exists
    const kinoKeys = new Set(events.map((e) => `${e.title.toLowerCase()}::${e.date}`));
    for (const te of tribeEvents) {
      const key = `${te.title.toLowerCase()}::${te.date}`;
      if (!kinoKeys.has(key)) {
        // Basic classification for DFF Tribe events
        const title = te.title.toLowerCase();
        if (title.includes("führung") || title.includes("rundgang")) te.category = "Führung";
        else if (title.includes("workshop") || title.includes("kurs") || title.includes("atelier"))
          te.category = "Workshop";
        else if (title.includes("vortrag") || title.includes("lecture") || title.includes("gespräch"))
          te.category = "Vortrag";
        else if (title.includes("film") || title.includes("kino")) te.category = "Film";

        events.push(te);
      }
    }
  } catch (e) {
    console.error("Failed to fetch DFF tribe events:", e);
  }

  return events;
}

const ARCHAEOLOGISCHES_CANCELLED = /\b(?:muss\s+leider\s+entfallen|entfällt|entfallen|abgesagt|fällt\s+aus)\b/i;
const ARCHAEOLOGISCHES_SOLDOUT = /\b(?:bereits\s+ausgebucht|ausgebucht|sold\s+out)\b/i;

async function fetchArchaeologisches(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const events: ApiEvent[] = [];
  const today = todayIso();

  // Split by panels (months)
  const panelRe = /<div class="sppb-panel[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let panelMatch;

  while ((panelMatch = panelRe.exec(html)) !== null) {
    const panel = panelMatch[1];
    const monthMatch =
      panel.match(/<span[^>]*\bclass="sppb-panel-title"[^>]*\baria-label="([^"]+)"/) ||
      panel.match(/<span[^>]*\bclass="sppb-panel-title"[^>]*>\s*([^<]+?)\s*</);
    if (!monthMatch) continue;

    const monthParts = monthMatch[1].trim().split(" ");
    const monthName = monthParts[0].toLowerCase();
    const monthNum = GERMAN_MONTHS[monthName];
    if (!monthNum) continue;

    const bodyMatch = panel.match(/<div class="sppb-panel-body">([\s\S]*?)<\/div>/);
    if (!bodyMatch) continue;
    const body = bodyMatch[1];

    // The calendar is a rolling 12 months in Jan–Dec order, so the year jumps
    // mid-list. Each panel body opens with <p><strong>YYYY</strong></p>; trust
    // it instead of inferring from today's date.
    const yearMatch = body.match(/<p[^>]*>\s*<strong>\s*(\d{4})\s*<\/strong>\s*<\/p>/);
    const panelYear = yearMatch ? yearMatch[1] : String(inferYear(monthNum, "01"));

    const dayBlocks = body.split(/<strong>\s*\d{1,2}\s*(?:&nbsp;| )\s*\|\s*[A-Z]+\s*<\/strong>/);
    const dayHeaders = body.match(/<strong>\s*(\d{1,2})\s*(?:&nbsp;| )\s*\|\s*[A-Z]+\s*<\/strong>/g);

    if (!dayHeaders) continue;

    for (let i = 0; i < dayHeaders.length; i++) {
      const header = dayHeaders[i];
      const dayMatch = header.match(/(\d{1,2})/);
      if (!dayMatch) continue;
      const day = dayMatch[1].padStart(2, "0");
      const date = `${panelYear}-${monthNum}-${day}`;
      if (date < today) continue;

      const block = dayBlocks[i + 1];
      if (!block) continue;

      // Inner [\s\S]*? lets us capture titles that contain <em>, <span>, or
      // status notes like <span style="...">ausgebucht</span>.
      const eventRe =
        /(?:(\d{1,2}(?:[:.]\d{2})?(?:\s*[-–]\s*\d{1,2}(?:[:.]\d{2})?)?)\s*Uhr)?\s*(?:&nbsp;|\s)*?(?:<em>([^<]*)<\/em>)?\s*(?:<br \/>)?\s*<strong>([\s\S]*?)<\/strong>/g;

      let lastIndexThisDay = -1;
      let evMatch;
      while ((evMatch = eventRe.exec(block)) !== null) {
        const [, timeRange, category, rawTitle] = evMatch;
        const cleanTitle = stripHtml(rawTitle).trim();
        if (!cleanTitle) continue;

        const cancelled = ARCHAEOLOGISCHES_CANCELLED.test(cleanTitle);
        const soldOut = ARCHAEOLOGISCHES_SOLDOUT.test(cleanTitle);

        // A trailing <strong> that contains nothing but a status note ("muss
        // leider entfallen", "ausgebucht") refers to the prior event in the
        // same day rather than introducing a new one.
        const statusOnly = !timeRange && !category && (cancelled || soldOut) && cleanTitle.length < 40;
        if (statusOnly) {
          if (lastIndexThisDay >= 0) {
            if (cancelled) {
              events.splice(lastIndexThisDay, 1);
              lastIndexThisDay = -1;
            } else if (soldOut && !events[lastIndexThisDay].title.includes("ausgebucht")) {
              events[lastIndexThisDay].title = `${events[lastIndexThisDay].title} (ausgebucht)`;
            }
          }
          continue;
        }

        if (cancelled) continue;

        let time = null;
        let endTime = null;
        if (timeRange) {
          const times = timeRange.split(/[-–]/).map((t) => t.trim().replace(".", ":"));
          time = times[0];
          if (times[1]) endTime = times[1];
          if (time && !time.includes(":")) time += ":00";
          if (endTime && !endTime.includes(":")) endTime += ":00";
        }

        const finalTitle = soldOut
          ? `${cleanTitle.replace(ARCHAEOLOGISCHES_SOLDOUT, "").trim()} (ausgebucht)`
          : cleanTitle;

        events.push({
          title: finalTitle,
          date,
          time: nullIfMidnight(time),
          end_time: nullIfMidnight(endTime),
          end_date: null,
          description: null,
          detail_url: null,
          image_url: null,
          category: category ? stripHtml(category).trim() : null,
          price: null,
        });
        lastIndexThisDay = events.length - 1;
      }
    }
  }

  return events;
}

// The Wollheim Memorial has no events feed of its own; their guided tours are
// listed on the Fritz Bauer Institut's calendar, mixed with the institute's
// own events. We scrape the listing and keep only entries whose title mentions
// "Wollheim Memorial".
async function fetchFritzBauerWollheim(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();
  const today = todayIso();
  const events: ApiEvent[] = [];

  const blockRe =
    /<div class="col-sm-12 col-md-12 mb-12 events events-latest[^"]*"[^>]*>([\s\S]*?)(?=<div class="col-sm-12 col-md-12 mb-12 events events-latest|<footer\b|$)/g;

  let m: RegExpExecArray | null = blockRe.exec(html);
  while (m !== null) {
    const block = m[1];
    const titleMatch = block.match(/<a\s+title="([^"]+)"[^>]+href="([^"]+)"/);
    if (!titleMatch || !/wollheim\s*[-\s]\s*memorial/i.test(titleMatch[1])) {
      m = blockRe.exec(html);
      continue;
    }
    const title = titleMatch[1].trim();
    const detailUrl = titleMatch[2].startsWith("http")
      ? titleMatch[2]
      : `https://www.fritz-bauer-institut.de${titleMatch[2]}`;

    const dateRaw = block.match(/class="_event-date"[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "";
    const dateText = stripHtml(dateRaw).replace(/\s+/g, " ").trim();
    const dateParts = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})(?:\s+(\d{1,2}:\d{2}))?/);
    if (!dateParts) {
      m = blockRe.exec(html);
      continue;
    }
    const [, day, monthName, year, time] = dateParts;
    const monthNum = GERMAN_MONTHS[monthName.toLowerCase()];
    if (!monthNum) {
      m = blockRe.exec(html);
      continue;
    }
    const date = `${year}-${monthNum}-${day.padStart(2, "0")}`;
    if (date < today) {
      m = blockRe.exec(html);
      continue;
    }

    const subtitle = block.match(/<h3 class="mt-0"><small>([^<]+)<\/small>/)?.[1]?.trim() || null;
    const descMatch = block.match(/<div class="collapse"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/);

    events.push({
      title,
      date,
      time: nullIfMidnight(time || null),
      end_time: null,
      end_date: null,
      description: descMatch ? truncateHtml(descMatch[1]) : null,
      detail_url: detailUrl,
      image_url: null,
      price: null,
      category: subtitle && /führung|rundgang/i.test(subtitle) ? "Führung" : null,
    });

    m = blockRe.exec(html);
  }

  return events;
}

function parseExperimentaSlugDate(slug: string): string | null {
  let m = slug.match(/-(\d{2})-(\d{2})-(\d{4})\/?$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = slug.match(/-(\d{2})-(\d{2})-(\d{2})(?:-[a-zäöü]+)?\/?$/i);
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
  m = slug.match(/-(\d{2})(\d{2})(\d{2})\/?$/);
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

interface ExperimintaProduct {
  name?: string;
  description?: string;
  image?: string | string[];
  offers?: Array<{
    priceSpecification?: Array<{ price?: string; priceCurrency?: string }>;
    price?: string;
    priceCurrency?: string;
  }>;
}

function findProductJsonLd(html: string): ExperimintaProduct | null {
  const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null = re.exec(html);
  while (m !== null) {
    try {
      const data = JSON.parse(m[1].trim()) as { "@type"?: string } & ExperimintaProduct;
      if (data["@type"] === "Product") return data;
    } catch {}
    m = re.exec(html);
  }
  return null;
}

function extractTimeRange(text: string): { time: string | null; end_time: string | null } {
  const m = text.match(/(\d{1,2})[:.](\d{2})\s*[–-]\s*(\d{1,2})[:.](\d{2})\s*Uhr/);
  if (m) return { time: `${m[1].padStart(2, "0")}:${m[2]}`, end_time: `${m[3].padStart(2, "0")}:${m[4]}` };
  const single = text.match(/(\d{1,2})[:.](\d{2})\s*Uhr/);
  if (single) return { time: `${single[1].padStart(2, "0")}:${single[2]}`, end_time: null };
  return { time: null, end_time: null };
}

async function fetchExperiminta(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const xml = await res.text();

  const today = todayIso();
  const candidates: Array<{ url: string; date: string }> = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = m[1];
    if (!/\/event\/[^/]+\/?$/.test(url)) continue;
    const slug = url.replace(/\/$/, "").split("/").pop() ?? "";
    const date = parseExperimentaSlugDate(slug);
    if (!date || date < today) continue;
    const key = `${slug.replace(/-?\d{6,8}.*$/, "")}::${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ url, date });
  }

  const limited = candidates.slice(0, 30);
  const detailHtmls = await Promise.all(
    limited.map(async (c) => {
      try {
        const r = await fetch(c.url, { headers: { "User-Agent": USER_AGENT } });
        return r.ok ? await r.text() : null;
      } catch {
        return null;
      }
    }),
  );

  return limited.flatMap((c, i): ApiEvent[] => {
    const html = detailHtmls[i];
    if (!html) return [];
    const product = findProductJsonLd(html);
    if (!product?.name) return [];
    const title = product.name.replace(/\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s*$/, "").trim();
    if (!title) return [];
    const description = product.description?.replace(/\r\n/g, "\n").trim() ?? "";
    const { time, end_time } = extractTimeRange(description);
    const priceSpec = product.offers?.[0]?.priceSpecification?.[0];
    const priceValue = priceSpec?.price ?? product.offers?.[0]?.price ?? null;
    const price = priceValue ? `${parseFloat(priceValue).toFixed(2).replace(/\.00$/, "")} €` : null;
    const image = Array.isArray(product.image) ? product.image[0] : product.image;
    return [
      {
        title,
        date: c.date,
        time,
        end_time,
        end_date: null,
        description: description ? truncateHtml(description) : null,
        detail_url: c.url,
        image_url: image ?? null,
        price,
        category: classifyEvent(title, description) || null,
      },
    ];
  });
}

const CARICATURA_GERMAN_MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

function parseCaricaturaBadgeDate(badge: string): string | null {
  // Reject date ranges (exhibition runtime previews use the same badge slot,
  // e.g. "27. Juni 2026 - 17. Januar 2027"). Real events are single-day.
  if (/[–-]\s*\d{1,2}\.|\bbis\b/i.test(badge)) return null;
  const m = badge.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s*(\d{4})/);
  if (!m) return null;
  const month = CARICATURA_GERMAN_MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
}

async function fetchCaricatura(endpoint: string): Promise<ApiEvent[]> {
  const origin = new URL(endpoint).origin;
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const blockRe = /<div class="module_teaser_large[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
  const events: ApiEvent[] = [];
  let m: RegExpExecArray | null = blockRe.exec(html);
  while (m !== null) {
    const block = m[0];
    const badge = block.match(/<p class="badge">([^<]+)<\/p>/)?.[1]?.trim();
    const title = block
      .match(/<p class="headline">([\s\S]*?)<\/p>/)?.[1]
      ?.replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!badge || !title) {
      m = blockRe.exec(html);
      continue;
    }
    const date = parseCaricaturaBadgeDate(badge);
    if (!date || date < today) {
      m = blockRe.exec(html);
      continue;
    }
    const href = block.match(/<a href="([^"]+)"/)?.[1];
    const detailUrl = href ? normalizeUrl(href, origin) : null;
    const image = block.match(/<img[^>]+src="([^"]+)"/)?.[1];
    const imageUrl = image ? normalizeUrl(image, origin) : null;
    const subhead = block.match(/<p class="subheadline">([^<]+)<\/p>/)?.[1]?.trim() ?? null;
    const teaser = block.match(/<div class="teaser_text">\s*<p>([\s\S]*?)<\/p>/)?.[1]?.trim() ?? null;
    const description = [subhead, teaser].filter(Boolean).join(" — ") || null;

    events.push({
      title,
      date,
      time: null,
      end_time: null,
      end_date: null,
      description: description ? truncateHtml(description) : null,
      detail_url: detailUrl,
      image_url: imageUrl,
      price: null,
      category: classifyEvent(title, description) || null,
    });
    m = blockRe.exec(html);
  }
  return events;
}

function parseWeltkulturenDate(text: string): { date: string | null; time: string | null; end_time: string | null } {
  // e.g. "Donnerstag, 14. Mai 2026 - 18:00 - 19:30" or "Samstag, 9. Mai 2026 - 15:00"
  const m = text.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s*(\d{4})\s*-\s*(\d{1,2}:\d{2})(?:\s*-\s*(\d{1,2}:\d{2}))?/);
  if (!m) return { date: null, time: null, end_time: null };
  const month = CARICATURA_GERMAN_MONTHS[m[2].toLowerCase()];
  if (!month) return { date: null, time: null, end_time: null };
  return {
    date: `${m[3]}-${month}-${m[1].padStart(2, "0")}`,
    time: m[4] ?? null,
    end_time: m[5] ?? null,
  };
}

async function fetchWeltkulturen(endpoint: string): Promise<ApiEvent[]> {
  const origin = new URL(endpoint).origin;
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const starts = [...html.matchAll(/class="panel-item[^"]*"/g)];
  const events: ApiEvent[] = [];

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index ?? 0;
    const end = i + 1 < starts.length ? (starts[i + 1].index ?? html.length) : html.length;
    const block = html.slice(start, end);

    const dateText = block.match(/<span\s*class="date">\s*([^<]+)/)?.[1]?.trim() ?? "";
    const { date, time, end_time } = parseWeltkulturenDate(dateText);
    if (!date || date < today) continue;

    const href = block.match(/<a\s+href="([^"]+)"/)?.[1];
    const detailUrl = href ? normalizeUrl(href, origin) : null;

    // Title block: 1–3 lines separated by <br>. Prefer a quoted middle line
    // (the actual programme name) over the all-caps category.
    const bodyMatch = block.match(/<\/span><\/p>\s*<p>\s*([\s\S]*?)<\/p>/);
    const lines = bodyMatch
      ? bodyMatch[1]
          .split(/<br\s*\/?\s*>/i)
          .map((l) =>
            l
              .replace(/<[^>]+>/g, "")
              .replace(/&[a-z]+;|&#\d+;/gi, " ")
              .replace(/\s+/g, " ")
              .trim(),
          )
          .filter(Boolean)
      : [];
    const titleLine = lines.find((l) => /[„"»].*[“"«]/.test(l)) ?? lines[1] ?? lines[0];
    if (!titleLine) continue;

    const description = lines.slice(0, 3).join(" — ") || null;

    events.push({
      title: titleLine,
      date,
      time,
      end_time,
      end_date: null,
      description: description ? truncateHtml(description) : null,
      detail_url: detailUrl,
      image_url: null,
      price: null,
      category: classifyEvent(titleLine, description) || null,
    });
  }
  return events;
}

interface JsonLdEvent {
  "@type"?: string | string[];
  name?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  description?: string;
  image?: string | string[] | { url?: string };
  offers?: { price?: string; priceCurrency?: string } | Array<{ price?: string; priceCurrency?: string }>;
}

function isEventType(t: unknown): boolean {
  if (typeof t === "string") return /Event/.test(t);
  if (Array.isArray(t)) return t.some(isEventType);
  return false;
}

function collectEventJsonLd(html: string): JsonLdEvent[] {
  const out: JsonLdEvent[] = [];
  const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null = re.exec(html);
  while (m !== null) {
    try {
      const data = JSON.parse(m[1].trim()) as unknown;
      const items: unknown[] = Array.isArray(data)
        ? data
        : data && typeof data === "object" && Array.isArray((data as { "@graph"?: unknown[] })["@graph"])
          ? ((data as { "@graph": unknown[] })["@graph"] as unknown[])
          : [data];
      for (const it of items) {
        if (!it || typeof it !== "object") continue;
        const ev = it as JsonLdEvent;
        if (isEventType(ev["@type"])) out.push(ev);
      }
    } catch {}
    m = re.exec(html);
  }
  return out;
}

// Normalize ISO-ish startDate strings like "2026-5-10" or "2026-5-15T19:00+2:00"
// (EventON emits non-zero-padded variants) into "YYYY-MM-DD"+"HH:MM".
function splitJsonLdDate(raw: string): { date: string; time: string | null } | null {
  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const time = m[4] && m[5] ? `${m[4].padStart(2, "0")}:${m[5]}` : null;
  return { date, time };
}

async function fetchEventon(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();
  const today = todayIso();

  const seen = new Set<string>();
  return collectEventJsonLd(html).flatMap((ev): ApiEvent[] => {
    if (!ev.name || !ev.startDate) return [];
    const start = splitJsonLdDate(ev.startDate);
    if (!start || start.date < today) return [];
    const key = `${ev.name}::${start.date}`;
    if (seen.has(key)) return [];
    seen.add(key);

    const end = ev.endDate ? splitJsonLdDate(ev.endDate) : null;
    const offer = Array.isArray(ev.offers) ? ev.offers[0] : ev.offers;
    const image = Array.isArray(ev.image)
      ? ev.image[0]
      : typeof ev.image === "object" && ev.image
        ? ev.image.url
        : ev.image;
    const description = ev.description ? stripHtml(ev.description) : null;
    return [
      {
        title: stripHtml(ev.name),
        date: start.date,
        time: nullIfMidnight(start.time),
        end_time: nullIfMidnight(end?.time ?? null),
        end_date: end && end.date !== start.date ? end.date : null,
        description: description ? truncateHtml(description) : null,
        detail_url: ev.url ?? null,
        image_url: typeof image === "string" ? image : null,
        price: offer?.price ? `${offer.price} ${offer.priceCurrency ?? "EUR"}` : null,
        category: classifyEvent(ev.name, description) || null,
      },
    ];
  });
}

function parseBuergerstiftungTime(text: string): { time: string | null; end_time: string | null } {
  const range = text.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (range) {
    return { time: `${range[1].padStart(2, "0")}:${range[2]}`, end_time: `${range[3].padStart(2, "0")}:${range[4]}` };
  }
  const single = text.match(/(\d{1,2}):(\d{2})/);
  return single
    ? { time: `${single[1].padStart(2, "0")}:${single[2]}`, end_time: null }
    : { time: null, end_time: null };
}

const BUERGERSTIFTUNG_CATEGORY_MAP: Record<string, string> = {
  musik: "Konzert",
  literatur: "Vortrag",
  kinder: "Familie",
  wissenschaft: "Vortrag",
  vortrag: "Vortrag",
  führung: "Führung",
  film: "Film",
};

async function fetchBuergerstiftung(endpoint: string): Promise<ApiEvent[]> {
  const origin = new URL(endpoint).origin;
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const tileRe = /<a\s+class="w__tile[^"]*"\s+data-date="(\d{4}-\d{2}-\d{2})"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const events: ApiEvent[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null = tileRe.exec(html);
  while (m !== null) {
    const [, date, href, body] = m;
    if (date < today) {
      m = tileRe.exec(html);
      continue;
    }
    const dateLine = body.match(/<span class="w__tile--date">([\s\S]*?)<\/span>/)?.[1] ?? "";
    const { time, end_time } = parseBuergerstiftungTime(dateLine.replace(/<[^>]+>/g, " "));
    const title = body
      .match(/<strong class="w__tile--title">([\s\S]*?)<\/strong>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/&[a-z]+;|&#\d+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) {
      m = tileRe.exec(html);
      continue;
    }
    const subtitle =
      body
        .match(/<span class="w__tile--subtitle">([\s\S]*?)<\/span>/)?.[1]
        ?.replace(/<[^>]+>/g, "")
        .replace(/&[a-z]+;|&#\d+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim() ?? null;
    const category = body
      .match(/<strong class="w__tile--category"><span>([^<]+)<\/span>/)?.[1]
      ?.toLowerCase()
      .trim();
    const image = body.match(/<img[^>]+src="([^"]+)"/)?.[1];

    const key = `${title}::${date}`;
    if (seen.has(key)) {
      m = tileRe.exec(html);
      continue;
    }
    seen.add(key);

    events.push({
      title,
      date,
      time,
      end_time,
      end_date: null,
      description: subtitle ? truncateHtml(subtitle) : null,
      detail_url: normalizeUrl(href, origin),
      image_url: image ? normalizeUrl(image, origin) : null,
      price: null,
      category: (category && BUERGERSTIFTUNG_CATEGORY_MAP[category]) || classifyEvent(title, subtitle) || null,
    });
    m = tileRe.exec(html);
  }
  return events;
}

interface SchirnDate {
  date: string;
  end_date: string | null;
  time: string | null;
}

function parseSchirnDate(raw: string): SchirnDate | null {
  const text = raw
    .replace(/&#038;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  // Pattern A: "Sa 09. & So 10. Mai 2026" — same-month range, single year.
  const range = text.match(/(\d{1,2})\.\s*&\s*(?:[A-Za-zÄÖÜäöü.]+\s+)?(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s*(\d{4})/);
  if (range) {
    const month = GERMAN_MONTHS[range[3].toLowerCase()];
    if (month) {
      return {
        date: `${range[4]}-${month}-${range[1].padStart(2, "0")}`,
        end_date: `${range[4]}-${month}-${range[2].padStart(2, "0")}`,
        time: null,
      };
    }
  }

  // Pattern B: "Mittwoch, 10. Juni 2026, 11 Uhr" — full date + time.
  const full = text.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s*(\d{4})(?:[,\s]*(\d{1,2})(?::(\d{2}))?\s*Uhr)?/);
  if (full) {
    const month = GERMAN_MONTHS[full[2].toLowerCase()];
    if (month) {
      const time = full[4] ? `${full[4].padStart(2, "0")}:${full[5] ?? "00"}` : null;
      return {
        date: `${full[3]}-${month}-${full[1].padStart(2, "0")}`,
        end_date: null,
        time,
      };
    }
  }

  // Pattern C: "Di 30. Juni, 19:00 Uhr" — no year, infer it.
  const noYear = text.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)(?:[,\s]+(\d{1,2}):(\d{2})\s*Uhr)?/);
  if (noYear) {
    const month = GERMAN_MONTHS[noYear[2].toLowerCase()];
    if (month) {
      const year = inferYear(month, noYear[1]);
      const time = noYear[3] ? `${noYear[3].padStart(2, "0")}:${noYear[4]}` : null;
      return {
        date: `${year}-${month}-${noYear[1].padStart(2, "0")}`,
        end_date: null,
        time,
      };
    }
  }

  return null;
}

async function fetchSchirn(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  // Schirn renders the date inside either a <span class="event-display"> (main
  // venue) or a Vue custom element <event-display class="event-display">
  // (Bockenheim sub-venue), so match the class regardless of tag name.
  const cardRe =
    /<div[^>]*\bbockenheim-indicator\b[^>]*>([\s\S]*?)<\/div>[\s\S]*?\bevent-display\b[^>]*>\s*([^<]+)[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g;

  const events: ApiEvent[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null = cardRe.exec(html);
  while (m !== null) {
    const isBockenheim = m[1].trim().length > 0;
    const parsed = parseSchirnDate(m[2]);
    const title = m[3]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!parsed || !title || parsed.date < today) {
      m = cardRe.exec(html);
      continue;
    }
    const key = `${title}::${parsed.date}`;
    if (seen.has(key)) {
      m = cardRe.exec(html);
      continue;
    }
    seen.add(key);

    events.push({
      title,
      date: parsed.date,
      time: parsed.time,
      end_time: null,
      end_date: parsed.end_date,
      description: null,
      detail_url: null,
      image_url: null,
      price: null,
      category: classifyEvent(title, null) || null,
      museum_slug_override: isBockenheim ? "schirn-in-bockenheim" : undefined,
    });
    m = cardRe.exec(html);
  }
  return events;
}

interface MmkLocalized {
  de?: string;
  en?: string;
}

interface MmkItem {
  id: number;
  title: MmkLocalized;
  subtitle?: MmkLocalized | false | null;
  path?: string;
  date?: { timestamp?: number; de?: string; en?: string };
  date_end?: { timestamp?: number; de?: string; en?: string } | false | null;
  time?: MmkLocalized | false | null;
  time_end?: MmkLocalized | false | null;
  image?: { src?: string } | false | null;
  related_venues?: Array<{ name?: string }>;
  related_events_categories?: Array<{ name?: string }>;
}

const MMK_VENUE_TO_SLUG: Record<string, string> = {
  museum: "museum-mmk-museum-mmk-fuer-moderne-kunst",
  zollamt: "zollamt-mmk-museum-mmk-fuer-moderne-kunst",
  tower: "tower-mmk-museum-mmk-fuer-moderne-kunst",
};

const MMK_CATEGORY_MAP: Record<string, string> = {
  tour: "Führung",
  kinderfuhrung: "Führung",
  workshop: "Workshop",
  talk: "Vortrag",
  podium: "Vortrag",
  vortrag: "Vortrag",
  lesung: "Vortrag",
  buchvorstellung: "Vortrag",
  symposium: "Vortrag",
  screening: "Film",
  performance: "Konzert",
  eroffnung: "Vernissage",
};

function mmkTimeFromString(raw: string | undefined | null | false): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

async function fetchMmk(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: MmkItem[] };
  const items = data.items ?? [];
  const today = todayIso();
  // The endpoint is the CMS JSON host (cms.mmk.art); detail URLs need to
  // point at the user-facing site so visitors get the rendered page.
  const detailOrigin = new URL(endpoint).origin.replace(/\/\/cms\./, "//www.");

  const events: ApiEvent[] = [];
  for (const it of items) {
    const ts = it.date?.timestamp;
    if (!ts) continue;
    const start = new Date(ts * 1000);
    const date = toBerlinDate(start);
    if (date < today) continue;

    const title = it.title?.de?.trim();
    if (!title) continue;

    const time = mmkTimeFromString(it.time && typeof it.time === "object" ? it.time.de : null);
    const endTime = mmkTimeFromString(it.time_end && typeof it.time_end === "object" ? it.time_end.de : null);

    let endDate: string | null = null;
    if (it.date_end && typeof it.date_end === "object" && it.date_end.timestamp) {
      const ed = toBerlinDate(new Date(it.date_end.timestamp * 1000));
      if (ed !== date) endDate = ed;
    }

    const venueName = it.related_venues?.[0]?.name;
    const slug = venueName ? MMK_VENUE_TO_SLUG[venueName] : undefined;
    const override = slug && slug !== "museum-mmk-museum-mmk-fuer-moderne-kunst" ? slug : undefined;

    const categoryName = it.related_events_categories?.[0]?.name;
    const category =
      (categoryName && MMK_CATEGORY_MAP[categoryName]) ||
      classifyEvent(title, it.subtitle && typeof it.subtitle === "object" ? (it.subtitle.de ?? null) : null) ||
      null;

    const subtitle = it.subtitle && typeof it.subtitle === "object" ? it.subtitle.de?.trim() : null;
    const imageSrc = it.image && typeof it.image === "object" ? it.image.src : null;
    const detailUrl = it.path ? `${detailOrigin}${it.path}` : null;

    events.push({
      title,
      date,
      time,
      end_time: endTime,
      end_date: endDate,
      description: subtitle ? truncateHtml(subtitle) : null,
      detail_url: detailUrl,
      image_url: imageSrc ?? null,
      price: null,
      category,
      museum_slug_override: override,
    });
  }
  return events;
}

const GIERSCH_CATEGORY_MAP: Record<string, string> = {
  event: "Sonstiges",
  film: "Film",
  führung: "Führung",
  "öffentliche führung": "Führung",
  workshop: "Workshop",
  kinderprogramm: "Familie",
  vortrag: "Vortrag",
  konzert: "Konzert",
  vernissage: "Vernissage",
};

async function fetchGiersch(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const blockRe = /<div\s+class="calendar-entry"[\s\S]*?<\/div>\s*<\/a>\s*<\/div>/g;
  const events: ApiEvent[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null = blockRe.exec(html);
  while (m !== null) {
    const block = m[0];
    // The href carries `?event=<unix-timestamp>`, the most reliable date+time source.
    const tsMatch = block.match(/href="([^"]+\?event=(\d+)[^"]*)"/);
    if (!tsMatch) {
      m = blockRe.exec(html);
      continue;
    }
    const detailUrl = tsMatch[1];
    // The site stores wall-clock Berlin times as UTC unix timestamps
    // (e.g. "11:00 Uhr" → 1778410800 = 11:00:00 UTC), so read date and
    // time off the UTC fields directly rather than toBerlin*.
    const start = new Date(parseInt(tsMatch[2], 10) * 1000);
    const date = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
    if (date < today) {
      m = blockRe.exec(html);
      continue;
    }
    const time = nullIfMidnight(
      `${String(start.getUTCHours()).padStart(2, "0")}:${String(start.getUTCMinutes()).padStart(2, "0")}`,
    );

    const title = block
      .match(/<h3 class="entry-title">([\s\S]*?)<\/h3>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/&[a-z]+;|&#\d+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) {
      m = blockRe.exec(html);
      continue;
    }

    const subtitle = block.match(/<p class="entry-subtitle">([^<]+)<\/p>/)?.[1]?.trim() ?? null;
    // The subtitle is a comma-separated category list (e.g. "Event, Führung").
    // Use the first entry as the canonical category.
    const firstCat = subtitle?.split(/[,/]/)[0]?.trim().toLowerCase();
    const category = (firstCat && GIERSCH_CATEGORY_MAP[firstCat]) || classifyEvent(title, subtitle) || null;

    const key = `${title}::${date}`;
    if (seen.has(key)) {
      m = blockRe.exec(html);
      continue;
    }
    seen.add(key);

    events.push({
      title,
      date,
      time,
      end_time: null,
      end_date: null,
      description: null,
      detail_url: detailUrl,
      image_url: null,
      price: null,
      category,
    });
    m = blockRe.exec(html);
  }
  return events;
}

const FFF_CATEGORY_MAP: Record<string, string> = {
  vernissage: "Vernissage",
  eröffnung: "Vernissage",
  workshop: "Workshop",
  "city walk workshop": "Workshop",
  "öffentliche führung": "Führung",
  "öffentliche führung durch": "Führung",
  führung: "Führung",
  galerierundgang: "Führung",
  kuratorinnenführung: "Führung",
  kuratorenführung: "Führung",
  "fff akademie unterwegs": "Vortrag",
  vortrag: "Vortrag",
  talk: "Vortrag",
  "artist talk": "Vortrag",
  buchvorstellung: "Vortrag",
  konzert: "Konzert",
  film: "Film",
  screening: "Film",
};

function classifyFff(prefix: string): string | null {
  const norm = prefix.toLowerCase().trim();
  for (const [key, value] of Object.entries(FFF_CATEGORY_MAP)) {
    if (norm.startsWith(key)) return value;
  }
  return null;
}

interface FffParsed {
  date: string;
  end_date: string | null;
  time: string | null;
  end_time: string | null;
}

function parseFffDateLine(line: string, year: string): FffParsed | null {
  // Strip the optional weekday prefix ("FR, " or "SA/SO, ").
  const stripped = line.replace(/^[A-ZÄÖÜ]{2}(?:\/[A-ZÄÖÜ]{2})?,\s*/, "");

  // Multi-day: "09./10.05." → start 09.05, end 10.05.
  const multiDay = stripped.match(/^(\d{1,2})\.\/(\d{1,2})\.(\d{1,2})\.\s*,?\s*(.*)$/);
  if (multiDay) {
    const month = multiDay[3].padStart(2, "0");
    const date = `${year}-${month}-${multiDay[1].padStart(2, "0")}`;
    const end_date = `${year}-${month}-${multiDay[2].padStart(2, "0")}`;
    const { time, end_time } = parseFffTime(multiDay[4] ?? "");
    return { date, end_date, time, end_time };
  }

  // Single day: "09.05." with optional time.
  const single = stripped.match(/^(\d{1,2})\.(\d{1,2})\.\s*,?\s*(.*)$/);
  if (single) {
    const date = `${year}-${single[2].padStart(2, "0")}-${single[1].padStart(2, "0")}`;
    const { time, end_time } = parseFffTime(single[3] ?? "");
    return { date, end_date: null, time, end_time };
  }

  return null;
}

function parseFffTime(rest: string): { time: string | null; end_time: string | null } {
  // "19 Uhr", "10–17 Uhr", "10:30 Uhr", "10:00–17:30 Uhr", "17 UHR"
  const range = rest.match(/(\d{1,2})(?::(\d{2}))?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*Uhr/i);
  if (range) {
    return {
      time: `${range[1].padStart(2, "0")}:${range[2] ?? "00"}`,
      end_time: `${range[3].padStart(2, "0")}:${range[4] ?? "00"}`,
    };
  }
  const single = rest.match(/(\d{1,2})(?::(\d{2}))?\s*Uhr/i);
  if (single) return { time: `${single[1].padStart(2, "0")}:${single[2] ?? "00"}`, end_time: null };
  return { time: null, end_time: null };
}

async function fetchFff(endpoint: string): Promise<ApiEvent[]> {
  const origin = new URL(endpoint).origin;
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const blockRe =
    /<div\s+data-item-id="(\d+)"\s+class="CustomProduct[^"]*"[^>]*data-archive="(\d{4})"[^>]*>([\s\S]*?)<\/div>\s*(?=<div\s+data-item-id|<\/div>\s*<\/div>)/g;
  const events: ApiEvent[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null = blockRe.exec(html);
  while (m !== null) {
    const [, id, year, body] = m;
    const teaser1 = body
      .match(/<div class="teaserText1">([\s\S]*?)<\/div>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!teaser1) {
      m = blockRe.exec(html);
      continue;
    }

    // Split "{date+time} | {category prefix}" — exhibitions ("AUSSTELLUNG")
    // share the markup but represent a runtime, not an event, so skip them.
    const pipeIdx = teaser1.lastIndexOf("|");
    if (pipeIdx < 0) {
      m = blockRe.exec(html);
      continue;
    }
    const dateLine = teaser1.slice(0, pipeIdx).trim();
    const categoryLine = teaser1.slice(pipeIdx + 1).trim();
    if (/^AUSSTELLUNG\b/i.test(categoryLine)) {
      m = blockRe.exec(html);
      continue;
    }

    const parsed = parseFffDateLine(dateLine, year);
    if (!parsed || parsed.date < today) {
      m = blockRe.exec(html);
      continue;
    }

    const titleRaw =
      body.match(/<div class="title">([\s\S]*?)<\/div>\s*(?:<div class="teaserText2"|<\/div>)/)?.[1] ?? "";
    const title = titleRaw
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;|&#\d+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) {
      m = blockRe.exec(html);
      continue;
    }

    const description = body
      .match(/<div class="teaserText2">([\s\S]*?)<\/div>\s*<\/div>/)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const hrefMatch = body.match(/<a\s+href="([^"]+)"/);
    const detailUrl = hrefMatch ? normalizeUrl(hrefMatch[1], origin) : null;

    const key = `${id}::${parsed.date}`;
    if (seen.has(key)) {
      m = blockRe.exec(html);
      continue;
    }
    seen.add(key);

    events.push({
      title,
      date: parsed.date,
      time: parsed.time,
      end_time: parsed.end_time,
      end_date: parsed.end_date,
      description: description ? truncateHtml(description) : null,
      detail_url: detailUrl,
      image_url: null,
      price: null,
      category: classifyFff(categoryLine) || classifyEvent(title, description ?? null) || null,
    });
    m = blockRe.exec(html);
  }
  return events;
}

interface MmkExhibitionItem extends MmkItem {
  image_large?: { src?: string } | false | null;
}

async function fetchMmkExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json()) as { items_upcoming?: MmkExhibitionItem[] };
  const items = data.items_upcoming ?? [];
  const today = todayIso();
  const detailOrigin = new URL(endpoint).origin.replace(/\/\/cms\./, "//www.");

  const out: ApiExhibition[] = [];
  for (const it of items) {
    const title = it.title?.de?.trim();
    const startTs = it.date?.timestamp;
    const endTs = it.date_end && typeof it.date_end === "object" ? it.date_end.timestamp : undefined;
    if (!title || !startTs) continue;

    const start_date = toBerlinDate(new Date(startTs * 1000));
    const end_date = endTs ? toBerlinDate(new Date(endTs * 1000)) : null;
    if (end_date && end_date < today) continue;

    const venueName = it.related_venues?.[0]?.name;
    const slug = venueName ? MMK_VENUE_TO_SLUG[venueName] : undefined;
    const override = slug && slug !== "museum-mmk-museum-mmk-fuer-moderne-kunst" ? slug : undefined;

    const subtitle = it.subtitle && typeof it.subtitle === "object" ? it.subtitle.de?.trim() : null;
    const image = it.image_large && typeof it.image_large === "object" ? it.image_large.src : null;

    out.push({
      title,
      start_date,
      end_date,
      description: subtitle ? truncateHtml(subtitle) : null,
      detail_url: it.path ? `${detailOrigin}${it.path}` : null,
      image_url: image ?? null,
      museum_slug_override: override,
    });
  }
  return out;
}

interface SchirnRange {
  start_date: string | null;
  end_date: string | null;
}

// "11.06. – 20.09.2026"  →  start 2026-06-11, end 2026-09-20.
// "23.10. – 21.02.2027"  →  start 2026-10-23, end 2027-02-21 (start year inferred).
function parseSchirnNumericRange(text: string): SchirnRange | null {
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.\s*[–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  const [, sd, sm, ed, em, ey] = m;
  const startYearNum = parseInt(em, 10) >= parseInt(sm, 10) ? parseInt(ey, 10) : parseInt(ey, 10) - 1;
  return {
    start_date: `${startYearNum}-${sm.padStart(2, "0")}-${sd.padStart(2, "0")}`,
    end_date: `${ey}-${em.padStart(2, "0")}-${ed.padStart(2, "0")}`,
  };
}

// "Endet am 10. Mai" or "Endet am 10. Mai 2026" — start unknown, end-only.
function parseSchirnEndet(text: string): SchirnRange | null {
  const m = text.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)(?:\s*(\d{4}))?/);
  if (!m) return null;
  const month = GERMAN_MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  const year = m[3] ?? String(inferYear(month, m[1]));
  return { start_date: null, end_date: `${year}-${month}-${m[1].padStart(2, "0")}` };
}

async function fetchSchirnExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  // /programm/ lists currently-running exhibitions (with "Endet am" tags);
  // /programm/kommende-ausstellungen/ lists upcoming ones (with date ranges).
  // Both share the same card markup, so fetch both and dedupe by href.
  const upcomingUrl = new URL("kommende-ausstellungen/", endpoint).toString();
  const [currentRes, upcomingRes] = await Promise.all([
    fetch(endpoint, { headers: { "User-Agent": USER_AGENT } }),
    fetch(upcomingUrl, { headers: { "User-Agent": USER_AGENT } }),
  ]);
  const html = `${currentRes.ok ? await currentRes.text() : ""}\n${upcomingRes.ok ? await upcomingRes.text() : ""}`;

  const today = todayIso();
  const cardRe = /<a\s+href="([^"]+)"\s+class="wp-block-ho-teaser teaser teaser-exhibition[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null = cardRe.exec(html);
  while (m !== null) {
    const [, href, body] = m;
    if (seen.has(href)) {
      m = cardRe.exec(html);
      continue;
    }
    seen.add(href);

    const bockInner = body.match(/<div[^>]*\bbockenheim-indicator\b[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const isBockenheim = bockInner.trim().length > 0;

    const title = body
      .match(/class="[^"]*\bteaser-text-1\b[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/&[a-z]+;|&#\d+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) {
      m = cardRe.exec(html);
      continue;
    }

    const numeric = body.match(/<span class="hide-sm">([^<]+)<\/span>/)?.[1] ?? "";
    const tag = body.match(/<span class="ho-tag-label">[\s\S]*?<\/span>/)?.[0] ?? "";
    const range = parseSchirnNumericRange(numeric) ??
      parseSchirnEndet(tag.replace(/<[^>]+>/g, " ")) ?? { start_date: null, end_date: null };

    if (range.end_date && range.end_date < today) {
      m = cardRe.exec(html);
      continue;
    }

    const image = body.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null;
    const detailUrl = href.startsWith("http") ? href : `https://www.schirn.de${href}`;

    out.push({
      title,
      start_date: range.start_date,
      end_date: range.end_date,
      description: null,
      detail_url: detailUrl,
      image_url: image && /^https?:/.test(image) ? image : null,
      museum_slug_override: isBockenheim ? "schirn-in-bockenheim" : undefined,
    });
    m = cardRe.exec(html);
  }
  return out;
}

async function fetchWeltkulturenExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const origin = new URL(endpoint).origin;
  // /de/ausstellungen/ shows the current exhibition; /de/ausstellungen/vorschau/
  // shows upcoming ones. Both share the same panel-item markup.
  const upcomingUrl = new URL("vorschau/", endpoint).toString();
  const [currentRes, upcomingRes] = await Promise.all([
    fetch(endpoint, { headers: { "User-Agent": USER_AGENT } }),
    fetch(upcomingUrl, { headers: { "User-Agent": USER_AGENT } }),
  ]);
  const html = `${currentRes.ok ? await currentRes.text() : ""}\n${upcomingRes.ok ? await upcomingRes.text() : ""}`;

  const today = todayIso();
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  const starts = [...html.matchAll(/class="panel-item[^"]*"/g)];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index ?? 0;
    const end = i + 1 < starts.length ? (starts[i + 1].index ?? html.length) : html.length;
    const block = html.slice(start, end);

    const href = block.match(/<a\s+href="([^"]+)"/)?.[1];
    if (!href || !/\/de\/ausstellungen\//.test(href) || seen.has(href)) continue;
    seen.add(href);

    const title = block
      .match(/<h2>([\s\S]*?)<\/h2>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/&[a-z]+;|&#\d+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) continue;

    const dateLine = block.match(/<span\s*class="date">\s*([^<]+)/)?.[1]?.trim() ?? "";
    const dateMatch = dateLine.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*bis\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    let start_date: string | null = null;
    let end_date: string | null = null;
    if (dateMatch) {
      start_date = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
      end_date = `${dateMatch[6]}-${dateMatch[5].padStart(2, "0")}-${dateMatch[4].padStart(2, "0")}`;
      if (end_date < today) continue;
    }

    // Description is the <p> body before the date <span>.
    const desc = block
      .match(/<p>\s*([\s\S]*?)<span\s+class="date"/)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;|&#\d+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    out.push({
      title,
      start_date,
      end_date,
      description: desc ? truncateHtml(desc) : null,
      detail_url: normalizeUrl(href, origin),
      image_url: null,
    });
  }
  return out;
}

interface CaricaturaRange {
  start_date: string;
  end_date: string;
}

function parseCaricaturaRange(badge: string): CaricaturaRange | null {
  // "28. November 2025 – 7. Juni 2026" — long German format with month names.
  const long = badge.match(
    /(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s*(\d{4})\s*[–-]\s*(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s*(\d{4})/,
  );
  if (long) {
    const sm = CARICATURA_GERMAN_MONTHS[long[2].toLowerCase()];
    const em = CARICATURA_GERMAN_MONTHS[long[5].toLowerCase()];
    if (sm && em) {
      return {
        start_date: `${long[3]}-${sm}-${long[1].padStart(2, "0")}`,
        end_date: `${long[6]}-${em}-${long[4].padStart(2, "0")}`,
      };
    }
  }
  // "Laufzeit 6.3.2026 – 7.6.2026" — numeric format (with optional Laufzeit prefix).
  const numeric = badge.match(/(?:Laufzeit\s+)?(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (numeric) {
    const [, sd, sm, sy, ed, em, ey] = numeric;
    return {
      start_date: `${sy}-${sm.padStart(2, "0")}-${sd.padStart(2, "0")}`,
      end_date: `${ey}-${em.padStart(2, "0")}-${ed.padStart(2, "0")}`,
    };
  }
  return null;
}

async function fetchCaricaturaExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const origin = new URL(endpoint).origin;
  // Caricatura runs two parallel exhibition strands: a Sonderausstellung
  // and the Caricatura Salon series. Each lives on its own page.
  const sources = [
    new URL("sonderausstellung/", endpoint).toString(),
    new URL("caricatura-salon/", endpoint).toString(),
  ];
  const today = todayIso();
  const out: ApiExhibition[] = [];

  await Promise.all(
    sources.map(async (url) => {
      let html: string;
      try {
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        if (!res.ok) return;
        html = await res.text();
      } catch {
        return;
      }

      const badge = html.match(/<p class="badge">([^<]+)<\/p>/)?.[1]?.trim();
      if (!badge) return;
      const range = parseCaricaturaRange(badge);
      if (!range || range.end_date < today) return;

      const title = html
        .match(/<h2 class="headline">([\s\S]*?)<\/h2>/)?.[1]
        ?.replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&[a-z]+;|&#\d+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!title) return;

      const subhead = html
        .match(/<p class="subheadline">([\s\S]*?)<\/p>/)?.[1]
        ?.replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const teaser = html
        .match(/<div class="teaser_text">\s*(?:<p>\s*<\/p>\s*)*<p>([\s\S]*?)<\/p>/)?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;|&[a-z]+;|&#\d+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const description = [subhead, teaser].filter(Boolean).join(" — ") || null;

      const imageMatch = html.match(/<img[^>]+class="img-responsive"[^>]+src="([^"]+)"/);
      const imageUrl = imageMatch ? normalizeUrl(imageMatch[1], origin) : null;

      out.push({
        title,
        start_date: range.start_date,
        end_date: range.end_date,
        description: description ? truncateHtml(description) : null,
        detail_url: url,
        image_url: imageUrl,
      });
    }),
  );

  return out;
}

interface GierschRange {
  start_date: string;
  end_date: string;
}

// "28.03.2026 - 06.09.2026" or "6.11.26 – 16.5.27" — both year forms.
function parseGierschRange(text: string): GierschRange | null {
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s*[–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return null;
  const [, sd, sm, sy, ed, em, ey] = m;
  const expand = (y: string) => (y.length === 2 ? `20${y}` : y);
  return {
    start_date: `${expand(sy)}-${sm.padStart(2, "0")}-${sd.padStart(2, "0")}`,
    end_date: `${expand(ey)}-${em.padStart(2, "0")}-${ed.padStart(2, "0")}`,
  };
}

async function fetchGierschExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  const push = (entry: ApiExhibition) => {
    if (!entry.detail_url || seen.has(entry.detail_url)) return;
    if (entry.end_date && entry.end_date < today) return;
    seen.add(entry.detail_url);
    out.push(entry);
  };

  // Hero teaser: the currently running exhibition.
  const heroMatch = html.match(
    /<div\s+class="ce\s+ce-hero-teaser[^"]*bgr-primary-exhibition[^"]*"[^>]*>[\s\S]*?<a\s+href="([^"]+)"[\s\S]*?<h4\s+class="teaser-date">([^<]+)<\/h4>[\s\S]*?<h1\s+class="teaser-title">([\s\S]*?)<\/h1>(?:[\s\S]*?<p\s+class="teaser-exerpt">([\s\S]*?)<\/p>)?/,
  );
  if (heroMatch) {
    const range = parseGierschRange(heroMatch[2]);
    if (range) {
      const title = heroMatch[3]
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const subtitle = heroMatch[4]
        ?.replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      push({
        title,
        start_date: range.start_date,
        end_date: range.end_date,
        description: subtitle || null,
        detail_url: heroMatch[1],
        image_url: null,
      });
    }
  }

  // Vorschau cards: each exhibition-teaser block.
  const cardRe =
    /<div\s+class="exhibition-teaser">[\s\S]*?<a\s+href="([^"]+)"[\s\S]*?(?:<img[^>]+src="([^"]+)"[^>]*\/?>[\s\S]*?)?<p\s+class="teaser-date">([^<]+)<\/p>\s*<h3\s+class="teaser-title">([\s\S]*?)<\/h3>(?:\s*<p\s+class="teaser-subtitle">([\s\S]*?)<\/p>)?/g;
  let cm: RegExpExecArray | null = cardRe.exec(html);
  while (cm !== null) {
    const range = parseGierschRange(cm[3]);
    if (range) {
      const title = cm[4]
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const subtitle = cm[5]
        ?.replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      push({
        title,
        start_date: range.start_date,
        end_date: range.end_date,
        description: subtitle || null,
        detail_url: cm[1],
        image_url: cm[2] ?? null,
      });
    }
    cm = cardRe.exec(html);
  }

  return out;
}

async function fetchFffExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const origin = new URL(endpoint).origin;
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const blockRe =
    /<div\s+data-item-id="(\d+)"\s+class="CustomProduct[^"]*"[^>]*data-archive="(\d{4})"[^>]*>([\s\S]*?)<\/div>\s*(?=<div\s+data-item-id|<\/div>\s*<\/div>)/g;
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null = blockRe.exec(html);
  while (m !== null) {
    const [, id, year, body] = m;
    const teaser1 = body
      .match(/<div class="teaserText1">([\s\S]*?)<\/div>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!teaser1) {
      m = blockRe.exec(html);
      continue;
    }

    const pipe = teaser1.lastIndexOf("|");
    if (pipe < 0) {
      m = blockRe.exec(html);
      continue;
    }
    const dateLine = teaser1.slice(0, pipe).trim();
    const category = teaser1.slice(pipe + 1).trim();
    if (!/^AUSSTELLUNG\b/i.test(category)) {
      m = blockRe.exec(html);
      continue;
    }

    // "09.05. – 30.08.2026" — start has no year (assume same as end), end has year.
    const range = dateLine.match(/(\d{1,2})\.(\d{1,2})\.\s*[–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!range) {
      m = blockRe.exec(html);
      continue;
    }
    const [, sd, sm, ed, em, ey] = range;
    const startYear = parseInt(em, 10) >= parseInt(sm, 10) ? parseInt(ey, 10) : parseInt(ey, 10) - 1;
    const start_date = `${startYear}-${sm.padStart(2, "0")}-${sd.padStart(2, "0")}`;
    const end_date = `${ey}-${em.padStart(2, "0")}-${ed.padStart(2, "0")}`;
    if (end_date < today) {
      m = blockRe.exec(html);
      continue;
    }

    const titleRaw =
      body.match(/<div class="title">([\s\S]*?)<\/div>\s*(?:<div class="teaserText2"|<\/div>)/)?.[1] ?? "";
    const title = titleRaw
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;|&#\d+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) {
      m = blockRe.exec(html);
      continue;
    }

    // AUSSTELLUNG cards close with </div></a>; events close with </div></div>.
    const description = body
      .match(/<div class="teaserText2">([\s\S]*?)<\/div>\s*(?:<\/a>|<\/div>)/)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const hrefMatch = body.match(/<a\s+href="([^"]+)"/);
    const detailUrl = hrefMatch ? normalizeUrl(hrefMatch[1], origin) : null;

    const key = `${id}::${start_date}`;
    if (seen.has(key)) {
      m = blockRe.exec(html);
      continue;
    }
    seen.add(key);

    // The data-archive year matches our extracted end year — no use yet.
    void year;

    out.push({
      title,
      start_date,
      end_date,
      description: description ? truncateHtml(description) : null,
      detail_url: detailUrl,
      image_url: null,
    });
    m = blockRe.exec(html);
  }
  return out;
}

interface StaedelExhibition {
  url?: string;
  id?: number;
  title?: string;
}

async function fetchStaedelExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  // The /api/finder endpoint lists exhibition URLs but no dates;
  // each detail page carries a JSON-LD <script @type="Event"> with
  // startDate/endDate, which is the cleanest source.
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const data = (await res.json()) as { exhibitions?: StaedelExhibition[]; aliases?: Record<string, string> };
  const items = data.exhibitions ?? [];
  if (items.length === 0) return [];

  const webBase = data.aliases?.["@web"] || "https://www.staedelmuseum.de";
  const today = todayIso();

  const candidates = items
    .filter((it) => it.url && it.title && !/dauerausstellung|sammlung/i.test(it.title))
    .map((it) => ({
      url: it.url!.startsWith("@web") ? it.url!.replace("@web", webBase) : it.url!,
      title: it.title!,
    }));

  const detailHtmls = await Promise.all(
    candidates.map(async (c) => {
      try {
        const r = await fetch(c.url, { headers: { "User-Agent": USER_AGENT } });
        return r.ok ? await r.text() : null;
      } catch {
        return null;
      }
    }),
  );

  return candidates.flatMap((c, i): ApiExhibition[] => {
    const html = detailHtmls[i];
    if (!html) return [];
    const event = collectEventJsonLd(html).find((e) => /Exhibition|Event/.test(String(e["@type"] ?? "")));
    if (!event) return [];

    const start = event.startDate ? splitJsonLdDate(event.startDate) : null;
    const end = event.endDate ? splitJsonLdDate(event.endDate) : null;
    if (end?.date && end.date < today) return [];

    const image = Array.isArray(event.image)
      ? event.image[0]
      : typeof event.image === "object" && event.image
        ? event.image.url
        : event.image;

    return [
      {
        title: stripHtml(event.name ?? c.title),
        start_date: start?.date ?? null,
        end_date: end?.date ?? null,
        description: event.description ? truncateHtml(stripHtml(event.description)) : null,
        detail_url: event.url ?? c.url,
        image_url: typeof image === "string" ? image : null,
      },
    ];
  });
}

async function fetchLiebieghausExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const origin = new URL(endpoint).origin;
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const itemRe = /<li class="lh-exhibitions__item[^"]*">([\s\S]*?)<\/li>/g;
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null = itemRe.exec(html);
  while (m !== null) {
    const body = m[1];
    const href = body.match(/href="([^"]+)"/)?.[1];
    if (!href || seen.has(href)) {
      m = itemRe.exec(html);
      continue;
    }
    const title = body
      .match(/<div class="lh-teaser__title">([^<]+)<\/div>/)?.[1]
      ?.replace(/&[a-z]+;|&#\d+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const subtitle = body
      .match(/<div class="lh-teaser__subtitle">([^<]+)<\/div>/)?.[1]
      ?.replace(/&ndash;/g, "–")
      .trim();
    if (!title) {
      m = itemRe.exec(html);
      continue;
    }

    // The permanent collections (Antike, Mittelalter, ...) carry no subtitle.
    if (!subtitle) {
      m = itemRe.exec(html);
      continue;
    }

    const range = subtitle.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    let start_date: string | null = null;
    let end_date: string | null = null;
    if (range) {
      start_date = `${range[3]}-${range[2].padStart(2, "0")}-${range[1].padStart(2, "0")}`;
      end_date = `${range[6]}-${range[5].padStart(2, "0")}-${range[4].padStart(2, "0")}`;
      if (end_date < today) {
        m = itemRe.exec(html);
        continue;
      }
    }

    seen.add(href);
    const image = body.match(/data-src-set="([^\s",]+)/)?.[1] ?? null;
    out.push({
      title,
      start_date,
      end_date,
      description: null,
      detail_url: normalizeUrl(href, origin),
      image_url: image ? normalizeUrl(image, origin) : null,
    });
    m = itemRe.exec(html);
  }
  return out;
}

async function fetchHistorischesExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const data = (await res.json()) as { events?: HistorischesEvent[] };
  const events = data.events ?? [];
  if (events.length === 0) return [];

  const today = todayIso();
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  // The /api/calendar?type=specialExhibition feed mixes actual exhibitions
  // with single-day programme entries that share the type. Real exhibitions
  // run for weeks at minimum.
  const MIN_DURATION_SECONDS = 7 * 24 * 60 * 60;

  for (const ev of events) {
    if (!ev.title || !ev.dateStart || !ev.dateEnd) continue;
    if (ev.dateEnd - ev.dateStart < MIN_DURATION_SECONDS) continue;
    const start_date = toBerlinDate(new Date(ev.dateStart * 1000));
    const end_date = toBerlinDate(new Date(ev.dateEnd * 1000));
    if (end_date < today) continue;
    if (HISTORISCHES_TITLE_BLOCKLIST.some((b) => ev.title!.toLowerCase().includes(b))) continue;

    const key = `${ev.title}::${start_date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const locationSlug = ev.locations?.[0] ? HISTORISCHES_LOCATION_SLUGS[ev.locations[0]] : undefined;
    out.push({
      title: ev.title,
      start_date,
      end_date,
      description: ev.summary ? truncateHtml(stripHtml(ev.summary)) : null,
      detail_url: ev.url ?? null,
      image_url: ev.image ?? null,
      museum_slug_override: locationSlug,
    });
  }
  return out;
}

interface SenckenbergExhibition {
  id?: number;
  link?: string;
  title?: { rendered?: string };
  class_list?: string[];
}

async function fetchSenckenbergExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) return [];
  const items = (await res.json()) as SenckenbergExhibition[];
  if (!Array.isArray(items)) return [];

  const today = todayIso();
  // Only Sonderausstellungen (temporary) — Dauerausstellungen and Vorschau are
  // tagged via class_list; the WP REST response carries no dates, so each
  // detail page must be fetched for the runtime.
  const candidates = items
    .filter((it) => it.class_list?.some((c) => c === "exhibition_type-sonderausstellung"))
    .filter((it) => it.link && it.title?.rendered);

  const detailHtmls = await Promise.all(
    candidates.map(async (c) => {
      try {
        const r = await fetch(c.link!, { headers: { "User-Agent": USER_AGENT } });
        return r.ok ? await r.text() : null;
      } catch {
        return null;
      }
    }),
  );

  const out: ApiExhibition[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const html = detailHtmls[i];
    if (!html) continue;

    const dateLine = html
      .match(/<p class="date">([\s\S]*?)<\/p>/)?.[1]
      ?.replace(/&nbsp;|&thinsp;|&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!dateLine) continue;

    const range = dateLine.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*[—–-]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
    if (!range) continue;
    const start_date = `${range[3]}-${range[2].padStart(2, "0")}-${range[1].padStart(2, "0")}`;
    const end_date = `${range[6]}-${range[5].padStart(2, "0")}-${range[4].padStart(2, "0")}`;
    if (end_date < today) continue;

    const title = stripHtml(c.title!.rendered!).trim();
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/)?.[1] ?? null;

    out.push({
      title,
      start_date,
      end_date,
      description: null,
      detail_url: c.link!,
      image_url: ogImage,
    });
  }
  return out;
}

async function fetchJuedischesExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const origin = new URL(endpoint).origin;
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const cardRe = /<a\s+class="m-teaser[^"]*"\s+(?:title="[^"]*"\s+)?href="([^"]+)">([\s\S]*?)<\/a>/g;
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null = cardRe.exec(html);
  while (m !== null) {
    const [, href, body] = m;
    if (seen.has(href)) {
      m = cardRe.exec(html);
      continue;
    }
    const category = body.match(/<p class="m-teaser__category">([^<]+)<\/p>/)?.[1]?.trim();
    if (!category) {
      m = cardRe.exec(html);
      continue;
    }
    // Skip permanent collections and past-exhibition rückblick cards.
    const range = category.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!range) {
      m = cardRe.exec(html);
      continue;
    }
    const start_date = `${range[3]}-${range[2].padStart(2, "0")}-${range[1].padStart(2, "0")}`;
    const end_date = `${range[6]}-${range[5].padStart(2, "0")}-${range[4].padStart(2, "0")}`;
    if (end_date < today) {
      m = cardRe.exec(html);
      continue;
    }

    const title = body
      .match(/<h3[^>]*m-teaser__headline[^>]*>\s*([^<]+)\s*<\/h3>/)?.[1]
      ?.replace(/\s+/g, " ")
      .trim();
    if (!title) {
      m = cardRe.exec(html);
      continue;
    }
    const subline = body.match(/<p class="m-teaser__subline">([^<]+)<\/p>/)?.[1]?.trim() ?? null;
    const imgMatch = body.match(/data-src="([^"]+)"/);
    const imageUrl = imgMatch ? normalizeUrl(imgMatch[1], origin) : null;

    seen.add(href);
    out.push({
      title,
      start_date,
      end_date,
      description: subline ? truncateHtml(subline) : null,
      detail_url: normalizeUrl(href, origin),
      image_url: imageUrl,
    });
    m = cardRe.exec(html);
  }
  return out;
}

interface MakRange {
  start_date: string;
  end_date: string;
}

// MAK runtime strings:
//   "30. Oktober 2025 - 25. Januar 2026"  (cross-year, both fully specified)
//   "7. Februar - 14. Juni 2026"          (same-year, start lacks year)
//   "11. - 27. Februar 2022"              (same-month, start lacks month and year)
function parseMakRange(text: string): MakRange | null {
  const norm = text
    .replace(/ |&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const full = norm.match(
    /(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})\s*[–-]\s*(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})/,
  );
  if (full) {
    const sm = GERMAN_MONTHS[full[2].toLowerCase()];
    const em = GERMAN_MONTHS[full[5].toLowerCase()];
    if (sm && em)
      return {
        start_date: `${full[3]}-${sm}-${full[1].padStart(2, "0")}`,
        end_date: `${full[6]}-${em}-${full[4].padStart(2, "0")}`,
      };
  }

  const sameYear = norm.match(/(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s*[–-]\s*(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})/);
  if (sameYear) {
    const sm = GERMAN_MONTHS[sameYear[2].toLowerCase()];
    const em = GERMAN_MONTHS[sameYear[4].toLowerCase()];
    if (sm && em)
      return {
        start_date: `${sameYear[5]}-${sm}-${sameYear[1].padStart(2, "0")}`,
        end_date: `${sameYear[5]}-${em}-${sameYear[3].padStart(2, "0")}`,
      };
  }

  const sameMonth = norm.match(/(\d{1,2})\.\s*[–-]\s*(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})/);
  if (sameMonth) {
    const m = GERMAN_MONTHS[sameMonth[3].toLowerCase()];
    if (m)
      return {
        start_date: `${sameMonth[4]}-${m}-${sameMonth[1].padStart(2, "0")}`,
        end_date: `${sameMonth[4]}-${m}-${sameMonth[2].padStart(2, "0")}`,
      };
  }

  return null;
}

async function fetchMakExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const origin = new URL(endpoint).origin;
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const itemRe = /<article class="mak-accordion-item mak-event-item">([\s\S]*?)<\/article>/g;
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null = itemRe.exec(html);
  while (m !== null) {
    const body = m[1];
    const title = body
      .match(/<span class="mak-event-heading">([^<]+)<\/span>/)?.[1]
      ?.replace(/\s+/g, " ")
      .trim();
    const dateText = body.match(/<p class="text-inverse">([^<]+)<\/p>/)?.[1];
    if (!title || !dateText) {
      m = itemRe.exec(html);
      continue;
    }

    const range = parseMakRange(dateText);
    if (!range || range.end_date < today) {
      m = itemRe.exec(html);
      continue;
    }

    const href = body.match(/<a href="([^"]+)">Mehr erfahren/)?.[1];
    if (href && /\/dauerausstellungen\//.test(href)) {
      m = itemRe.exec(html);
      continue;
    }

    const detailUrl = href ? normalizeUrl(href, origin) : null;
    const key = detailUrl ?? title;
    if (seen.has(key)) {
      m = itemRe.exec(html);
      continue;
    }
    seen.add(key);

    out.push({
      title,
      start_date: range.start_date,
      end_date: range.end_date,
      description: null,
      detail_url: detailUrl,
      image_url: null,
    });
    m = itemRe.exec(html);
  }
  return out;
}

interface LedermuseumDates {
  start_date: string;
  end_date: string | null;
}

// Ledermuseum date strings:
//   "12. Juni 2026"                          (Vorschau — opening date only)
//   "12. Oktober 2024 bis 25. Januar 2026"    (full runtime)
function parseLedermuseumDates(text: string): LedermuseumDates | null {
  const norm = text.replace(/\s+/g, " ").trim();
  const range = norm.match(
    /(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})\s+bis\s+(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})/,
  );
  if (range) {
    const sm = GERMAN_MONTHS[range[2].toLowerCase()];
    const em = GERMAN_MONTHS[range[5].toLowerCase()];
    if (sm && em)
      return {
        start_date: `${range[3]}-${sm}-${range[1].padStart(2, "0")}`,
        end_date: `${range[6]}-${em}-${range[4].padStart(2, "0")}`,
      };
  }
  const single = norm.match(/(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})/);
  if (single) {
    const m = GERMAN_MONTHS[single[2].toLowerCase()];
    if (m)
      return {
        start_date: `${single[3]}-${m}-${single[1].padStart(2, "0")}`,
        end_date: null,
      };
  }
  return null;
}

async function fetchLedermuseumExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const itemRe = /<a class="item"\s+href="([^"]+)">([\s\S]*?)<\/a>/g;
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null = itemRe.exec(html);
  while (m !== null) {
    const [, href, body] = m;
    if (seen.has(href)) {
      m = itemRe.exec(html);
      continue;
    }
    const dateText = body.match(/<div class="date">\s*<h5>([\s\S]*?)<\/h5>/)?.[1]?.trim();
    if (!dateText) {
      // permanent collection (no date) — skip
      m = itemRe.exec(html);
      continue;
    }

    const dates = parseLedermuseumDates(dateText);
    if (!dates) {
      m = itemRe.exec(html);
      continue;
    }
    if (dates.end_date && dates.end_date < today) {
      m = itemRe.exec(html);
      continue;
    }
    if (!dates.end_date && dates.start_date < today) {
      // single-date entry: only valid as a future opening
      m = itemRe.exec(html);
      continue;
    }

    const h1 = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1];
    const h3 = body.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1];
    const titleParts = [h1, h3]
      .filter((s): s is string => !!s)
      .map((s) =>
        s
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      );
    const title = titleParts.filter(Boolean).join(" ");
    if (!title) {
      m = itemRe.exec(html);
      continue;
    }

    const image = body.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null;

    seen.add(href);
    out.push({
      title,
      start_date: dates.start_date,
      end_date: dates.end_date,
      description: null,
      detail_url: href,
      image_url: image,
    });
    m = itemRe.exec(html);
  }
  return out;
}

async function fetchFkvExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const cardRe = /<a\s+class="tile-link"\s+href="([^"]+)">([\s\S]*?)<\/a>/g;
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null = cardRe.exec(html);
  while (m !== null) {
    const [, href, body] = m;
    if (seen.has(href)) {
      m = cardRe.exec(html);
      continue;
    }
    const title = body
      .match(/<h3 class="archive-title">([^<]+)<\/h3>/)?.[1]
      ?.replace(/&[a-z]+;|&#\d+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const subtitle = body.match(/<p class="subtitle">([^<]+)<\/p>/)?.[1]?.trim();
    if (!title || !subtitle) {
      m = cardRe.exec(html);
      continue;
    }

    const range = subtitle.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[—–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!range) {
      m = cardRe.exec(html);
      continue;
    }
    const start_date = `${range[3]}-${range[2].padStart(2, "0")}-${range[1].padStart(2, "0")}`;
    const end_date = `${range[6]}-${range[5].padStart(2, "0")}-${range[4].padStart(2, "0")}`;
    if (end_date < today) {
      m = cardRe.exec(html);
      continue;
    }

    const image = body.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null;
    seen.add(href);
    out.push({
      title,
      start_date,
      end_date,
      description: null,
      detail_url: href,
      image_url: image,
    });
    m = cardRe.exec(html);
  }
  return out;
}

async function fetchFdhExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const origin = new URL(endpoint).origin;
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const cardRe = /<a\s+href="([^"]+)"\s+class="o-exhibition">([\s\S]*?)<\/a>/g;
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null = cardRe.exec(html);
  while (m !== null) {
    const [, href, body] = m;
    if (seen.has(href)) {
      m = cardRe.exec(html);
      continue;
    }

    const pre = body
      .match(/<p class="e-header__pre">([\s\S]*?)<\/p>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!pre || /Dauerausstellung/i.test(pre)) {
      m = cardRe.exec(html);
      continue;
    }

    // "12.03. – 17.05.2026" — start has no year, end carries it; assume same year.
    const range = pre.match(/(\d{1,2})\.(\d{1,2})\.\s*[–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!range) {
      m = cardRe.exec(html);
      continue;
    }
    const [, sd, sm, ed, em, ey] = range;
    const startYear = parseInt(em, 10) >= parseInt(sm, 10) ? parseInt(ey, 10) : parseInt(ey, 10) - 1;
    const start_date = `${startYear}-${sm.padStart(2, "0")}-${sd.padStart(2, "0")}`;
    const end_date = `${ey}-${em.padStart(2, "0")}-${ed.padStart(2, "0")}`;
    if (end_date < today) {
      m = cardRe.exec(html);
      continue;
    }

    const main = body
      .match(/<h2 class="e-header__main">([\s\S]*?)<\/h2>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const sub = body
      .match(/<h3 class="e-header__sub">([\s\S]*?)<\/h3>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!main) {
      m = cardRe.exec(html);
      continue;
    }
    const title = sub ? `${main}: ${sub}` : main;
    const image = body.match(/<img[^>]+(?:data-src|src)="([^"]+)"/)?.[1] ?? null;

    seen.add(href);
    out.push({
      title,
      start_date,
      end_date,
      description: null,
      detail_url: normalizeUrl(href, origin),
      image_url: image && !image.startsWith("data:") ? normalizeUrl(image, origin) : null,
    });
    m = cardRe.exec(html);
  }
  return out;
}

async function fetchDffExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  // Walk all /ausstellung/{slug}/ links, dedupe, drop the dauerausstellung
  // and virtuelle/online entries — those don't represent dated runs.
  const links = new Set<string>();
  for (const m of html.matchAll(/href="(https:\/\/www\.dff\.film\/ausstellung\/[a-z0-9-]+\/)"/g)) {
    const url = m[1];
    if (/\/dauerausstellung\//.test(url)) continue;
    links.add(url);
  }
  if (links.size === 0) return [];

  const today = todayIso();
  const detailHtmls = await Promise.all(
    [...links].map(async (url) => {
      try {
        const r = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        return r.ok ? { url, html: await r.text() } : null;
      } catch {
        return null;
      }
    }),
  );

  const out: ApiExhibition[] = [];
  for (const entry of detailHtmls) {
    if (!entry) continue;
    const { url, html: detail } = entry;

    // og:description on a Sonderausstellung carries the runtime, e.g.
    //   "Sonderausstellung: 11. März bis 18. Oktober 2026 im DFF – ..."
    const desc = detail.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]+)"/)?.[1];
    if (!desc || !/Sonderausstellung/i.test(desc)) continue;

    const range = desc.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s+bis\s+(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s+(\d{4})/);
    if (!range) continue;
    const sm = GERMAN_MONTHS[range[2].toLowerCase()];
    const em = GERMAN_MONTHS[range[4].toLowerCase()];
    if (!sm || !em) continue;
    const start_date = `${range[5]}-${sm}-${range[1].padStart(2, "0")}`;
    const end_date = `${range[5]}-${em}-${range[3].padStart(2, "0")}`;
    if (end_date < today) continue;

    const ogTitle = detail.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/)?.[1];
    const titleRaw = ogTitle ?? detail.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
    const title = stripHtml(titleRaw)
      .replace(/\s*-\s*DFF\.FILM\s*$/i, "")
      .trim();
    if (!title) continue;

    const ogImage = detail.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/)?.[1] ?? null;
    out.push({
      title,
      start_date,
      end_date,
      description: null,
      detail_url: url,
      image_url: ogImage,
    });
  }
  return out;
}

async function fetchArchaeologischesExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const origin = new URL(endpoint).origin;
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  // Listing page links to /index.php/de/ausstellungen/{slug} — drop archive,
  // dauerausstellung, and self-references; the slug list is short, so fetch
  // all and filter by detected runtime.
  const links = new Set<string>();
  for (const m of html.matchAll(/href="(\/index\.php\/de\/ausstellungen\/[a-z0-9-]+)"/g)) {
    const path = m[1];
    if (/\/(archiv|dauerausstellung|sonderausstellung)/.test(path)) continue;
    links.add(`${origin}${path}`);
  }
  if (links.size === 0) return [];

  const today = todayIso();
  const detailHtmls = await Promise.all(
    [...links].map(async (url) => {
      try {
        const r = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        return r.ok ? { url, html: await r.text() } : null;
      } catch {
        return null;
      }
    }),
  );

  const out: ApiExhibition[] = [];
  for (const entry of detailHtmls) {
    if (!entry) continue;
    const { url, html: detail } = entry;

    // Headline carries the title; first paragraph carries "DD. Monat YYYY – DD. Monat YYYY".
    const title = detail
      .match(/<h1[^>]*itemprop="headline"[^>]*>([\s\S]*?)<\/h1>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) continue;

    const bodyText = detail
      .match(/<div[^>]+itemprop="articleBody"[^>]*>([\s\S]*?)<\/div>/)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ");
    if (!bodyText) continue;

    const range = bodyText.match(
      /(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})\s*[–-]\s*(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})/,
    );
    if (!range) continue;
    const sm = GERMAN_MONTHS[range[2].toLowerCase()];
    const em = GERMAN_MONTHS[range[5].toLowerCase()];
    if (!sm || !em) continue;
    const start_date = `${range[3]}-${sm}-${range[1].padStart(2, "0")}`;
    const end_date = `${range[6]}-${em}-${range[4].padStart(2, "0")}`;
    if (end_date < today) continue;

    const ogImage = detail.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/)?.[1] ?? null;
    out.push({
      title,
      start_date,
      end_date,
      description: null,
      detail_url: url,
      image_url: ogImage,
    });
  }
  return out;
}

async function fetchDamTribeExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();
  // Page renders the same Tribe entries used for events; real exhibitions
  // span weeks at minimum, while single-day workshops share the markup.
  const MIN_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

  for (const ev of collectEventJsonLd(html)) {
    if (!ev.startDate || !ev.endDate) continue;
    const start = new Date(ev.startDate);
    const end = new Date(ev.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (end.getTime() - start.getTime() < MIN_DURATION_MS) continue;

    const start_date = toBerlinDate(start);
    const end_date = toBerlinDate(end);
    if (end_date < today) continue;
    const url = ev.url ?? null;
    if (url && seen.has(url)) continue;
    if (url) seen.add(url);

    const name = stripHtml(ev.name ?? "").trim();
    if (!name) continue;
    const image = Array.isArray(ev.image)
      ? ev.image[0]
      : typeof ev.image === "object" && ev.image
        ? ev.image.url
        : ev.image;

    out.push({
      title: name,
      start_date,
      end_date,
      description: ev.description ? truncateHtml(stripHtml(ev.description)) : null,
      detail_url: url,
      image_url: typeof image === "string" ? image : null,
    });
  }
  return out;
}

interface MfkRange {
  start_date: string | null;
  end_date: string | null;
}

function parseMfkDate(text: string): MfkRange | null {
  const norm = text.replace(/\s+/g, " ").trim();

  // "30. Januar bis 26. Juli 2026" — same year on end (or both fully specified)
  // "9. Oktober 2025 bis 6. September 2026" — both years
  const range = norm.match(
    /(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)(?:\s+(\d{4}))?\s+bis\s+(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})/,
  );
  if (range) {
    const sm = GERMAN_MONTHS[range[2].toLowerCase()];
    const em = GERMAN_MONTHS[range[5].toLowerCase()];
    if (sm && em) {
      const startYear = range[3] ?? range[6];
      return {
        start_date: `${startYear}-${sm}-${range[1].padStart(2, "0")}`,
        end_date: `${range[6]}-${em}-${range[4].padStart(2, "0")}`,
      };
    }
  }

  // "ab 28. Mai 2026" / "seit 3. Dezember 2025"
  const startOnly = norm.match(/(?:ab|seit)\s+(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})/i);
  if (startOnly) {
    const m = GERMAN_MONTHS[startOnly[2].toLowerCase()];
    if (m) return { start_date: `${startOnly[3]}-${m}-${startOnly[1].padStart(2, "0")}`, end_date: null };
  }

  // "ab Oktober 2026" — month-only opening
  const monthOnly = norm.match(/ab\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})/i);
  if (monthOnly) {
    const m = GERMAN_MONTHS[monthOnly[1].toLowerCase()];
    if (m) return { start_date: `${monthOnly[2]}-${m}-01`, end_date: null };
  }

  return null;
}

async function fetchMfkExhibitions(endpoint: string): Promise<ApiExhibition[]> {
  const res = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const html = await res.text();

  const today = todayIso();
  const out: ApiExhibition[] = [];
  const seen = new Set<string>();

  const slideRe =
    /<div class="wp-block-cb-slide-v2[^"]*">[\s\S]*?<a\s+href="(https:\/\/www\.mfk-frankfurt\.de\/[^"]+)"(?:[^>]*)?>[\s\S]*?(?:<img[^>]+(?:src|data-src)="([^"]+)"[^>]*\/?>[\s\S]*?)?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([^<]+)<\/p>/g;

  let m: RegExpExecArray | null = slideRe.exec(html);
  while (m !== null) {
    const [, href, image, titleHtml, dateText] = m;
    if (seen.has(href)) {
      m = slideRe.exec(html);
      continue;
    }
    if (/dauerausstellung|archiv|amateurfunkstation|nachrichten|kunstraeume/i.test(href)) {
      m = slideRe.exec(html);
      continue;
    }

    const range = parseMfkDate(dateText);
    if (!range || !range.start_date) {
      m = slideRe.exec(html);
      continue;
    }
    if (range.end_date && range.end_date < today) {
      m = slideRe.exec(html);
      continue;
    }

    const title = titleHtml
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) {
      m = slideRe.exec(html);
      continue;
    }

    seen.add(href);
    out.push({
      title,
      start_date: range.start_date,
      end_date: range.end_date,
      description: null,
      detail_url: href,
      image_url: image ?? null,
    });
    m = slideRe.exec(html);
  }
  return out;
}
