import { classifyEvent, classifyTalk, eventTypeToLabel } from "@museumsufer/classify";
import { decodeEntities, normalizeUrl, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Crespo Foundation — privately funded Frankfurt foundation for arts,
 * cultural education and personality development. Their Nuxt/Vue
 * homepage embeds the event list as plain HTML cards plus a JSON blob;
 * we parse the cards. Cards from Ireland (Glenkeen Garden Residencies)
 * filter out via the city prefix span — only "Frankfurt" and the
 * foundation's "Open Space" (Crespo Haus) make it through.
 */
const BASE = "https://www.crespo-foundation.de";
const LIST_URL = `${BASE}/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const EVENT_CARD_RE = /<a\s+href="(\/de\/events\/[^"]+)"\s+class="[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
const TITLE_RE = /<h2[^>]*>\s*([\s\S]*?)\s*<\/h2>/;
const CITY_RE = /<span\s+class="(os|ireland|)?"?>\s*([^<]+?)\s*<\/span>/;
const DATE_TIME_RE = /<p\s+class="my-0\.5">\s*([\s\S]*?)\s*<\/p>/;

interface ParsedDate {
  date: string;
  time: string | null;
  end_date: string | null;
  end_time: string | null;
}

export async function scrapeCrespoFoundation(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`crespo-foundation fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(EVENT_CARD_RE)) {
    const href = m[1];
    const block = m[2];

    const cityMatch = block.match(CITY_RE);
    const cityClass = cityMatch?.[1] ?? "";
    const cityText = cityMatch?.[2] ?? "";
    // Keep Frankfurt and the Crespo Haus Open Space; drop Ireland and any
    // other partner-venue cards we add later.
    if (cityClass !== "os" && !/frankfurt/i.test(cityText)) continue;

    const title = stripHtml(decodeEntities(block.match(TITLE_RE)?.[1] ?? "")).trim();
    if (!title) continue;

    const dateText = stripHtml(decodeEntities(block.match(DATE_TIME_RE)?.[1] ?? "")).trim();
    const parsed = parseDate(dateText);
    if (!parsed) continue;
    if ((parsed.end_date ?? parsed.date) < today) continue;

    const slug = href.split("/").pop() || title;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const venueRoom = cityClass === "os" ? "Crespo Open Space" : null;

    events.push({
      source_event_id: slug,
      title,
      description: null,
      date: parsed.date,
      time: parsed.time,
      end_date: parsed.end_date,
      end_time: parsed.end_time,
      detail_url: normalizeUrl(href, BASE),
      ticket_url: null,
      image_url: null,
      venue_room: venueRoom,
      raw_category: cityClass === "os" ? "Open Space" : cityText,
      labels: [labelFor(title)],
    });
  }

  return { source_slug: "crespo-foundation", display_name: "Crespo Foundation", events };
}

function parseDate(text: string): ParsedDate | null {
  if (!text) return null;
  // Strip leading weekday ("So., ", "Fr., "). The trailing comma is part
  // of the weekday segment, not the date.
  const cleaned = text.replace(/^[A-Za-zäöü]{2,4}\.,\s*/, "");

  // "13.05.-13.06.2026, verschiedene Öffnungszeiten" — multi-day exhibition.
  const range = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (range) {
    const year = range[5];
    const startMonth = parseInt(range[2], 10);
    const endMonth = parseInt(range[4], 10);
    const startYear = startMonth > endMonth ? String(parseInt(year, 10) - 1) : year;
    return {
      date: `${startYear}-${range[2].padStart(2, "0")}-${range[1].padStart(2, "0")}`,
      time: null,
      end_date: `${year}-${range[4].padStart(2, "0")}-${range[3].padStart(2, "0")}`,
      end_time: null,
    };
  }
  // "17.05.2026, 18 Uhr" or "22.05.2026, 14–18 Uhr" or "20.06.2026, 11 bis 22 Uhr"
  const single = cleaned.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,\s*(\d{1,2})(?::(\d{2}))?\s*(?:[-–]|bis)\s*(\d{1,2})(?::(\d{2}))?|,\s*(\d{1,2})(?::(\d{2}))?)?/,
  );
  if (single) {
    const date = `${single[3]}-${single[2].padStart(2, "0")}-${single[1].padStart(2, "0")}`;
    const startH = single[4] ?? single[8];
    const startM = single[5] ?? single[9];
    const endH = single[6];
    const endM = single[7];
    const time = startH ? `${startH.padStart(2, "0")}:${startM ?? "00"}` : null;
    const end_time = endH ? `${endH.padStart(2, "0")}:${endM ?? "00"}` : null;
    return { date, time, end_date: null, end_time };
  }
  return null;
}

function labelFor(title: string): ScrapedLabel {
  const type = classifyEvent(title, null);
  if (type === "Vortrag") {
    const sub = classifyTalk(title).toLowerCase();
    return { label: `talk:${sub}`, confidence: 0.85, classifier: "keyword:event" };
  }
  const mapped = eventTypeToLabel(type);
  if (mapped) return { label: mapped, confidence: 0.85, classifier: "keyword:event" };
  return { label: "museum:event", confidence: 0.5, classifier: "scraper-hardcoded" };
}
