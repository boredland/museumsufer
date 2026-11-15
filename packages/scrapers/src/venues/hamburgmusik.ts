import { classifyMusic, isWorkshopTitle, looksLikeNonProgramme } from "@museumsufer/classify";
import { decodeEntities, normalizeUrl, slugify, stripHtml } from "@museumsufer/core";
import { dateOffset, todayIso } from "@museumsufer/core/date";
import PQueue from "p-queue";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.elbphilharmonie.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/** `/de/programm/` only lists today; `/de/programm/DD-MM-YYYY/` lists that day
 *  plus 0-3 following days, so skipping days loses events (a stride of 3 lost
 *  59 of 682). One request per calendar day; the overlap is deduped by
 *  source_event_id. */
const HORIZON_DAYS = 180;
/** The site answers 429 under bursts; a handful of failed pages must not drop
 *  the whole feed, but a mostly-failing crawl is a real outage and must throw. */
const MAX_FAILED_SHARE = 0.2;
const PAGE_TIMEOUT_MS = 15_000;
const RETRIES = 2;

export async function scrapeHamburgMusik(): Promise<VenueScrapeResult[]> {
  const today = todayIso();
  const days = Array.from({ length: HORIZON_DAYS }, (_, i) => dateOffset(i));
  const queue = new PQueue({ concurrency: 4 });
  const settled = await Promise.all(days.map((day) => queue.add(() => fetchDay(day).then((page) => ({ page }), (error: unknown) => ({ error })))));
  const failed = settled.filter((s) => "error" in s);
  if (failed.length > days.length * MAX_FAILED_SHARE) {
    const first = failed[0] && "error" in failed[0] ? String(failed[0].error) : "unknown";
    throw new Error(`Elbphilharmonie: ${failed.length}/${days.length} day pages failed (first: ${first})`);
  }
  const pages = settled.flatMap((s) => ("page" in s ? [s.page] : []));

  const byId = new Map<string, CanonicalScrapedEvent & { venueName: string }>();
  for (const page of pages) {
    for (const ev of page) {
      if (ev.date >= today) byId.set(ev.source_event_id, ev);
    }
  }

  const elphiEvents: CanonicalScrapedEvent[] = [];
  const laeiszhalleEvents: CanonicalScrapedEvent[] = [];
  const sorted = [...byId.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );
  for (const { venueName, ...ev } of sorted) {
    if (venueName.toLowerCase().includes("laeiszhalle")) laeiszhalleEvents.push(ev);
    else elphiEvents.push(ev);
  }

  return [
    { source_slug: "elbphilharmonie", display_name: "Elbphilharmonie Hamburg", events: elphiEvents },
    { source_slug: "laeiszhalle", display_name: "Laeiszhalle Hamburg", events: laeiszhalleEvents },
  ];
}

async function fetchDay(day: string): Promise<Array<CanonicalScrapedEvent & { venueName: string }>> {
  const [y, m, d] = day.split("-");
  const url = `${BASE}/de/programm/${d}-${m}-${y}/`;
  let lastStatus = 0;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await delay(1500 * attempt);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    lastStatus = res.status;
    if (res.status === 429 || res.status >= 500) continue;
    if (!res.ok) throw new Error(`Elbphilharmonie fetch failed: ${res.status} ${url}`);
    const html = await res.text();
    if (!html.includes('id="event-list"')) throw new Error(`Elbphilharmonie markup changed: no event-list at ${url}`);
    return parseItems(html);
  }
  throw new Error(`Elbphilharmonie fetch failed: ${lastStatus} ${url}`);
}

// Executor form: this package's lib target predates `Promise.withResolvers`.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseItems(html: string): Array<CanonicalScrapedEvent & { venueName: string }> {
  const out: Array<CanonicalScrapedEvent & { venueName: string }> = [];
  const eventItems = html.split(/<li[^>]*class="[^"]*event-item[^"]*"[^>]*>/);

  for (let i = 1; i < eventItems.length; i++) {
    const item = eventItems[i].split("</li>")[0];

    const timeMatch = item.match(/<time\s+datetime="([^"]+)"/i);
    if (!timeMatch) continue;
    const datetimeStr = timeMatch[1]; // e.g. "2026-06-16T19:30:00+02:00"
    const date = datetimeStr.substring(0, 10);
    const time = datetimeStr.substring(11, 16);

    const venueMatch = item.match(
      /<div\s+class="[^"]*place-cell">\s*<span\s+class="caption[^"]*">\s*<strong>\s*([^<]+)\s*<\/strong>\s*([^<]+)/i,
    );
    if (!venueMatch) continue;
    const venueName = cleanText(venueMatch[1]);
    const venueRoom = cleanText(venueMatch[2]);

    const titleMatch = item.match(/<p\s+class="event-title[^"]*">\s*<a\s+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    if (!titleMatch) continue;
    const detailUrl = normalizeUrl(titleMatch[1], BASE) || `${BASE}/de/programm/`;
    const title = cleanText(titleMatch[2]);

    const subtitleMatch = item.match(/<p\s+class="event-subtitle">([\s\S]*?)<\/p>/i);
    const subtitle = subtitleMatch ? cleanText(subtitleMatch[1]) : null;

    let image_url: string | null = null;
    const imgMatch = item.match(/<img\s+src="([^"]+)"/i);
    if (imgMatch) {
      image_url = normalizeUrl(decodeEntities(imgMatch[1]), BASE);
    } else {
      const srcsetMatch = item.match(/srcset="([^"]+)"/i);
      if (srcsetMatch) {
        const firstSrc = srcsetMatch[1].split(",")[0].trim().split(" ")[0];
        image_url = normalizeUrl(decodeEntities(firstSrc), BASE);
      }
    }

    const ticketMatch = item.match(/<a\s+class="[^"]*link-ticket"[^>]*href="([^"]+)"/i);
    const ticket_url = ticketMatch ? normalizeUrl(decodeEntities(ticketMatch[1]), BASE) : null;

    const showIdMatch = detailUrl.match(/\/(\d+)$/);
    const eventId = showIdMatch ? showIdMatch[1] : slugify(title);

    out.push({
      source_event_id: `${eventId}|${date}`,
      title,
      subtitle,
      description: subtitle,
      date,
      time,
      detail_url: detailUrl,
      ticket_url: ticket_url || detailUrl,
      image_url,
      venue_room: venueRoom || null,
      price_min: null,
      price_max: null,
      labels: labelsFor(title, subtitle),
      venueName,
    });
  }
  return out;
}

/**
 * Elphi and Laeiszhalle programme is concerts, plus participation workshops
 * and the odd "Film / Elbphilharmonie PLUS" screening in an outside cinema.
 * Without a label here the hub's keyword pass tagged "Workshop: Kosmos
 * Gamelan" as `museum:workshop` and left half the real concerts unlabelled.
 */
function labelsFor(title: string, subtitle: string | null): ScrapedLabel[] {
  const label = (l: string, confidence: number): ScrapedLabel[] => [
    { label: l, confidence, classifier: "scraper-hardcoded" },
  ];
  if (isWorkshopTitle(title)) return label("talk:workshop", 0.8);
  if (looksLikeNonProgramme(title)) return label("event:venue", 0.5);
  // "Film / Elbphilharmonie PLUS" runs in Zeise Kinos, not in the hall: it must not become a cinema listing at the hall's coordinates.
  if (/^film\b/i.test(subtitle ?? "")) return label("event:venue", 0.5);
  return label(`music:${classifyMusic(title, subtitle, null, "classical")}`, 0.8);
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
