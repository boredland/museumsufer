import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.theaterheidelberg.de";
const CALENDAR_URL = `${BASE}/de/kalender/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.4128;
const LON = 8.708;

/**
 * Theater und Orchester Heidelberg — five-section house (music theatre,
 * theatre, dance, young theatre, concerts). The public calendar is a
 * server-rendered list of `<div class="calendar-item">` blocks, each preceded
 * by a `calendar-section__day` marker carrying the ISO date. A block exposes
 * time, venue room, category, title/detail link, subtitle and ticket status.
 * Tickets are sold through an Eventim in-house shop.
 */
export async function scrapeTheaterHeidelberg(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(CALENDAR_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Theater Heidelberg fetch failed: ${res.status}`);
  const html = await res.text();

  const events = parseCalendar(html, today);
  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return {
    source_slug: "theater-heidelberg",
    display_name: "Theater und Orchester Heidelberg",
    events,
  };
}

function parseCalendar(html: string, today: string): CanonicalScrapedEvent[] {
  const out: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Items are siblings of their day heading rather than nested under it, so
  // anchor each one to the nearest preceding `calendar-section__day` marker.
  const dateMarkers = [...html.matchAll(/class="calendar-section__day[^"]*"\s+data-date="(\d{4}-\d{2}-\d{2})"/gi)].map(
    (m) => ({ idx: m.index ?? 0, date: m[1] }),
  );

  const itemRe =
    /<div class="calendar-item">([\s\S]*?)(?=<div class="calendar-item">|<div class="calendar-section__day|$)/gi;
  for (const im of html.matchAll(itemRe)) {
    const block = im[1];
    if (!block) continue;

    const pos = im.index ?? 0;
    let date: string | null = null;
    for (const dm of dateMarkers) {
      if (dm.idx < pos) date = dm.date;
      else break;
    }
    if (!date || date < today) continue;

    const detailHref = extractFirst(block, /<a\s+href="(\/de\/produktionen\/[^"]+)"\s+class="calendar-item__title"/i);
    const title = cleanText(extractFirst(block, /class="calendar-item__title"[^>]*>\s*<span>([\s\S]*?)<\/span>/i));
    if (!title) continue;

    const { startTime, endTime } = parseTimeLine(
      cleanText(extractFirst(block, /class="calendar-item__time">([\s\S]*?)<\/div>/i)),
    );
    const venueRoom = cleanText(extractFirst(block, /class="calendar-item__stages">([\s\S]*?)<\/div>/i)) || null;
    const categoryHint = cleanText(
      extractFirst(block, /class="calendar-item__highlightattributes">([\s\S]*?)<\/div>/i),
    );
    const subtitle = cleanText(extractFirst(block, /class="calendar-item__subtitle">([\s\S]*?)<\/div>/i)) || null;

    const detailUrl = detailHref ? `${BASE}${detailHref}` : null;
    const ticketUrl = extractFirst(block, /href="(https:\/\/theaterheidelberg\.eventim-inhouse\.de\/[^"]+)"/i);

    // The Eventim event id is the only stable upstream key; productions repeat
    // across the season so title+date is the fallback, not the identity.
    const ticketEventId = ticketUrl ? extractFirst(ticketUrl, /[?&]event=(\d+)/) : null;
    const sourceEventId = ticketEventId ?? `${slugify(title)}|${date}|${startTime ?? ""}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const tags = extractTags(block);
    out.push({
      source_event_id: sourceEventId,
      title,
      subtitle,
      description: subtitle,
      date,
      time: startTime,
      end_time: endTime && endTime !== startTime ? endTime : null,
      detail_url: detailUrl,
      ticket_url: ticketUrl,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: venueRoom,
      availability: extractAvailability(block),
      raw_category: categoryHint || null,
      city: "heidelberg",
      lat: LAT,
      lon: LON,
      labels: resolveStageLabels({
        title,
        subtitle,
        hint: [categoryHint, tags].filter(Boolean).join(" / "),
        defaultLabel: "stage:theater",
        classifier: "scraper-hardcoded",
        confidence: 0.85,
      }),
    });
  }

  return out;
}

function parseTimeLine(line: string): { startTime: string | null; endTime: string | null } {
  // Ranges print with an en dash ("19:30–22:00"); a hyphen shows up occasionally.
  const m = line.match(/(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})/);
  if (m) return { startTime: `${m[1]}:${m[2]}`, endTime: `${m[3]}:${m[4]}` };
  const single = line.match(/(\d{2}):(\d{2})/);
  if (single) return { startTime: `${single[1]}:${single[2]}`, endTime: null };
  return { startTime: null, endTime: null };
}

function extractAvailability(block: string): "sold_out" | "few_left" | null {
  // The ticket button's status line is the only availability signal now:
  // "Ausverkauft" / "↗ Letzte Tickets ↗" / "↗ Tickets ↗".
  const status = cleanText(extractFirst(block, /class="activity-ticket__status">([\s\S]*?)<\/div>/i));
  if (/ausverkauft/i.test(status)) return "sold_out";
  if (/letzte tickets|wenige restkarten/i.test(status)) return "few_left";
  return null;
}

function extractTags(block: string): string {
  const tags: string[] = [];
  const re = /<span\s+class="tag__button[^"]*">\s*([^<]+)\s*<\/span>/gi;
  for (const m of block.matchAll(re)) {
    const t = cleanText(m[1]);
    if (t) tags.push(t);
  }
  return tags.join(" / ");
}

function extractFirst(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ?? null;
}

function cleanText(raw: string | null): string {
  if (!raw) return "";
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
