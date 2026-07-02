import { decodeEntities, normalizeUrl, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://schauspielhaus.de";
const SPIELPLAN_URLS = [`${BASE}/de/spielplan/`, `${BASE}/spielplan`, `${BASE}/de/programm/spielplan`];
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const ITEM_RE = /<div\s+class="list-row-item"[^>]*>([\s\S]*?)<\/li>/g;
const DATE_RE = /data-taiko-date="(\d{2})\/(\d{2})"/i;
const TITLE_LINK_RE = /<a\s+class="list-row-item__main-link"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
const INFO_RE = /<div\s+class="list-row-item__main-info">([\s\S]*?)<\/div>/i;
const DESC_RE = /<div\s+class="list-row-item__info-content">([\s\S]*?)<\/div>/i;
const TICKET_BLOCK_RE = /<div\s+class="list-row-item__ticket">([\s\S]*?)<\/div>/i;
const PIECE_LINK_RE =
  /<a\b[^>]*href="([^"]*(?:\/stuecke\/[^"]+|\/de\/programm\/(?:auffuehrung\/)?[^"]+))"[^>]*>([\s\S]*?)<\/a>/gi;
const NUMERIC_DATE_RE = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/;
const LONG_DATE_RE =
  /(\d{1,2})\.\s*(Jan(?:uar)?|Feb(?:ruar)?|Mär(?:z)?|Mrz|Apr(?:il)?|Mai|Jun(?:i)?|Jul(?:i)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Okt(?:ober)?|Nov(?:ember)?|Dez(?:ember)?)\.?\s*(\d{4})/i;
const TIME_RE = /(\d{1,2})[.:](\d{2})\s*Uhr/i;

const MONTHS: Record<string, string> = {
  jan: "01",
  januar: "01",
  feb: "02",
  februar: "02",
  mär: "03",
  märz: "03",
  mrz: "03",
  apr: "04",
  april: "04",
  mai: "05",
  jun: "06",
  juni: "06",
  jul: "07",
  juli: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  okt: "10",
  oktober: "10",
  nov: "11",
  november: "11",
  dez: "12",
  dezember: "12",
};

export async function scrapeDeutschesSchauspielhaus(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const { perfs, detailBaseUrl } = await fetchSpielplan(today);
  const imageBySlug = await enrichImages(perfs);

  const events: CanonicalScrapedEvent[] = perfs.map((p) => {
    return {
      source_event_id: `${p.showSlug}|${p.date}|${p.time ?? ""}|${p.venueRoom ?? ""}`,
      title: p.title,
      subtitle: p.description,
      description: p.description,
      date: p.date,
      time: p.time,
      detail_url: p.detailUrl,
      ticket_url: p.ticketUrl,
      image_url: imageBySlug.get(p.showSlug) ?? null,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: p.venueRoom,
      raw_category: null,
      labels: resolveStageLabels({ title: p.title, subtitle: p.description, confidence: 0.9 }),
    };
  });

  if (events.length === 0) {
    console.warn(`deutsches-schauspielhaus: no upcoming events found on ${detailBaseUrl}`);
  }

  return { source_slug: "deutsches-schauspielhaus", display_name: "Deutsches Schauspielhaus", events };
}

async function fetchSpielplan(today: string): Promise<{ perfs: RawPerf[]; detailBaseUrl: string }> {
  let lastError: Error | null = null;
  let lastUrl = SPIELPLAN_URLS[0];

  for (const url of SPIELPLAN_URLS) {
    lastUrl = url;
    try {
      const html = await fetchHtml(url);
      const perfs = parseSpielplan(html, today);
      if (perfs.length > 0) return { perfs, detailBaseUrl: url };
    } catch (err) {
      lastError = err as Error;
    }
  }

  if (lastError) throw lastError;
  return { perfs: [], detailBaseUrl: lastUrl };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

interface RawPerf {
  showSlug: string;
  title: string;
  date: string;
  time: string | null;
  venueRoom: string | null;
  detailUrl: string;
  ticketUrl: string | null;
  description: string | null;
}

function parseSpielplan(html: string, today: string): RawPerf[] {
  const legacy = parseLegacySpielplan(html, today);
  return legacy.length > 0 ? legacy : parseFlexibleSpielplan(html, today);
}

function parseLegacySpielplan(html: string, today: string): RawPerf[] {
  const matches = [...html.matchAll(ITEM_RE)];
  const out: RawPerf[] = [];
  const seen = new Set<string>();

  for (const m of matches) {
    const block = m[1];

    const dateMatch = block.match(DATE_RE);
    if (!dateMatch) continue;
    const date = parseYearForDate(dateMatch[1], dateMatch[2]);
    if (date < today) continue;

    const titleLinkMatch = block.match(TITLE_LINK_RE);
    if (!titleLinkMatch) continue;
    const href = titleLinkMatch[1];
    const title = cleanText(titleLinkMatch[2]).replace(/­/g, ""); // strip soft hyphens
    const showSlug = deriveSlug(href, title);

    const infoMatch = block.match(INFO_RE);
    let time: string | null = null;
    let venueRoom: string | null = null;
    if (infoMatch) {
      const infoHtml = infoMatch[1];
      const cleanedInfo = cleanText(infoHtml);
      const parts = cleanedInfo.split("/");

      const timePart = parts[0]?.trim();
      const roomPart = parts[1]?.trim() ?? null;

      const timeMatch = timePart?.match(/(\d{1,2})[.:](\d{2})/);
      if (timeMatch) {
        time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
        venueRoom = roomPart;
      } else {
        venueRoom = timePart || null;
      }
    }

    const descMatch = block.match(DESC_RE);
    const description = descMatch ? cleanText(descMatch[1]) : null;

    const ticketBlockMatch = block.match(TICKET_BLOCK_RE);
    let ticketUrl: string | null = null;
    if (ticketBlockMatch) {
      const hrefMatch = ticketBlockMatch[1].match(/href="([^"]+)"/i);
      if (hrefMatch) ticketUrl = decodeEntities(hrefMatch[1]);
    }

    const dedup = `${showSlug}|${date}|${time ?? ""}|${venueRoom ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    out.push({
      showSlug,
      title,
      date,
      time,
      venueRoom,
      detailUrl: normalizeUrl(href || "", BASE) || `${BASE}/spielplan`,
      ticketUrl,
      description,
    });
  }

  return out;
}

/**
 * Fallback for the current Schauspielhaus Hamburg markup: the live page still
 * exposes piece/detail links and human-readable date strings, but no longer in
 * the older `list-row-item` / `data-taiko-date` structure the original parser
 * keyed on. We keep the legacy parser first for stability and use this looser
 * text-based extraction only when the legacy selectors yield nothing.
 */
function parseFlexibleSpielplan(html: string, today: string): RawPerf[] {
  const out: RawPerf[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(PIECE_LINK_RE)) {
    const href = decodeEntities(match[1]);
    const title = cleanText(match[2]).replace(/­/g, "");
    if (!title || /^(?:zur stückseite|jetzt buchen|mehr infos!?|tickets?)$/i.test(title)) continue;

    const idx = match.index ?? 0;
    const before = cleanText(html.slice(Math.max(0, idx - 96), idx));
    const after = cleanText(html.slice(idx + match[0].length, idx + match[0].length + 500));
    const dateInfo = findDate(after, true) ?? findDate(before, false);
    if (!dateInfo || dateInfo.date < today) continue;

    const infoText = dateInfo.fromAfter ? after : `${before} ${after}`;
    const time = parseTime(infoText);
    const context = dateInfo.fromAfter ? `${title} ${after}` : `${before} ${title} ${after}`;
    const descriptionAndVenue = extractDescriptionAndVenue(context, title, dateInfo.rawDate);
    const showSlug = deriveSlug(href, title);
    const dedup = `${showSlug}|${dateInfo.date}|${time ?? ""}|${descriptionAndVenue.venueRoom ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    out.push({
      showSlug,
      title,
      date: dateInfo.date,
      time,
      venueRoom: descriptionAndVenue.venueRoom,
      detailUrl: normalizeUrl(href || "", BASE) || SPIELPLAN_URLS[0],
      ticketUrl: null,
      description: descriptionAndVenue.description,
    });
  }

  return out;
}

async function enrichImages(perfs: RawPerf[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const seen = new Set<string>();
  for (const p of perfs) {
    if (seen.has(p.showSlug) || !p.detailUrl) continue;
    seen.add(p.showSlug);
    try {
      const html = await fetchHtml(p.detailUrl);
      const imgMatch = html.match(/src="([^"]*\/sites\/default\/files\/styles\/[^"]+)"/i);
      if (imgMatch?.[1]) {
        out.set(p.showSlug, normalizeUrl(decodeEntities(imgMatch[1]) || "", BASE) || "");
      }
    } catch (err) {
      console.warn(`deutsches-schauspielhaus detail enrichment failed for ${p.showSlug}:`, err);
    }
  }
  return out;
}

function parseYearForDate(day: string, month: string): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const m = parseInt(month, 10);
  const year = m < currentMonth - 2 ? currentYear + 1 : currentYear;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}

function deriveSlug(href: string, title: string): string {
  const m = href.match(/\/(?:stuecke|de\/programm(?:\/auffuehrung)?)\/([^/?#]+)/);
  return m ? m[1] : slugify(title);
}

function findDate(text: string, fromAfter: boolean): { date: string; rawDate: string; fromAfter: boolean } | null {
  const numeric = text.match(NUMERIC_DATE_RE);
  if (numeric) {
    const [, day, month, year] = numeric;
    return {
      date: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
      rawDate: numeric[0],
      fromAfter,
    };
  }

  const long = text.match(LONG_DATE_RE);
  if (!long) return null;
  const [, day, monthRaw, year] = long;
  const month = MONTHS[monthRaw.toLowerCase().replace(/\.$/, "")];
  if (!month) return null;
  return {
    date: `${year}-${month}-${day.padStart(2, "0")}`,
    rawDate: long[0],
    fromAfter,
  };
}

function parseTime(text: string): string | null {
  const m = text.match(TIME_RE);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function extractDescriptionAndVenue(
  context: string,
  title: string,
  rawDate: string,
): { description: string | null; venueRoom: string | null } {
  const titleIdx = context.indexOf(title);
  const afterTitle = titleIdx === -1 ? context : context.slice(titleIdx + title.length);
  const beforeDate = afterTitle.split(rawDate)[0]?.trim() ?? "";
  const parts = beforeDate
    .replace(/\b(?:Zur Stückseite|Jetzt buchen|Mehr Infos!?|Tickets?)\b/gi, "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return { description: null, venueRoom: null };
  const venueRoom = parts[parts.length - 1] ?? null;
  const description = parts.length > 1 ? parts.slice(0, -1).join(" / ") : null;
  return { description, venueRoom };
}
