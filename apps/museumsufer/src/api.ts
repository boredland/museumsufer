import { buildIcsCalendar } from "@museumsufer/core";
import { dateOffset, todayIso } from "./date";
import { isDomainAllowed } from "./image-proxy";
import type { Locale } from "./i18n";
import { MUSEUMS } from "./museum-config";
import {
  getAllMuseums,
  getEventCountsByDate,
  getEventsForDate,
  getEventsForRange,
  getExhibitionsForDate,
} from "./queries";
import { escHtml } from "./shared";
import { translateFields } from "./translate";
import type { Env, Event, Exhibition, MuseumInfo } from "./types";

export { getEventCountsByDate, getEventsForDate, getEventsForRange, getExhibitionsForDate };

const CACHE_FEEDS = "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600";

function proxyImageUrl(url: string | null): string | null {
  if (!url?.startsWith("https://")) return null;
  const cleaned = url.split(/\s+/)[0].trim().replace(/&amp;/g, "&");
  if (!cleaned.startsWith("https://")) return null;
  // Don't mint a /img/ URL the proxy will refuse. The allowlist is a snapshot
  // of one scrape and hosts churn in and out between runs, so a feed cached by
  // a reader would otherwise keep pointing at a URL that now 403s. Falling
  // back to the origin URL keeps the image working, exactly as the other five
  // apps do via createImageProxy's `passthroughDisallowed`.
  try {
    if (!isDomainAllowed(new URL(cleaned).hostname)) return cleaned;
  } catch {
    return null;
  }
  return `/img/${encodeURIComponent(cleaned)}`;
}

export function proxyImages<T extends { image_url?: string | null }>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    image_url: proxyImageUrl(item.image_url ?? null),
  }));
}

export async function handleFeeds(request: Request, city = "frankfurt"): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/feed.xml" || url.pathname === "/rss.xml") {
    const events = await getUpcomingEvents(7, city);
    return new Response(buildRss(events, city), {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": CACHE_FEEDS },
    });
  }

  if (url.pathname === "/feed.ics" || url.pathname === "/calendar.ics") {
    const events = await getUpcomingEvents(7, city);
    return new Response(buildIcs(events, city), {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": CACHE_FEEDS },
    });
  }

  return null;
}

/** Frankfurt keeps the SEO-primary host + Museumsufer brand. */
function feedAppUrl(city: string): string {
  return city === "frankfurt" ? "https://museumsufer.app" : `https://${city}.ins.museum`;
}
function feedBrand(city: string): string {
  return city === "frankfurt" ? "Museumsufer Frankfurt" : `${city}.ins.museum`;
}

export async function fetchDayData(
  env: Env,
  date: string,
  locale: Locale,
  endDate?: string,
  city?: string | null,
): Promise<{ date: string; exhibitions: Exhibition[]; events: Event[] }> {
  const [rawExhibitions, rawEvents] = await Promise.all([
    getExhibitionsForDate(date, city),
    endDate ? getEventsForRange(date, endDate, city) : getEventsForDate(date, city),
  ]);
  const exhibitions = proxyImages(rawExhibitions);
  const events = proxyImages(rawEvents);
  if (locale === "de") return { date, exhibitions, events };
  const [trExh, trEv] = await Promise.all([
    translateFields(env, exhibitions, ["title"] as (keyof Exhibition)[], locale),
    translateFields(env, events, ["title", "description"] as (keyof Event)[], locale),
  ]);
  const finalExh = trExh.map((item, i) => {
    const orig = exhibitions[i] as unknown as Record<string, unknown>;
    const cur = item as unknown as Record<string, unknown>;
    return (cur.title !== orig.title ? { ...cur, translated: true } : cur) as unknown as Exhibition;
  });
  const finalEv = trEv.map((item, i) => {
    const orig = events[i] as unknown as Record<string, unknown>;
    const cur = item as unknown as Record<string, unknown>;
    return (cur.title !== orig.title || cur.description !== orig.description
      ? { ...cur, translated: true }
      : cur) as unknown as Event;
  });
  return { date, exhibitions: finalExh, events: finalEv };
}

const museumMapCache = new Map<string, { data: Record<string, MuseumInfo>; ts: number }>();

export async function getMuseumMap(city?: string | null): Promise<Record<string, MuseumInfo>> {
  const key = city ?? "all";
  const cached = museumMapCache.get(key);
  if (cached && Date.now() - cached.ts < 3600_000) return cached.data;

  const map: Record<string, MuseumInfo> = {};
  for (const m of getAllMuseums(city)) {
    const config = MUSEUMS[m.slug];
    if (config?.hidden) continue;
    const info: MuseumInfo = {
      name: m.name,
      website: m.website_url ?? null,
      description: m.description ?? null,
      image_url: m.image_url ?? null,
    };
    // The "not in the Museumsufercard" flag is a Frankfurt-only concept;
    // Hamburg has no equivalent card, so the badge is never set there.
    if (config?.name && (m.city ?? "frankfurt") === "frankfurt") info.museumsufer = false;
    map[m.slug] = info;
  }
  museumMapCache.set(key, { data: map, ts: Date.now() });
  return map;
}

async function getUpcomingEvents(days: number, city = "frankfurt"): Promise<(Event & { museum_name: string })[]> {
  const today = todayIso();
  const end = dateOffset(days);
  const events = await getEventsForRange(today, end, city);
  return events.filter((ev): ev is Event & { museum_name: string } => Boolean(ev.museum_name));
}

function buildRss(events: (Event & { museum_name: string })[], city = "frankfurt"): string {
  const appUrl = feedAppUrl(city);
  const brand = feedBrand(city);
  const items = events.map((ev) => {
    const timeStr = ev.time ? `, ${ev.time} Uhr` : "";
    const desc = ev.description ? escHtml(ev.description) : "";
    const link = ev.detail_url || ev.url || appUrl;
    return `    <item>
      <title>${escHtml(ev.title)} — ${escHtml(ev.museum_name)}</title>
      <link>${escHtml(link)}</link>
      <guid isPermaLink="false">museum-${ev.id}</guid>
      <pubDate>${new Date(`${ev.date}T${ev.time || "12:00"}:00`).toUTCString()}</pubDate>
      <description>${escHtml(`${ev.date + timeStr}. ${ev.museum_name}. ${desc}`)}</description>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escHtml(brand)}</title>
    <link>${appUrl}</link>
    <description>${escHtml(`Veranstaltungen — ${brand}`)}</description>
    <language>de</language>
    <atom:link href="${appUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>`;
}

export function buildIcs(events: (Event & { museum_name: string })[], city = "frankfurt"): string {
  const host = city === "frankfurt" ? "museumsufer.app" : `${city}.ins.museum`;
  return buildIcsCalendar({
    prodId: `-//${feedBrand(city)}//DE`,
    name: feedBrand(city),
    events: events.map((ev) => ({
      uid: `museum-${ev.id}@${host}`,
      date: ev.date,
      time: ev.time ?? null,
      end_date: ev.end_date ?? null,
      end_time: ev.end_time ?? null,
      title: ev.title,
      location: ev.museum_name,
      description: ev.description ?? null,
      detail_url: ev.detail_url ?? ev.url ?? null,
    })),
  });
}

export function markTranslated<T>(originals: T[], translated: T[], lang: string): T[] {
  if (lang === "de") return originals;
  return translated.map((item, i) => {
    const orig = originals[i] as Record<string, unknown>;
    const cur = item as Record<string, unknown>;
    const changed = Object.keys(cur).some((k) => cur[k] !== orig[k]);
    return changed ? ({ ...item, translated: true } as T) : item;
  });
}
