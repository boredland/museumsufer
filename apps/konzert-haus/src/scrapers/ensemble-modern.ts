import {
  berlinNow,
  dateOffset,
  decodeEntities,
  normalizeUrl,
  nullIfMidnight,
  stripHtml,
  toBerlinTime,
  todayIso,
  truncate,
} from "@museumsufer/core";
import { classify } from "../genre-heuristics";
import type { ScrapedEvent, ScrapeResult } from "../types";

const BASE = "https://www.ensemble-modern.com";
const UA = "konzert.haus crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;
const MAX_DETAIL_FETCHES = 20;
const HORIZON_DAYS = 180;

/**
 * Ensemble Modern tours extensively; we only keep concerts in the
 * Frankfurt/Rhein-Main area. Match is case-insensitive against the
 * combined location + city + address string.
 */
const FFM_LOCATION_KEYWORDS = [
  "frankfurt",
  "mousonturm",
  "alte oper",
  "oper frankfurt",
  "bockenheimer depot",
  "funkhaus",
  "hessischer rundfunk",
  "hr-sendesaal",
  "casals forum",
  "kronberg",
] as const;

interface CalendarCard {
  eventId: string;
  date: string;
  time: string | null;
  location: string;
  city: string;
  address: string | null;
  title: string;
  subtitle: string | null;
  festival: string | null;
  imageUrl: string | null;
  detailUrl: string;
  ticketUrl: string | null;
  works: string | null;
  performers: string | null;
}

export async function scrapeEnsembleModern(): Promise<ScrapeResult> {
  const cards = await fetchCalendarCards();
  const ffm = cards.filter(isFrankfurtArea);

  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();
  let detailFetches = 0;

  for (const card of ffm) {
    const slug = `em-${card.eventId}`;
    const dedup = `${slug}|${card.date}|${card.time ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    let description: string | null = null;
    let endTime: string | null = null;
    if (detailFetches < MAX_DETAIL_FETCHES) {
      await sleep(THROTTLE_MS);
      try {
        const ical = await fetchIcal(card.eventId);
        description = ical.description;
        endTime = ical.endTime && ical.endTime !== card.time ? ical.endTime : null;
      } catch (err) {
        console.warn(`ensemble-modern ics fetch failed for ${card.eventId}:`, err);
      }
      detailFetches++;
    }

    const subtitle = card.subtitle ?? card.festival ?? card.works ?? null;
    events.push({
      slug,
      title: card.title,
      subtitle,
      description,
      date: card.date,
      time: card.time,
      end_time: endTime,
      genre: classify(card.title, subtitle, description, "experimental"),
      image_url: card.imageUrl,
      detail_url: card.detailUrl,
      ticket_url: card.ticketUrl,
      price_min: null,
      price_max: null,
      venue_room: card.location,
      performers: card.performers,
    });
  }

  return { venue_slug: "ensemble-modern", events };
}

async function fetchCalendarCards(): Promise<CalendarCard[]> {
  const today = todayIso();
  const horizon = dateOffset(HORIZON_DAYS);
  const cards: CalendarCard[] = [];
  let first = true;

  for (const month of monthsInRange(horizon)) {
    if (!first) await sleep(THROTTLE_MS);
    first = false;
    const html = await fetchMonthHtml(month);
    if (html === null) continue;
    for (const card of parseCalendarHtml(html)) {
      if (card.date < today || card.date > horizon) continue;
      cards.push(card);
    }
  }
  return cards;
}

/** Months with no scheduled events return 404; treat that as an empty month rather than failing the run. */
async function fetchMonthHtml(month: string): Promise<string | null> {
  const url = `${BASE}/de/kalender/${month}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ensemble-modern fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function monthsInRange(horizonDate: string): string[] {
  const months: string[] = [];
  let cursor = berlinNow().startOf("month");
  while (cursor.format("YYYY-MM-DD") <= horizonDate) {
    months.push(cursor.format("YYYY-MM"));
    cursor = cursor.add(1, "month");
  }
  return months;
}

const SECTION_RE = /<section class="w__concert[^"]*" id="k-(\d+)"[^>]*>([\s\S]*?)<\/section>/g;

export function parseCalendarHtml(html: string): CalendarCard[] {
  const cards: CalendarCard[] = [];
  for (const match of html.matchAll(SECTION_RE)) {
    const card = parseSection(match[1], match[2]);
    if (card) cards.push(card);
  }
  return cards;
}

function parseSection(eventId: string, body: string): CalendarCard | null {
  const detailHref = match1(
    body,
    /<a[^>]*class="w__tile--link[^"]*"[^>]*href="(\/de\/kalender\/\d{4}-\d{2}-\d{2}\/\d+[^"]*)"/,
  );
  if (!detailHref) return null;
  const date = match1(detailHref, /\/de\/kalender\/(\d{4}-\d{2}-\d{2})\//);
  if (!date) return null;

  const title = textOf(body, /<h2 class="w__tile--title">([\s\S]*?)<\/h2>/);
  if (!title) return null;

  const cityBlock = match1(body, /<p class="w__concert--city">([\s\S]*?)<\/p>/) ?? "";
  const imageHref = match1(body, /<img[^>]*\bsrc="(\/db\/bild\/[^"]+)"/);

  return {
    eventId,
    date,
    time: parseTime(body),
    location: textOf(body, /<p class="w__concert--location">([\s\S]*?)<\/p>/) ?? "",
    city: parseCity(cityBlock),
    address: textOf(cityBlock, /<span class="w__concert--address">([\s\S]*?)<\/span>/),
    title,
    subtitle: textOf(body, /<p class="w__concert--subtitle">([\s\S]*?)<\/p>/),
    festival: textOf(body, /<p class="w__concert--festival">([\s\S]*?)<\/p>/),
    imageUrl: normalizeUrl(imageHref, BASE),
    detailUrl: `${BASE}${detailHref}`,
    ticketUrl: match1(
      body,
      /<a[^>]*class="[^"]*w__el[^"]*"[^>]*href="(https?:\/\/[^"]+)"[^>]*>\s*<span[^>]*>[^<]*<\/span>\s*Tickets/,
    ),
    works: textOf(body, /<div class="w__concert--works-cell">([\s\S]*?)<\/div>/),
    performers: parsePerformers(body),
  };
}

function parseTime(body: string): string | null {
  const m = body.match(/<p class="w__concert--time">\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  return nullIfMidnight(`${m[1].padStart(2, "0")}:${m[2]}`);
}

function parseCity(cityBlock: string): string {
  const text = stripHtml(cityBlock.replace(/<span class="w__concert--address">[\s\S]*?<\/span>/, ""));
  return text.replace(/\s*\(.*?\)\s*$/, "").trim();
}

/**
 * Performers and conductors live in the first <p> of `details-cell`,
 * separated by `|` with role labels after each name. Everything after
 * the first <p> is credits/marketing fluff.
 */
function parsePerformers(body: string): string | null {
  const cell = match1(body, /<div class="w__concert--details-cell">([\s\S]*?)<\/div>/);
  if (!cell) return null;
  const firstP = match1(cell, /<p[^>]*>([\s\S]*?)<\/p>/);
  if (!firstP) return null;
  const text = stripHtml(firstP).replace(/\s+\|\s+/g, " | ");
  return text || null;
}

function isFrankfurtArea(card: CalendarCard): boolean {
  const haystack = `${card.location} ${card.city} ${card.address ?? ""}`.toLowerCase();
  if (FFM_LOCATION_KEYWORDS.some((kw) => haystack.includes(kw))) return true;
  return /\b60\d{3}\b/.test(haystack);
}

interface IcalInfo {
  description: string | null;
  endTime: string | null;
}

async function fetchIcal(eventId: string): Promise<IcalInfo> {
  const res = await fetch(`${BASE}/ics.php?eventId=${eventId}&lang=de`, {
    headers: { "User-Agent": UA, Accept: "text/calendar" },
  });
  if (!res.ok) throw new Error(`ics ${eventId} → ${res.status}`);
  return parseIcal(await res.text());
}

export function parseIcal(ics: string): IcalInfo {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const desc = match1(unfolded, /^DESCRIPTION:(.*)$/m);
  const dtend = match1(unfolded, /^DTEND:(\d{8}T\d{6}Z)$/m);
  return {
    description: desc ? cleanIcalDescription(desc) : null,
    endTime: dtend ? icsTimeToBerlin(dtend) : null,
  };
}

function cleanIcalDescription(raw: string): string | null {
  const unescaped = raw.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
  const lines = unescaped
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^(Tickets|Homepage):/i.test(l));
  return truncate(decodeEntities(lines.join(" ")), 800);
}

function icsTimeToBerlin(utc: string): string | null {
  const m = utc.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  return toBerlinTime(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

function match1(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1] : null;
}

function textOf(body: string, re: RegExp): string | null {
  const m = body.match(re);
  if (!m) return null;
  const text = stripHtml(m[1]);
  return text || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
