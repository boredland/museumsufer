/**
 * Scrape hambacher-schloss.de — Stiftung Hambacher Schloss runs a WordPress
 * site with the Modern Events Calendar (MEC) plugin. The events archive
 * exposes a stable RSS feed at /events/feed/ that carries MEC's custom
 * namespace fields with clean date/time data.
 *
 *   <mec:startDate>2026-05-27</mec:startDate>
 *   <mec:startHour>19:00</mec:startHour>
 *   <mec:endDate>...</mec:endDate>
 *   <mec:endHour>...</mec:endHour>
 *
 * Hambacher Schloss is 8 km from Landau — geographically just outside the
 * city but tightly linked to its identity (the Hambacher Fest is the most
 * famous moment of Pfälzer / Vormärz democratic history). We tag the venue
 * explicitly and let the unified text classifier decide the category
 * (most events are vortrag, ausstellung, gedenken, or feste).
 */
import { decodeEntities, stripHtml, truncate } from "@museumsufer/core";
import { classifyEventByText } from "../categories";
import type { Event, EventSource } from "../types";

const SOURCE: EventSource = "hambacher-schloss";
const FEED_URL = "https://hambacher-schloss.de/events/feed/";
const VENUE = "Hambacher Schloss";

interface MecItem {
  guid: string;
  title: string;
  link: string;
  description?: string;
  imageUrl?: string;
  startDate?: string;
  startHour?: string;
  endDate?: string;
  endHour?: string;
}

export interface HambacherSchlossOptions {
  fetchImpl?: typeof fetch;
}

export async function scrapeHambacherSchloss(opts: HambacherSchlossOptions = {}): Promise<Omit<Event, "id">[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(FEED_URL, { headers: { "User-Agent": "landau-today/1.0" } });
    if (!res.ok) {
      console.warn(`hambacher-schloss: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseFeed(xml).map(toEvent);
  } catch (err) {
    console.warn(`hambacher-schloss: ${(err as Error).message}`);
    return [];
  }
}

function parseFeed(xml: string): MecItem[] {
  const blocks = xml.split(/<item>/i).slice(1);
  const out: MecItem[] = [];
  for (const block of blocks) {
    const body = block.split(/<\/item>/i)[0];
    const item = parseItem(body);
    if (item) out.push(item);
  }
  return out;
}

function parseItem(body: string): MecItem | null {
  const guid = pickCdata(body, /<guid[^>]*>([\s\S]*?)<\/guid>/i);
  const title = pickCdata(body, /<title>([\s\S]*?)<\/title>/i);
  const link = pickCdata(body, /<link>([\s\S]*?)<\/link>/i);
  if (!guid || !title || !link) return null;
  const description = pickCdata(body, /<description>([\s\S]*?)<\/description>/i);
  const contentEncoded = pickCdata(body, /<content:encoded>([\s\S]*?)<\/content:encoded>/i);
  const html = description || contentEncoded || "";
  const imageUrl = match(html, /<img[^>]*src="([^"]+)"/i);
  return {
    guid,
    title: stripHtml(decodeEntities(title)).trim(),
    link: link.trim(),
    description: contentEncoded ? truncate(contentEncoded, 500) || undefined : undefined,
    imageUrl,
    startDate: match(body, /<mec:startDate>\s*([^<\s]+)\s*<\/mec:startDate>/i),
    startHour: match(body, /<mec:startHour>\s*([^<\s]+)\s*<\/mec:startHour>/i),
    endDate: match(body, /<mec:endDate>\s*([^<\s]+)\s*<\/mec:endDate>/i),
    endHour: match(body, /<mec:endHour>\s*([^<\s]+)\s*<\/mec:endHour>/i),
  };
}

function pickCdata(haystack: string, re: RegExp): string | undefined {
  const m = haystack.match(re);
  if (!m) return undefined;
  return m[1]
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "")
    .trim();
}

function match(haystack: string, re: RegExp): string | undefined {
  return haystack.match(re)?.[1];
}

function toEvent(item: MecItem): Omit<Event, "id"> {
  if (!item.startDate) {
    // Fall back to pubDate-style parsing if MEC fields are missing — but
    // RSS pubDate is already the start; pretend it is.
    item.startDate = "";
  }
  const startDate = item.startDate || "";
  const time = normalizeHour(item.startHour);
  const endTime = normalizeHour(item.endHour);
  const endDate = item.endDate && item.endDate !== item.startDate ? item.endDate : undefined;
  const category = classifyEventByText(item.title, item.description);
  return {
    source: SOURCE,
    source_uid: item.guid || item.link,
    title: item.title,
    date: startDate,
    ...(time ? { time } : {}),
    ...(endDate ? { end_date: endDate } : {}),
    ...(endTime ? { end_time: endTime } : {}),
    category,
    venue: VENUE,
    city: "Neustadt-Hambach",
    organizer: "Stiftung Hambacher Schloss",
    ...(item.description ? { description: item.description } : {}),
    detail_url: item.link,
    ...(item.imageUrl ? { image_url: item.imageUrl } : {}),
  };
}

function normalizeHour(h?: string): string | undefined {
  if (!h) return undefined;
  const m = h.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  const hh = m[1].padStart(2, "0");
  if (hh === "00" && m[2] === "00") return undefined;
  return `${hh}:${m[2]}`;
}
