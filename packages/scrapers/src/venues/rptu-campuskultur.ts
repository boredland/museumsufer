import { classifyLandauByText } from "@museumsufer/classify";
import { decodeEntities, stripHtml, toBerlinDate, toBerlinTime, truncate } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Rheinland-Pfälzische Technische Universität publishes a single newsroom
 * RSS feed at /newsroom/veranstaltungen/rss.xml mixing events from both
 * campuses (Kaiserslautern + Landau). Their separate
 * /campuskultur/veranstaltungskalender/rss.xml is served with content-length
 * 0 (broken on their end), so we filter the newsroom feed for Landau mentions
 * in title/description.
 *
 * pubDate is overloaded as the event start time on this feed, not the
 * publication date — the items we get are calendar entries, so the
 * convention works for us.
 */

const FEED_URL = "https://rptu.de/newsroom/veranstaltungen/rss.xml";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  guid?: string;
}

export async function scrapeRptuCampuskultur(): Promise<VenueScrapeResult> {
  try {
    const res = await fetch(FEED_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      console.warn(`rptu-campuskultur: HTTP ${res.status}`);
      return { source_slug: "rptu-campuskultur", display_name: "RPTU Landau – Campuskultur", events: [] };
    }
    const xml = await res.text();
    const items = parseFeed(xml).filter(isLandauRelevant);
    return {
      source_slug: "rptu-campuskultur",
      display_name: "RPTU Landau – Campuskultur",
      events: items.map(toCanonical),
    };
  } catch (err) {
    console.warn(`rptu-campuskultur: ${(err as Error).message}`);
    return { source_slug: "rptu-campuskultur", display_name: "RPTU Landau – Campuskultur", events: [] };
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
 * Items qualify when "Landau" appears in title or description. The feed
 * mixes both campuses — we'd rather miss a few Landau events than pollute
 * the page with Kaiserslautern lectures 60 km away.
 */
function isLandauRelevant(item: RssItem): boolean {
  const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
  return haystack.includes("landau");
}

function toCanonical(item: RssItem): CanonicalScrapedEvent {
  const stripped = item.description ? stripHtml(decodeEntities(item.description)) : "";
  const description = stripped ? truncate(stripped, 500) : null;
  const title = stripHtml(decodeEntities(item.title)).trim();
  const { date, time } = parseRfc822(item.pubDate);
  const category = classifyLandauByText(title, description);

  return {
    source_event_id: item.guid || item.link,
    title,
    description,
    date,
    time: time ?? null,
    detail_url: item.link,
    ticket_url: null,
    image_url: null,
    price_min: null,
    price_max: null,
    performers: "RPTU Kaiserslautern-Landau",
    venue_room: "RPTU Landau",
    city: "Landau in der Pfalz",
    labels: [{ label: `region:landau:${category}`, confidence: 0.75, classifier: "keyword:landau" }],
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
