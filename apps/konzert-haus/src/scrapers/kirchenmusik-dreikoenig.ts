import {
  dateOffset,
  decodeEntities,
  GERMAN_MONTHS,
  normalizeUrl,
  slugify,
  stripHtml,
  todayIso,
} from "@museumsufer/core";
import { classify } from "../genre-heuristics";
import type { ScrapedEvent, ScrapeResult } from "../types";

const BASE = "https://www.kirchenmusik-dreikoenig.de";
const YEAR_PATH = "/de/konzertprogramm/konzertkalender/Events%20nach%20Jahr";
const UA = "konzert.haus crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;

/**
 * Same JEvents (Joomla) backend as andreas-koehs.de but a different content
 * subset focused on Dreikönigskirche. The dreikoenigsgemeinde.de TLS
 * endpoint negotiates a stack that bun/curl reject, so the dedicated music
 * site is the only reliable upstream.
 */
const ITEM_RE =
  /<li class='ev_td_li'[^>]*>([\s\S]*?)<a class="ev_link_row" href="([^"]+)" title="([^"]*)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/li>/g;
const DATE_RE = /\w+,\s*(\d{1,2})\.\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*Uhr(?:\s*[-–]\s*(\d{1,2}):(\d{2})\s*Uhr)?/;
const CATEGORY_RE = /::\s*([^<]+?)\s*<\/li>/;

export async function scrapeKirchenmusikDreikoenig(): Promise<ScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(180);
  const currentYear = parseInt(today.slice(0, 4), 10);
  const horizonYear = parseInt(horizon.slice(0, 4), 10);

  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (let year = currentYear; year <= horizonYear; year++) {
    const url = `${BASE}${YEAR_PATH}/${year}/-?limit=200`;
    const html = await fetchText(url);

    for (const raw of parseItems(html, today, horizon)) {
      if (seen.has(raw.slug)) continue;
      seen.add(raw.slug);
      events.push(raw);
    }

    if (year < horizonYear) await sleep(THROTTLE_MS);
  }

  return { venue_slug: "kirchenmusik-dreikoenig", events };
}

function parseItems(html: string, today: string, horizon: string): ScrapedEvent[] {
  const out: ScrapedEvent[] = [];
  for (const m of html.matchAll(ITEM_RE)) {
    const dateText = stripHtml(m[1]);
    const href = decodeEntities(m[2]);
    const titleAttr = decodeEntities(m[3]);
    const tail = m[5];

    const dm = DATE_RE.exec(dateText);
    if (!dm) continue;
    const month = GERMAN_MONTHS[dm[2].toLowerCase()];
    if (!month) continue;
    const date = `${dm[3]}-${String(month).padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    if (date < today || date > horizon) continue;

    const time = `${dm[4].padStart(2, "0")}:${dm[5]}`;
    const endTime = dm[6] && dm[7] ? `${dm[6].padStart(2, "0")}:${dm[7]}` : null;

    const parts = splitTitleParts(titleAttr);
    if (!parts.title) continue;

    const category = CATEGORY_RE.exec(tail)?.[1]?.trim() || null;
    const detailUrl = normalizeUrl(href, BASE);
    const slug = slugFromDetail(href) ?? slugify(`${date}-${parts.title}`);

    out.push({
      slug,
      title: parts.title,
      subtitle: parts.performers || category,
      description: null,
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      genre: classify(parts.title, parts.performers, category, "sacred"),
      image_url: null,
      detail_url: detailUrl,
      ticket_url: null,
      price_min: null,
      price_max: null,
      venue_room: parts.venue,
      performers: parts.performers,
    });
  }
  return out;
}

function splitTitleParts(title: string): { title: string; performers: string | null; venue: string | null } {
  const segments = title
    .split(/\s*\|\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return { title: "", performers: null, venue: null };
  if (segments.length === 1) return { title: segments[0], performers: null, venue: null };
  const venue = segments[segments.length - 1];
  const head = segments[0];
  const performers = segments.length >= 3 ? segments.slice(1, -1).join(" · ") : null;
  return { title: head, performers, venue };
}

function slugFromDetail(href: string): string | null {
  const m = /Eventdetail\/(\d+)\/[^/]*\/([^?]+)/.exec(href);
  if (!m) return null;
  return `${m[1]}-${m[2]}`
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "de-DE,de;q=0.9" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`kirchenmusik-dreikoenig fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
