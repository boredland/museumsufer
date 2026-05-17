import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Land in Sicht Buchladen — Nordend bookshop (Literatur im Stadtteil eV
 * collective) with a regular Lesungen / Vorträge programme. The Aktuelles
 * page embeds each event as a "wp-block-latest-posts__post-title" link
 * with date encoded in the WordPress URL (/YYYY/MM/DD/slug). The body
 * carries an additional "Weekday, DD. Month YYYY, um HH Uhr" line we
 * parse for the time.
 */
const BASE = "https://www.landinsicht.eu";
const LIST_URL = `${BASE}/aktuelles/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const POST_BLOCK_RE =
  /<a\s+class="wp-block-latest-posts__post-title"\s+href="(https:\/\/www\.landinsicht\.eu\/(\d{4})\/(\d{2})\/(\d{2})\/([^/"]+)\/)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a\s+class="wp-block-latest-posts__post-title"|<footer|<\/div>\s*<\/div>\s*<\/article)/g;
const TIME_RE = /(?:um\s+)?(\d{1,2})(?::(\d{2}))?\s*Uhr/i;
const ORT_RE = /<strong>\s*Ort:\s*([\s\S]*?)\s*<\/strong>/i;

export async function scrapeLandinsichtBuchladen(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`landinsicht-buchladen fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(POST_BLOCK_RE)) {
    const detailUrl = m[1];
    const date = `${m[2]}-${m[3]}-${m[4]}`;
    const slug = m[5];
    const titleHtml = m[6];
    const body = m[7];

    if (date < today) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const title = stripHtml(decodeEntities(titleHtml)).trim();
    if (!title) continue;

    const timeMatch = body.match(TIME_RE);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2] ?? "00"}` : null;

    const ort = stripHtml(decodeEntities(body.match(ORT_RE)?.[1] ?? "")).trim() || null;
    // Body text often runs long; the first <p> tag captures the description.
    const firstP = body.match(/<p>\s*([\s\S]*?)\s*<\/p>/);
    const description = firstP ? stripHtml(decodeEntities(firstP[1])).trim().slice(0, 600) || null : null;

    events.push({
      source_event_id: slug,
      title,
      description,
      date,
      time,
      end_date: null,
      end_time: null,
      detail_url: detailUrl,
      ticket_url: null,
      image_url: null,
      venue_room: ort,
      raw_category: null,
      labels: [{ label: "talk:lesung", confidence: 0.85, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "landinsicht-buchladen", display_name: "Land in Sicht Buchladen", events };
}
