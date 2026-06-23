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
 * server-rendered list of `<article class="calendar-item">` blocks, grouped
 * by day. Each block exposes the category, time, venue room, ticket/deeplink
 * and availability. Tickets are sold through an Eventim in-house shop.
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

  // Events sit under `<div class="calendar__day … data-date="YYYY-MM-DD">`
  // day groups — but only the first few days also carry `js-overview-section`;
  // later days render with a different class, so a fixed-wrapper split lumps
  // every later day onto the last matched date. Anchor each article to the
  // nearest preceding `data-date` marker instead, which is wrapper-agnostic.
  const dateMarkers = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"/gi)].map((m) => ({
    idx: m.index ?? 0,
    date: m[1],
  }));

  const articleRe = /<article\s+class="calendar-item"\s+aria-label="[^"]*">([\s\S]*?)<\/article>/gi;
  for (const am of html.matchAll(articleRe)) {
    const block = am[1];
    if (!block) continue;

    const pos = am.index ?? 0;
    let date: string | null = null;
    for (const dm of dateMarkers) {
      if (dm.idx < pos) date = dm.date;
      else break;
    }
    if (!date || date < today) continue;

    const title = cleanText(
      extractFirst(block, /<div\s+class="calendar-item__title">\s*<p>([\s\S]*?)<\/p>\s*<\/div>/i),
    );
    if (!title) continue;

    const infoHtml = extractFirst(block, /<div\s+class="calendar-item__information">([\s\S]*?)<\/div>/i);
    const infoLines = infoHtml ? extractTextLines(infoHtml) : [];
    const categoryHint = infoLines[0] ?? "";
    const timeLine = infoLines[1] ?? "";
    const venueRoom = infoLines[2] ?? null;
    const { startTime, endTime } = parseTimeLine(timeLine);

    const detailHref = extractFirst(
      block,
      /<a\s+[^>]*href="(\/de\/produktionen\/[^"]+)"[^>]*>\s*<span\s+aria-hidden="true">Details<\/span><\/a>/i,
    );
    const detailUrl = detailHref ? `${BASE}${detailHref}` : null;

    const ticketUrl = extractFirst(block, /href="(https:\/\/theaterheidelberg\.eventim-inhouse\.de\/[^"]+)"/i);

    const icalId = extractFirst(block, /href="\/de\/produktionen\/[^"]+\/(\d+)\.ics"/i);
    const ticketEventId = ticketUrl ? extractFirst(ticketUrl, /[?&]event=(\d+)/) : null;
    const sourceEventId = ticketEventId ?? icalId ?? `${slugify(title)}|${date}|${startTime ?? ""}`;
    if (seen.has(sourceEventId)) continue;

    const description = extractDescription(block);
    const availability = extractAvailability(block);
    const tags = extractTags(block);
    const hint = [categoryHint, tags, description].filter(Boolean).join(" / ");

    seen.add(sourceEventId);
    out.push({
      source_event_id: sourceEventId,
      title,
      subtitle: null,
      description,
      date,
      time: startTime,
      end_time: endTime && endTime !== startTime ? endTime : null,
      detail_url: detailUrl,
      ticket_url: ticketUrl,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: venueRoom,
      availability,
      city: "heidelberg",
      lat: LAT,
      lon: LON,
      labels: resolveStageLabels({
        title,
        hint,
        defaultLabel: "stage:theater",
        classifier: "scraper-hardcoded",
        confidence: 0.85,
      }),
    });
  }

  return out;
}

function parseTimeLine(line: string): { startTime: string | null; endTime: string | null } {
  const m = line.match(/(\d{2}):(\d{2})\s*(?:→|->)\s*(\d{2}):(\d{2})/);
  if (m) return { startTime: `${m[1]}:${m[2]}`, endTime: `${m[3]}:${m[4]}` };
  const single = line.match(/(\d{2}):(\d{2})/);
  if (single) return { startTime: `${single[1]}:${single[2]}`, endTime: null };
  return { startTime: null, endTime: null };
}

function extractDescription(block: string): string | null {
  const start = block.indexOf('<div class="calendar-item__expandable">');
  if (start === -1) return null;
  const end = block.lastIndexOf("</div>");
  if (end <= start) return null;
  const text = cleanText(block.slice(start, end + 6));
  return text || null;
}

function extractAvailability(block: string): "sold_out" | "few_left" | null {
  if (/button--inactive|aria-label="Ausverkauft/.test(block)) return "sold_out";
  if (/button--tickets-fewtickets|Nur noch wenige Restkarten/.test(block)) return "few_left";
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

function extractTextLines(html: string): string[] {
  const lines: string[] = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  for (const m of html.matchAll(re)) {
    const t = cleanText(m[1]);
    if (t) lines.push(t);
  }
  return lines;
}

function extractFirst(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ?? null;
}

function cleanText(raw: string | null): string {
  if (!raw) return "";
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
