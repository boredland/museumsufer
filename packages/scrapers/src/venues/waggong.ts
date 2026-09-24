import { classifyMusic } from "@museumsufer/classify";
import { decodeEntities, GERMAN_MONTHS, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Waggong e.V. — Kulturwerkstatt Germaniastraße. Hosts amateur and youth
 * ensembles (Big Band, Jazz Ladies, Djembe-Ensemble, …) plus Werkstattkonzerte
 * at the Brotfabrik. Low volume: typically a handful of announced dates.
 *
 * Structure: Kirby CMS teaser grid under "Kommende Events". Each event is a
 * `<div class="event info teaser-item">` with `p.date` ("DD.MM.YYYY"),
 * `h2.heading`, a `div.content` blurb, and a "Mehr Info" detail link. The
 * site moved off WordPress + TablePress in 2026; the old /konzerte-events/
 * URL now redirects here.
 */

const URL = "https://waggong.de/sessions-konzerte";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const ITEM_SPLIT = '<div class="event info teaser-item">';
const DATE_P_RE = /<p\s+class="date">([\s\S]*?)<\/p>/;
const HEADING_RE = /<h2\s+class="heading">([\s\S]*?)<\/h2>/;
const CONTENT_RE = /<div\s+class="content">([\s\S]*?)<\/div>/;
const LINK_RE = /<p\s+class="link--more">\s*<a\s+href="([^"]+)"/;
const IMG_RE = /<img[^>]+src="([^"]+)"/;

const DATE_NUMERIC_RE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
const DATE_WRITTEN_RE = /(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/;
const TIME_RE = /(?:ab\s+)?(\d{1,2})[:.](\d{2})\s*Uhr|(?:ab\s+)?(\d{1,2})\s*Uhr/i;

export async function scrapeWaggong(): Promise<VenueScrapeResult> {
  const html = await fetchText(URL);
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const item of html.split(ITEM_SPLIT).slice(1)) {
    const title = clean(item.match(HEADING_RE)?.[1] ?? "");
    if (!title) continue;

    const date = parseDate(clean(item.match(DATE_P_RE)?.[1] ?? ""));
    if (!date) continue;
    if (date < today) continue;

    const description = clean(item.match(CONTENT_RE)?.[1] ?? "").slice(0, 500) || null;
    const time = description ? parseTime(description) : null;
    const image = item.match(IMG_RE)?.[1];
    const detailUrl = item.match(LINK_RE)?.[1] ?? URL;

    const slug = `waggong-${slugify(title)}-${date}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const genre = classifyMusic(title, null, description, "jazz");

    events.push({
      source_event_id: slug,
      title,
      description,
      date,
      time,
      end_time: null,
      detail_url: detailUrl,
      ticket_url: null,
      image_url: image ?? null,
      labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "waggong", display_name: "Waggong e.V. — Kulturwerkstatt Germaniastraße", events };
}

function parseDate(text: string): string | null {
  const numeric = text.match(DATE_NUMERIC_RE);
  if (numeric) {
    const [, dd, mm, yyyy] = numeric;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const written = text.match(DATE_WRITTEN_RE);
  if (written) {
    const day = parseInt(written[1], 10);
    const month = GERMAN_MONTHS[written[2].toLowerCase()];
    if (!month) return null;
    const year = parseInt(written[3], 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

function parseTime(text: string): string | null {
  const m = text.match(TIME_RE);
  if (!m) return null;
  if (m[1] && m[2]) return `${m[1].padStart(2, "0")}:${m[2]}`;
  if (m[3]) return `${m[3].padStart(2, "0")}:00`;
  return null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`waggong fetch failed: ${res.status}`);
  return res.text();
}

function clean(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
