import { MuseumApiConfig } from "./museum-apis";
import { toBerlinDate, toBerlinTime, todayIso, dateOffset } from "./date";

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
  }
}

async function fetchTribeEvents(endpoint: string): Promise<ApiEvent[]> {
  const today = todayIso();
  const url = `${endpoint}?per_page=50&start_date=${today}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as { events?: TribeEvent[] };
  if (!data.events) return [];

  return data.events.map((ev): ApiEvent => {
    const endDate = ev.end_date?.slice(0, 10) || null;
    const startDate = ev.start_date?.slice(0, 10) || "";
    return {
      title: stripHtml(ev.title || ""),
      date: startDate,
      time: ev.start_date?.slice(11, 16) || null,
      end_time: ev.end_date?.slice(11, 16) || null,
      end_date: endDate !== startDate ? endDate : null,
      description: stripHtml(ev.excerpt || ev.description || "").slice(0, 300) || null,
      detail_url: ev.url || null,
      image_url: ev.image?.url || null,
      price: ev.cost || null,
    };
  }).filter(ev => ev.title && ev.date);
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
    const date = toBerlinDate(start);
    if (date < todayIso()) return [];

    const timeMatch = ev.time?.match(/(\d{1,2}:\d{2})/);

    let endTime: string | null = null;
    let endDate: string | null = null;
    if (ev.dateEnd) {
      const end = new Date(ev.dateEnd * 1000);
      const ed = toBerlinDate(end);
      endTime = toBerlinTime(end);
      if (ed !== date) endDate = ed;
      if (endTime === "00:00") endTime = null;
    }

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
      end_time: endTime,
      end_date: endDate,
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
    const date = toBerlinDate(start);
    if (date < todayIso()) return [];

    const time = toBerlinTime(start);

    let imageUrl: string | null = null;
    if (ev.image?.src) {
      imageUrl = ev.image.src.startsWith("http")
        ? ev.image.src
        : `https://www.juedischesmuseum.de${ev.image.src}`;
    }

    const location = ev.locationAlt || ev.location || "";
    const isJudengasse = location.toLowerCase().includes("judengasse");

    let endTime: string | null = null;
    if (ev.duration && ev.duration > 0) {
      const endMs = (ev.dateTime + ev.duration * 60) * 1000;
      endTime = toBerlinTime(new Date(endMs));
    }

    return [{
      title: ev.headline.trim(),
      date,
      time: time !== "00:00" ? time : null,
      end_time: endTime,
      end_date: null,
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

    let endTime: string | null = null;
    let endDate: string | null = null;
    if (ev.end) {
      const et = ev.end.slice(11, 16);
      const ed = ev.end.slice(0, 10);
      if (et !== "00:00") endTime = et;
      if (ed !== date) endDate = ed;
    }

    return [{
      title: ev.title || ev.description || "",
      date,
      time: time !== "00:00" ? time : null,
      end_time: endTime,
      end_date: endDate,
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

    let endTime: string | null = null;
    let endDate: string | null = null;
    if (acf.event_stop_time) {
      const ed = acf.event_stop_time.slice(0, 10);
      const et = acf.event_stop_time.slice(11, 16);
      if (et !== "00:00") endTime = et;
      if (ed !== date) endDate = ed;
    }

    return [{
      title,
      date,
      time: time !== "00:00" ? time : null,
      end_time: endTime,
      end_date: endDate,
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

async function fetchMyCalendar(endpoint: string): Promise<ApiEvent[]> {
  const today = todayIso();
  const weekAhead = dateOffset(30);
  const url = `${endpoint}?from=${today}&to=${weekAhead}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as Record<string, MyCalendarEvent[]>;
  if (typeof data !== "object" || Array.isArray(data)) return [];

  const events: ApiEvent[] = [];
  for (const [, dayEvents] of Object.entries(data)) {
    if (!Array.isArray(dayEvents)) continue;
    for (const ev of dayEvents) {
      if (!ev.event_title || !ev.occur_begin) continue;
      if (ev.event_title.startsWith("ENTFÄLLT")) continue;

      const date = ev.occur_begin.slice(0, 10);
      if (date < today) continue;

      const time = ev.event_time && ev.event_time !== "00:00:00"
        ? ev.event_time.slice(0, 5)
        : null;

      const detailUrl = ev.event_post
        ? `https://www.mfk-frankfurt.de/?p=${ev.event_post}`
        : null;

      const endTime = ev.event_endtime && ev.event_endtime !== "00:00:00"
        ? ev.event_endtime.slice(0, 5)
        : null;

      events.push({
        title: ev.event_title,
        date,
        time,
        end_time: endTime,
        end_date: null,
        description: stripHtml(ev.event_short || "").slice(0, 300) || null,
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
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Museumsufer/1.0)" },
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
      const h = parseInt(time.split(":")[0]) + parseInt(durationMatch[1]);
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
  const ua = { "User-Agent": "Mozilla/5.0 (compatible; Museumsufer/1.0)" };
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
        `${dtStart.slice(0,4)}-${dtStart.slice(4,6)}-${dtStart.slice(6,8)}T${dtStart.slice(9,11)}:${dtStart.slice(11,13)}:${dtStart.slice(13,15)}Z`
      );
      const date = toBerlinDate(startDate);
      if (date < todayIso()) continue;
      const time = toBerlinTime(startDate);

      let endTime: string | null = null;
      let endDate: string | null = null;
      if (dtEnd) {
        const endD = new Date(
          `${dtEnd.slice(0,4)}-${dtEnd.slice(4,6)}-${dtEnd.slice(6,8)}T${dtEnd.slice(9,11)}:${dtEnd.slice(11,13)}:${dtEnd.slice(13,15)}Z`
        );
        endTime = toBerlinTime(endD);
        const ed = toBerlinDate(endD);
        if (ed !== date) endDate = ed;
      }

      const detailPath = linkMatch ? linkMatch[1] : null;

      events.push({
        title: summary,
        date,
        time: time !== "00:00" ? time : null,
        end_time: endTime !== "00:00" ? endTime : null,
        end_date: endDate,
        description: desc ? stripHtml(desc).slice(0, 300) : null,
        detail_url: detailPath ? `https://dommuseum-frankfurt.de${detailPath}` : null,
        image_url: imgMatch ? `https://dommuseum-frankfurt.de${imgMatch[1]}` : null,
        price: null,
      });
    } catch {
      continue;
    }
  }

  return events;
}

const GERMAN_MONTHS_SHORT: Record<string, string> = {
  jan: "01", feb: "02", "mär": "03", mar: "03", apr: "04",
  mai: "05", jun: "06", jul: "07", aug: "08",
  sep: "09", okt: "10", nov: "11", dez: "12",
};

const GERMAN_MONTHS_LONG: Record<string, string> = {
  januar: "01", februar: "02", "märz": "03", april: "04",
  mai: "05", juni: "06", juli: "07", august: "08",
  september: "09", oktober: "10", november: "11", dezember: "12",
};

async function fetchMak(endpoint: string): Promise<ApiEvent[]> {
  const res = await fetch(endpoint, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Museumsufer/1.0)" },
  });
  if (!res.ok) return [];
  const html = await res.text();

  const currentYear = new Date().getFullYear();
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

    const date = `${currentYear}-${monthNum}-${day.padStart(2, "0")}`;
    if (date < todayIso()) continue;

    const timeRangeMatch = heading.match(/^(\d{1,2}(?:[.:]\d{2})?)\s*(?:–\s*(\d{1,2}(?:[.:]\d{2})?))?(?:\s*Uhr)?\s*–\s*/);
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

    events.push({
      title: title || heading,
      date,
      time,
      end_time: endTime,
      end_date: null,
      description: subMatch ? subMatch[1].trim() : null,
      detail_url: linkMatch ? `https://www.museumangewandtekunst.de${linkMatch[1]}` : null,
      image_url: null,
      price: null,
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
    const monthNum = GERMAN_MONTHS_LONG[monthName.toLowerCase()];
    if (!monthNum) continue;
    const date = `${year}-${monthNum}-${day.padStart(2, "0")}`;
    if (date < todayIso()) continue;

    const timeMatch = desc.match(/(\d{1,2}:\d{2})\s*Uhr/);
    const endTimeMatch = desc.match(/\d{1,2}:\d{2}\s*Uhr\s*bis\s*(\d{1,2}:\d{2})\s*Uhr/);
    const imgMatch = desc.match(/<img[^>]+src="([^"]+)"/);
    const priceMatch = desc.match(/(\d+\s*€[^<,]*(?:,\s*ermäßigt\s*\d+\s*€)?)/i);

    let image_url: string | null = null;
    if (imgMatch) {
      image_url = imgMatch[1].startsWith("http")
        ? imgMatch[1]
        : `https://www.stadtgeschichte-ffm.de${imgMatch[1]}`;
    }

    events.push({
      title,
      date,
      time: timeMatch ? timeMatch[1] : null,
      end_time: endTimeMatch ? endTimeMatch[1] : null,
      end_date: null,
      description: stripHtml(desc).slice(0, 300) || null,
      detail_url: linkMatch ? linkMatch[1].trim() : null,
      image_url,
      price: priceMatch ? priceMatch[1].trim() : null,
    });
  }

  return events;
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

