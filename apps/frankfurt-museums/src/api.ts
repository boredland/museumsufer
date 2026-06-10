import { buildIcsCalendar } from "@museumsufer/core";
import { dateOffset, todayIso } from "./date";
import type { Locale } from "./i18n";
import { MUSEUMS } from "./museum-config";
import {
  getAllMuseums,
  getEventCountsByDate,
  getEventsForDate,
  getEventsForRange,
  getExhibitionsForDate,
} from "./queries";
import { APP_URL, escHtml } from "./shared";
import { translateFields } from "./translate";
import type { Env, Event, Exhibition, MuseumInfo } from "./types";

export { getEventCountsByDate, getEventsForDate, getEventsForRange, getExhibitionsForDate };

const CACHE_FEEDS = "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600";

function proxyImageUrl(url: string | null): string | null {
  if (!url?.startsWith("https://")) return null;
  const cleaned = url.split(/\s+/)[0].trim().replace(/&amp;/g, "&");
  if (!cleaned.startsWith("https://")) return null;
  return `/img/${encodeURIComponent(cleaned)}`;
}

export function proxyImages<T extends { image_url?: string | null }>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    image_url: proxyImageUrl(item.image_url ?? null),
  }));
}

export async function handleFeeds(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/feed.xml" || url.pathname === "/rss.xml") {
    const events = await getUpcomingEvents(7);
    return new Response(buildRss(events), {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": CACHE_FEEDS },
    });
  }

  if (url.pathname === "/feed.ics" || url.pathname === "/calendar.ics") {
    const events = await getUpcomingEvents(7);
    return new Response(buildIcs(events), {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": CACHE_FEEDS },
    });
  }

  return null;
}

export async function fetchDayData(
  env: Env,
  date: string,
  locale: Locale,
  endDate?: string,
): Promise<{ date: string; exhibitions: Exhibition[]; events: Event[] }> {
  const [rawExhibitions, rawEvents] = await Promise.all([
    getExhibitionsForDate(date),
    endDate ? getEventsForRange(date, endDate) : getEventsForDate(date),
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

let museumMapCache: { data: Record<string, MuseumInfo>; ts: number } | null = null;

export async function getMuseumMap(): Promise<Record<string, MuseumInfo>> {
  if (museumMapCache && Date.now() - museumMapCache.ts < 3600_000) return museumMapCache.data;

  const map: Record<string, MuseumInfo> = {};
  for (const m of getAllMuseums()) {
    const config = MUSEUMS[m.slug];
    if (config?.hidden) continue;
    const info: MuseumInfo = {
      name: m.name,
      website: m.website_url ?? null,
      description: m.description ?? null,
      image_url: m.image_url ?? null,
    };
    if (config?.name) info.museumsufer = false;
    map[m.slug] = info;
  }
  museumMapCache = { data: map, ts: Date.now() };
  return map;
}

async function getUpcomingEvents(days: number): Promise<(Event & { museum_name: string })[]> {
  const today = todayIso();
  const end = dateOffset(days);
  const events = await getEventsForRange(today, end);
  return events.filter((ev): ev is Event & { museum_name: string } => Boolean(ev.museum_name));
}

function buildRss(events: (Event & { museum_name: string })[]): string {
  const items = events.map((ev) => {
    const timeStr = ev.time ? `, ${ev.time} Uhr` : "";
    const desc = ev.description ? escHtml(ev.description) : "";
    const link = ev.detail_url || ev.url || APP_URL;
    return `    <item>
      <title>${escHtml(ev.title)} — ${escHtml(ev.museum_name)}</title>
      <link>${escHtml(link)}</link>
      <guid isPermaLink="false">museumsufer-${ev.id}</guid>
      <pubDate>${new Date(`${ev.date}T${ev.time || "12:00"}:00`).toUTCString()}</pubDate>
      <description>${escHtml(`${ev.date + timeStr}. ${ev.museum_name}. ${desc}`)}</description>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Museumsufer Frankfurt</title>
    <link>${APP_URL}</link>
    <description>Veranstaltungen am Frankfurter Museumsufer</description>
    <language>de</language>
    <atom:link href="${APP_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>`;
}

export function buildIcs(events: (Event & { museum_name: string })[]): string {
  return buildIcsCalendar({
    prodId: "-//Museumsufer Frankfurt//DE",
    name: "Museumsufer Frankfurt",
    events: events.map((ev) => ({
      uid: `museumsufer-${ev.id}@museumsufer.app`,
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
