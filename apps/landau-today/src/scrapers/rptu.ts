/**
 * Scrape rptu.de — Rheinland-Pfälzische Technische Universität publishes
 * a single newsroom RSS feed at /newsroom/veranstaltungen/rss.xml that
 * mixes events from both campuses (Kaiserslautern + Landau). Their separate
 * /campuskultur/veranstaltungskalender/rss.xml advertised in the page is
 * served with content-length 0 (broken on their end), so we work off the
 * newsroom feed and filter by Landau mentions in title/description.
 *
 * pubDate is overloaded as the event start time on this feed, not the
 * publication date — the items we get are calendar entries, so the
 * convention works for us.
 */
import { decodeEntities, stripHtml, truncate } from "@museumsufer/core";
import { classifyEventByText } from "../categories";
import { toBerlinDate, toBerlinTime } from "../date";
import type { Event, EventSource } from "../types";

const SOURCE: EventSource = "rptu-campuskultur";
const FEED_URL = "https://rptu.de/newsroom/veranstaltungen/rss.xml";

interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  guid?: string;
}

export interface RptuScrapeOptions {
  fetchImpl?: typeof fetch;
}

export async function scrapeRptu(opts: RptuScrapeOptions = {}): Promise<Omit<Event, "id">[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(FEED_URL, { headers: { "User-Agent": "landau-today/1.0" } });
    if (!res.ok) {
      console.warn(`rptu: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = parseFeed(xml);
    const landauItems = items.filter(isLandauRelevant);
    return landauItems.map(toEvent);
  } catch (err) {
    console.warn(`rptu: ${(err as Error).message}`);
    return [];
  }
}

function parseFeed(xml: string): RssItem[] {
  const blocks = xml.split(/<item>/i).slice(1);
  const out: RssItem[] = [];
  for (const block of blocks) {
    const body = block.split(/<\/item>/i)[0];
    const title = pickText(body, /<title>([\s\S]*?)<\/title>/i);
    const link = pickText(body, /<link>([\s\S]*?)<\/link>/i);
    if (!title || !link) continue;
    out.push({
      title,
      link,
      description: pickText(body, /<description>([\s\S]*?)<\/description>/i),
      pubDate: pickText(body, /<pubDate>([\s\S]*?)<\/pubDate>/i),
      guid: pickText(body, /<guid[^>]*>([\s\S]*?)<\/guid>/i),
    });
  }
  return out;
}

function pickText(haystack: string, re: RegExp): string | undefined {
  const m = haystack.match(re);
  if (!m) return undefined;
  return m[1]
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "")
    .trim();
}

/**
 * Items qualify when "Landau" appears in title or first chunk of description.
 * The feed mixes both campuses — we'd rather miss a few Landau events than
 * pollute the page with Kaiserslautern lectures 60 km away.
 */
function isLandauRelevant(item: RssItem): boolean {
  const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
  return haystack.includes("landau");
}

function toEvent(item: RssItem): Omit<Event, "id"> {
  const stripped = item.description ? stripHtml(decodeEntities(item.description)) : "";
  const description = stripped ? truncate(stripped, 500) || undefined : undefined;
  const title = stripHtml(decodeEntities(item.title)).trim();
  const { date, time } = parseRfc822(item.pubDate);
  const category = classifyEventByText(title, description);
  return {
    source: SOURCE,
    source_uid: item.guid || item.link,
    title,
    date,
    ...(time ? { time } : {}),
    category,
    venue: "RPTU Landau",
    organizer: "RPTU Kaiserslautern-Landau",
    ...(description ? { description } : {}),
    detail_url: item.link,
  };
}

function parseRfc822(s?: string): { date: string; time?: string } {
  if (!s) return { date: "" };
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return { date: "" };
  const date = toBerlinDate(d);
  const time = toBerlinTime(d);
  return { date, time: time === "00:00" ? undefined : time };
}
