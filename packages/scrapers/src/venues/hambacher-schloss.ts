import { classifyLandauByText } from "@museumsufer/classify";
import { decodeEntities, stripHtml, truncate } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Stiftung Hambacher Schloss runs WordPress + Modern Events Calendar. The
 * events archive feed at /events/feed/ carries MEC's custom-namespace
 * `<mec:startDate>` etc. fields with clean date/time data.
 *
 * Hambacher Schloss is 8 km from Landau — geographically just outside the
 * city but tightly linked to its identity (Hambacher Fest, Pfälzer/Vormärz
 * democratic history). Venue is hardcoded; category is text-classified.
 */

const FEED_URL = "https://hambacher-schloss.de/events/feed/";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
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

export async function scrapeHambacherSchloss(): Promise<VenueScrapeResult> {
  try {
    const res = await fetch(FEED_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      console.warn(`hambacher-schloss: HTTP ${res.status}`);
      return { source_slug: "hambacher-schloss", display_name: "Hambacher Schloss", events: [] };
    }
    const xml = await res.text();
    const events = parseFeed(xml).map(toCanonical);
    return { source_slug: "hambacher-schloss", display_name: "Hambacher Schloss", events };
  } catch (err) {
    console.warn(`hambacher-schloss: ${(err as Error).message}`);
    return { source_slug: "hambacher-schloss", display_name: "Hambacher Schloss", events: [] };
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

function toCanonical(item: MecItem): CanonicalScrapedEvent {
  const startDate = item.startDate ?? "";
  const time = normalizeHour(item.startHour);
  const endTime = normalizeHour(item.endHour);
  const endDate = item.endDate && item.endDate !== item.startDate ? item.endDate : null;
  const category = classifyLandauByText(item.title, item.description);

  return {
    source_event_id: item.guid || item.link,
    title: item.title,
    description: item.description ?? null,
    date: startDate,
    time: time ?? null,
    end_date: endDate,
    end_time: endTime ?? null,
    detail_url: item.link,
    ticket_url: null,
    image_url: item.imageUrl ?? null,
    price_min: null,
    price_max: null,
    performers: "Stiftung Hambacher Schloss",
    venue_room: VENUE,
    city: "Neustadt-Hambach",
    labels: [{ label: `region:landau:${category}`, confidence: 0.75, classifier: "keyword:landau" }],
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
