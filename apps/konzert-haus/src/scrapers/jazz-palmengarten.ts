import {
  berlinNow,
  dateOffset,
  decodeEntities,
  normalizeUrl,
  sanitizeImageUrl,
  slugify,
  stripHtml,
  todayIso,
  truncate,
} from "@museumsufer/core";
import { classify } from "../genre-heuristics";
import type { ScrapedEvent, ScrapeResult } from "../types";

const BASE = "https://www.palmengarten.de";
const CALENDAR_AJAX = `${BASE}/de/kalender?storage=32&type=1573738558&cHash=88d842c264e28b2c379931d1e19e4e73`;
const UA = "konzert.haus crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;
const SERIES_ABSTRACT = "JAZZ IM PALMENGARTEN";

interface CalendarItem {
  id: number;
  title: string;
  start: string;
  end?: string | null;
  className?: string | null;
  abstract?: string | null;
  location?: string | null;
  uriAjax?: string | null;
}

/**
 * The Palmengarten calendar is a TYPO3/FullCalendar widget that posts to a
 * single JSON endpoint, but caps each response (~70 items). We page by month
 * to stay under the cap and dedup by event id across the windows we walk.
 */
export async function scrapeJazzPalmengarten(): Promise<ScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(200);
  const events: ScrapedEvent[] = [];
  const seenIds = new Set<number>();
  const windows = monthlyWindows();

  for (let i = 0; i < windows.length; i++) {
    if (i > 0) await sleep(THROTTLE_MS);
    const items = await fetchCalendar(windows[i].start, windows[i].end);
    for (const item of items) {
      if (seenIds.has(item.id)) continue;
      const abstract = item.abstract?.toUpperCase() ?? "";
      if (!abstract.includes(SERIES_ABSTRACT)) continue;

      const date = item.start.slice(0, 10);
      if (date < today || date > horizon) continue;
      const time = item.start.slice(11, 16);
      const endTime = item.end ? item.end.slice(11, 16) : null;

      seenIds.add(item.id);

      const detailUrl = item.uriAjax ? normalizeUrl(item.uriAjax, BASE) : null;
      await sleep(THROTTLE_MS);
      const detail = detailUrl ? await fetchDetail(detailUrl) : EMPTY_DETAIL;

      const title = stripHtml(decodeEntities(item.title)).trim();
      const subtitle = item.abstract ? stripHtml(decodeEntities(item.abstract)).trim() || null : null;
      const venueRoom = item.location ? stripHtml(decodeEntities(item.location)).trim() || null : null;

      events.push({
        slug: slugify(`${date}-${title}`),
        title,
        subtitle,
        description: detail.description,
        date,
        time: time === "00:00" ? null : time,
        end_time: endTime && endTime !== "00:00" && endTime !== time ? endTime : null,
        genre: classify(title, subtitle, detail.description, "jazz"),
        image_url: detail.imageUrl,
        detail_url: detailUrl,
        ticket_url: detail.ticketUrl,
        price_min: detail.priceMin,
        price_max: detail.priceMax,
        venue_room: venueRoom,
        performers: detail.performers,
      });
    }
  }

  return { venue_slug: "jazz-palmengarten", events };
}

async function fetchCalendar(start: string, end: string): Promise<CalendarItem[]> {
  const body = new URLSearchParams({ start, end });
  const res = await fetch(CALENDAR_AJAX, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`jazz-palmengarten calendar fetch failed: ${start}..${end} → ${res.status}`);
  return (await res.json()) as CalendarItem[];
}

interface DetailFields {
  description: string | null;
  imageUrl: string | null;
  ticketUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  performers: string | null;
}

const EMPTY_DETAIL: DetailFields = {
  description: null,
  imageUrl: null,
  ticketUrl: null,
  priceMin: null,
  priceMax: null,
  performers: null,
};

const TEXT_RE = /<div class="text">([\s\S]*?)<\/div>\s*<dl/;
const IMG_RE = /<div class="images">[\s\S]*?<img[^>]+src="([^"]+)"/;
const BESETZUNG_RE = /<strong>\s*Besetzung:\s*<\/strong>\s*(?:<br\s*\/?>)?\s*([\s\S]*?)(?:<\/p>|<p>)/i;

async function fetchDetail(url: string): Promise<DetailFields> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
    });
    if (!res.ok) return EMPTY_DETAIL;
    html = await res.text();
  } catch {
    return EMPTY_DETAIL;
  }

  const textBlock = TEXT_RE.exec(html)?.[1] ?? "";
  const description = textBlock ? truncate(stripHtml(decodeEntities(textBlock)), 800) : null;

  const imageRaw = IMG_RE.exec(html)?.[1] ?? null;
  const imageUrl = imageRaw ? sanitizeImageUrl(normalizeUrl(imageRaw, BASE)) : null;

  const performers = extractPerformers(textBlock);
  const ticketUrl = extractTicketUrl(textBlock);
  const { priceMin, priceMax } = extractPrices(textBlock);

  return { description, imageUrl, ticketUrl, priceMin, priceMax, performers };
}

function extractPerformers(textBlock: string): string | null {
  const match = BESETZUNG_RE.exec(textBlock);
  if (!match) return null;
  const cleaned = stripHtml(decodeEntities(match[1])).replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function extractTicketUrl(textBlock: string): string | null {
  // Prefer external ticket vendors (frankfurtticket, reservix, eventim) over
  // the calendar's self-referential links, mirroring jazz-frankfurt's policy.
  const ticketRe = /href="(https?:\/\/[^"]*(?:frankfurtticket|reservix|eventim|adticket)[^"]*)"/i;
  const match = ticketRe.exec(textBlock);
  return match ? decodeEntities(match[1]) : null;
}

function extractPrices(textBlock: string): { priceMin: number | null; priceMax: number | null } {
  // Restrict price extraction to the explicit "Preise:" block so we don't
  // catch admission-fee numbers from the standard garden-rules boilerplate.
  const preiseRe = /<strong>\s*Preise:\s*<\/strong>([\s\S]*?)(?:<\/p>|<p\s)/i;
  const block = preiseRe.exec(textBlock)?.[1];
  if (!block) return { priceMin: null, priceMax: null };
  const decoded = decodeEntities(block);
  const prices: number[] = [];
  for (const m of decoded.matchAll(/(\d+)(?:[,.](\d{1,2}))?\s*€/g)) {
    const euros = parseInt(m[1], 10);
    const cents = m[2] ? parseInt(m[2].padEnd(2, "0"), 10) : 0;
    const value = euros + cents / 100;
    if (Number.isFinite(value) && value > 0) prices.push(value);
  }
  if (prices.length === 0) return { priceMin: null, priceMax: null };
  return {
    priceMin: Math.min(...prices),
    priceMax: prices.length > 1 ? Math.max(...prices) : null,
  };
}

/**
 * Walks one calendar month at a time from today through today+200d. The
 * calendar endpoint caps responses (~70 items), so a single wide query
 * silently drops events in dense months.
 */
function monthlyWindows(): Array<{ start: string; end: string }> {
  const tz = "+02:00";
  const windows: Array<{ start: string; end: string }> = [];
  const todayStart = berlinNow().startOf("day");
  const horizonStart = berlinNow().add(200, "day").startOf("day");
  let cursor = todayStart;
  while (cursor.isBefore(horizonStart) || cursor.isSame(horizonStart, "month")) {
    const next = cursor.add(1, "month").startOf("month");
    windows.push({
      start: `${cursor.format("YYYY-MM-DDT00:00:00")}${tz}`,
      end: `${next.format("YYYY-MM-DDT00:00:00")}${tz}`,
    });
    cursor = next;
  }
  return windows;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
