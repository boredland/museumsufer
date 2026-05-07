import { todayIso } from "../date";
import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, truncate } from "../shared";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://www.diedramatischebuehne.de";
const PROGRAMM_URL = `${BASE}/programm/`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Die Dramatische Bühne uses the Events Made Easy WordPress plugin.
 * `/programm/` renders an `<ul class="eme_events_list">` where every
 * `<li>` is one performance:
 *
 *   <h1><a href=".../veranstaltungen/<slug>"  title="<show title>">…</a></h1>
 *   <h2>DD. Monat YYYY - HH:MM Uhr, <location>[, <room>]</h2>
 *   <a href=".../veranstaltungen/<slug>">Reservieren »</a>
 *   <a href="…"><img src="…" /></a>
 *   <p>…description paragraph…</p>+
 */

const GERMAN_MONTHS: Record<string, number> = {
  Januar: 1,
  Februar: 2,
  März: 3,
  April: 4,
  Mai: 5,
  Juni: 6,
  Juli: 7,
  August: 8,
  September: 9,
  Oktober: 10,
  November: 11,
  Dezember: 12,
};

export async function scrapeDramatischeBuehne(): Promise<ScrapeResult> {
  const res = await fetch(PROGRAMM_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`Dramatische Bühne fetch failed: ${res.status}`);
  return parseDramatischeBuehneHtml(await res.text());
}

const ITEM_RE = /<ul\s+class=['"]eme_events_list['"]>([\s\S]*?)<\/ul>/i;
const LI_RE = /<li>([\s\S]*?)<\/li>/g;
const TITLE_RE = /<h1>\s*<a[^>]+href=['"]([^'"]+)['"][^>]*>\s*([\s\S]*?)\s*<\/a>\s*<\/h1>/i;
const DATE_RE =
  /<h2>\s*(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(\d{4})\s*-\s*(\d{1,2})(?:[.:](\d{2}))?\s*Uhr\s*(?:,\s*([\s\S]*?))?\s*<\/h2>/i;
const IMG_RE = /<img[^>]+\bsrc=['"]([^'"]+)['"][^>]*\bclass=['"]eme_event_image['"]/i;

export function parseDramatischeBuehneHtml(html: string): ScrapeResult {
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  const list = html.match(ITEM_RE)?.[1];
  if (!list) {
    return { theater_slug: "dramatische-buehne", shows: [], performances: [] };
  }

  for (const m of list.matchAll(LI_RE)) {
    const block = m[1];
    const titleMatch = block.match(TITLE_RE);
    const dateMatch = block.match(DATE_RE);
    if (!titleMatch || !dateMatch) continue;

    const detailUrl = decodeEntities(titleMatch[1]);
    const title = stripHtml(titleMatch[2]);
    if (!title) continue;

    const day = parseInt(dateMatch[1], 10);
    const month = GERMAN_MONTHS[dateMatch[2]];
    if (!month) continue;
    const year = parseInt(dateMatch[3], 10);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date < today) continue;

    const hour = dateMatch[4].padStart(2, "0");
    const minute = dateMatch[5] ?? "00";
    const time = nullIfMidnight(`${hour}:${minute}`);

    const locationRaw = dateMatch[6]?.trim() ?? "";
    const venueRoom = parseRoom(locationRaw);

    const showSlug = slugify(title);
    const dedup = `${showSlug}|${date}|${time ?? ""}|${venueRoom ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    if (!showsBySlug.has(showSlug)) {
      const imgSrc = block.match(IMG_RE)?.[1];
      const description = collectDescription(block);
      showsBySlug.set(showSlug, {
        slug: showSlug,
        title,
        subtitle: null,
        description,
        detail_url: normalizeUrl(detailUrl, BASE),
        image_url: imgSrc ? normalizeUrl(imgSrc, BASE) : null,
      });
    }

    performances.push({
      show_slug: showSlug,
      date,
      time,
      end_time: null,
      venue_room: venueRoom,
      provider_event_id: extractEventId(detailUrl),
      ticket_url: normalizeUrl(detailUrl, BASE),
      status: "available",
    });
  }

  return {
    theater_slug: "dramatische-buehne",
    shows: [...showsBySlug.values()],
    performances,
  };
}

/** Location text looks like "Frankfurt am Main, Grüneburgpark" — pick the
 * room/venue (last comma-separated part) when it differs from the city. */
function parseRoom(location: string): string | null {
  if (!location) return null;
  const parts = location
    .split(/\s*,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return parts[0] || null;
  if (/Frankfurt am Main/i.test(parts[0]) && parts.length >= 2) return parts.slice(1).join(", ");
  return parts.join(", ");
}

function collectDescription(block: string): string | null {
  const paragraphs = [...block.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((m) => stripHtml(m[1]))
    .filter((t) => t.length >= 20);
  if (!paragraphs.length) return null;
  return truncate(paragraphs.join("\n"), 800);
}

function extractEventId(url: string): string | null {
  return url.match(/\/veranstaltungen\/([a-z0-9-]+)/i)?.[1] ?? null;
}
