import { decodeEntities, normalizeUrl, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Institut français Frankfurt — events.institutfrancais.de Drupal listing.
 * Each card carries everything we need inline: kind, date(s), place, title,
 * intro text. Detail pages are only useful for the full description.
 *
 * The listing is a national portal filtered to /de/frankfurt-am-main/ —
 * cards from other cities (Berlin, Hamburg, …) appear under different URLs
 * and never link to /de/frankfurt-m/event/ so the href filter is enough.
 */
const BASE = "https://www.institutfrancais.de";
const LIST_URL = `${BASE}/de/frankfurt-am-main/veranstaltungen-frankfurt-am-main`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const TEASER_RE =
  /<a\s+class="teaser"\s+href="(\/de\/frankfurt-m\/event\/[^"]+)"[^>]*>([\s\S]*?)<\/a>(?=\s*(?:<a\s+class="teaser"|<\/div>))/g;
const KIND_RE = /<span\s+class="kind"[^>]*>\s*([\s\S]*?)\s*<\/span>/i;
const IMG_RE = /<img[^>]+class="orbit-image"[^>]+src="([^"]+)"/i;
const DATE_RE = /<p\s+class="date">\s*([\s\S]*?)\s*<\/p>/i;
const PLACE_RE = /<p\s+class="place">\s*([\s\S]*?)\s*<\/p>/i;
const INTRO_RE = /<p\s+class="introtext">\s*([\s\S]*?)\s*<\/p>/i;
const DESC_RE = /<\/p>\s*<p>\s*([\s\S]*?)\s*<\/p>/i;
const SLUG_ID_RE = /-(\d+)$/;

const MONTHS_DE: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

interface ParsedDate {
  date: string;
  time: string | null;
  end_date: string | null;
  end_time: string | null;
}

export async function scrapeInstitutFrancaisFrankfurt(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`institut-francais-frankfurt fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(TEASER_RE)) {
    const href = decodeEntities(m[1]);
    const body = m[2];
    const idMatch = href.match(SLUG_ID_RE);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (seen.has(id)) continue;
    seen.add(id);

    const place = stripHtml(body.match(PLACE_RE)?.[1] ?? "")
      .trim()
      .toLowerCase();
    if (!place.includes("frankfurt")) continue;

    const dates = parseDate(stripHtml(body.match(DATE_RE)?.[1] ?? ""));
    if (!dates || (dates.end_date ?? dates.date) < today) continue;

    const title = stripHtml(body.match(INTRO_RE)?.[1] ?? "").trim();
    if (!title) continue;

    const kindRaw = stripHtml(body.match(KIND_RE)?.[1] ?? "").trim();
    const description = stripHtml(body.match(DESC_RE)?.[1] ?? "").trim() || null;
    const imageRaw = body.match(IMG_RE)?.[1] ?? null;
    const image = imageRaw ? normalizeUrl(decodeEntities(imageRaw), BASE) : null;

    events.push({
      source_event_id: id,
      title,
      description,
      date: dates.date,
      time: dates.time,
      end_date: dates.end_date,
      end_time: dates.end_time,
      detail_url: normalizeUrl(href, BASE),
      ticket_url: null,
      image_url: image,
      raw_category: kindRaw || null,
      language: "fr",
      labels: labelsForKind(kindRaw),
    });
  }

  return { source_slug: "institut-francais-frankfurt", display_name: "Institut français Frankfurt", events };
}

function parseDate(text: string): ParsedDate | null {
  if (!text) return null;
  // "21. Februar 2026 - 10. Mai 2026" — date range, no time
  const range = text.match(
    /(\d{1,2})\.\s+([A-Za-zäöüÄÖÜ]+)\s+(\d{4})\s*[-–]\s*(\d{1,2})\.\s+([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/,
  );
  if (range) {
    const start = isoDate(range[1], range[2], range[3]);
    const end = isoDate(range[4], range[5], range[6]);
    if (!start || !end) return null;
    return { date: start, time: null, end_date: end, end_time: null };
  }
  // "01. Mai 2026" or "01. Mai 2026 19:30 - 20:45" (we collapse linebreaks before)
  const single = text.match(
    /(\d{1,2})\.\s+([A-Za-zäöüÄÖÜ]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?)?/,
  );
  if (!single) return null;
  const date = isoDate(single[1], single[2], single[3]);
  if (!date) return null;
  const time = single[4] && single[5] ? `${single[4].padStart(2, "0")}:${single[5]}` : null;
  const end_time = single[6] && single[7] ? `${single[6].padStart(2, "0")}:${single[7]}` : null;
  return { date, time, end_date: null, end_time };
}

function isoDate(day: string, monthName: string, year: string): string | null {
  const m = MONTHS_DE[monthName.toLowerCase().normalize("NFC")];
  if (!m) return null;
  return `${year}-${String(m).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function labelsForKind(kind: string): ScrapedLabel[] {
  const k = kind.toLowerCase();
  if (k === "buch") return [{ label: "talk:lesung", confidence: 0.85, classifier: "upstream-category" }];
  if (k === "kino") return [{ label: "museum:film", confidence: 0.9, classifier: "upstream-category" }];
  if (k === "kunst") return [{ label: "museum:ausstellung", confidence: 0.85, classifier: "upstream-category" }];
  if (k === "konzert") return [{ label: "music:classical", confidence: 0.85, classifier: "upstream-category" }];
  if (k === "vortrag") return [{ label: "talk:vortrag", confidence: 0.85, classifier: "upstream-category" }];
  return [{ label: "talk:vortrag", confidence: 0.5, classifier: "scraper-hardcoded" }];
}
