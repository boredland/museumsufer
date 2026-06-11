import { classifyMusic } from "@museumsufer/classify";
import { decodeEntities, GERMAN_MONTHS, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

// produktionshausnaxos.de rebuilt its site — event cards on the listing page
// no longer carry dates. Dates live only on the individual detail pages inside
// <div class="event-dates">. We collect links from the listing page and fetch
// each detail page to get title + dates.

const BASE = "https://produktionshausnaxos.de";
const SPIELPLAN_URL = `${BASE}/gruppen/naxos-hallenkonzerte/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const EVENT_HREF_RE = /href="(https:\/\/produktionshausnaxos\.de\/event\/[^"]+)"/g;
const DETAIL_TITLE_RE = /<h1[^>]*>([^<]+)<\/h1>/;
const DATE_ENTRY_RE = /<div class="font-bold">\s*<div>([^<]+)<\/div>/g;
// "13. Juni 26, 20:00 Uhr"
const DATE_TIME_PARSE_RE =
  /(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{2}),?\s*(\d{1,2})[:.h](\d{2})\s*Uhr/i;
const OG_IMAGE_RE = /<meta[^>]+property="og:image"[^>]*content="([^"]+)"/;

export async function scrapeNaxos(): Promise<VenueScrapeResult> {
  const html = await fetchText(SPIELPLAN_URL);
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(EVENT_HREF_RE)) {
    const detailUrl = m[1];
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    let detailHtml: string;
    try {
      detailHtml = await fetchText(detailUrl);
    } catch {
      continue;
    }

    const title = clean(detailHtml.match(DETAIL_TITLE_RE)?.[1] ?? "");
    if (!title) continue;

    const imageUrl = detailHtml.match(OG_IMAGE_RE)?.[1] ?? null;
    const slug = `naxos-${slugify(detailUrl.split("/").filter(Boolean).pop() || title)}`;
    const genre = classifyMusic(title, null, null, "experimental");

    for (const dm of detailHtml.matchAll(DATE_ENTRY_RE)) {
      const text = clean(dm[1]);
      const pm = text.match(DATE_TIME_PARSE_RE);
      if (!pm) continue;
      const day = pm[1].padStart(2, "0");
      const month = parseMonth(pm[2]);
      if (!month) continue;
      const year = 2000 + parseInt(pm[3], 10);
      const date = `${year}-${String(month).padStart(2, "0")}-${day}`;
      if (date < today) continue;
      const time = `${pm[4].padStart(2, "0")}:${pm[5]}`;

      events.push({
        source_event_id: `${slug}-${date}`,
        title,
        description: null,
        date,
        time,
        end_time: null,
        detail_url: detailUrl,
        ticket_url: detailUrl,
        image_url: imageUrl,
        raw_category: null,
        labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
      });
    }
  }

  return { source_slug: "naxos-hallenkonzerte", display_name: "Naxos Hallenkonzerte", events };
}

function parseMonth(s: string): number | null {
  return GERMAN_MONTHS[s.toLowerCase().replace(/[^a-zäöü]/g, "")] ?? null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`naxos fetch failed: ${res.status} ${url}`);
  return res.text();
}

function clean(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
