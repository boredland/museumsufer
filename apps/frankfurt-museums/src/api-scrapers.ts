import { dateOffset, inferYear, toBerlinDate, toBerlinTime, todayIso } from "./date";
import { proxyFetch } from "./fetch-utils";
import type { EventApiType, ProxyConfig } from "./museum-config";
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
