import { classifyMusic } from "@museumsufer/classify";
import {
  dateOffset,
  decodeEntities,
  GERMAN_MONTHS,
  normalizeUrl,
  slugify,
  stripHtml,
  todayIso,
} from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.andreas-koehs.de";
const YEAR_PATH = "/de/konzertprogramm/konzertkalender/Events%20nach%20Jahr";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;

/**
 * JEvents (Joomla) backend: /Events nach Jahr/YYYY/- exposes the full year's
 * program as a paginated list, collapsed into one fetch with ?limit=200.
 * The horizon (today + 180d) can straddle a year boundary near year-end, so
 * the loop walks every year touched by [today, horizon]. Koehs's programme
 * is almost exclusively sacred music in Frankfurt churches, so we default
 * the fallback to `sacred` for the music label.
 */
const ITEM_RE =
  /<li class='ev_td_li'[^>]*>([\s\S]*?)<a class="ev_link_row" href="([^"]+)" title="([^"]*)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/li>/g;
const DATE_RE = /\w+,\s*(\d{1,2})\.\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*Uhr(?:\s*[-–]\s*(\d{1,2}):(\d{2})\s*Uhr)?/;
const CATEGORY_RE = /::\s*([^<]+?)\s*<\/li>/;

export async function scrapeAndreasKoehs(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(180);
  const currentYear = parseInt(today.slice(0, 4), 10);
  const horizonYear = parseInt(horizon.slice(0, 4), 10);

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (let year = currentYear; year <= horizonYear; year++) {
    const url = `${BASE}${YEAR_PATH}/${year}/-?limit=200`;
    const html = await fetchText(url);

    for (const raw of parseItems(html, today, horizon)) {
      if (seen.has(raw.source_event_id)) continue;
      seen.add(raw.source_event_id);
      events.push(raw);
    }

    if (year < horizonYear) await sleep(THROTTLE_MS);
  }

  return { source_slug: "andreas-koehs", display_name: "Kirchenmusik Andreas Köhs", events };
}

function parseItems(html: string, today: string, horizon: string): CanonicalScrapedEvent[] {
  const out: CanonicalScrapedEvent[] = [];
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
    const genre = classifyMusic(parts.title, parts.performers, category, "sacred");

    out.push({
      source_event_id: slug,
      title: parts.title,
      subtitle: parts.performers || category,
      description: null,
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      detail_url: detailUrl,
      ticket_url: null,
      image_url: null,
      price_min: null,
      price_max: null,
      performers: parts.performers,
      venue_room: parts.venue,
      raw_category: category,
      labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }
  return out;
}

/** JEvents titles encode "TITLE || [PERFORMERS ||] VENUE" — the last segment
 *  is always the church name in CAPS; one optional middle segment names the
 *  performers. */
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
  if (!res.ok) throw new Error(`andreas-koehs fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
