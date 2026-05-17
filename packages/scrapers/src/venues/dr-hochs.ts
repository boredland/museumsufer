import { classifyMusic } from "@museumsufer/classify";
import { dateOffset, decodeEntities, normalizeUrl, stripHtml, todayIso, truncate } from "@museumsufer/core";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

dayjs.extend(utc);
dayjs.extend(timezone);

const BASE = "https://www.dr-hochs.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const TZ = "Europe/Berlin";
const THROTTLE_MS = 200;

/**
 * Dr. Hoch's runs a Drupal calendar at /de/veranstaltungen/YYYYMM. Each cell
 * contains zero or more `.view-item` blocks with a title link and `<time>`
 * tags carrying UTC datetimes. Multi-day entries (e.g. summer break) repeat
 * the same view-item on every day they span — dedup by (slug, start UTC).
 * Closure/holiday markers ("Feiertag", "Ferien") are encoded as 8:00–22:00
 * Berlin blocks; we skip anything that starts before 09:00 local or spans
 * more than six hours.
 */

interface CalendarHit {
  slug: string;
  title: string;
  detail_path: string;
  start_utc: string;
  end_utc: string | null;
}

interface DetailFields {
  room: string | null;
  subtitle: string | null;
  description: string | null;
  performers: string | null;
  ticket_url: string | null;
}

export async function scrapeDrHochs(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(120);
  const months = enumerateMonths(today, horizon);

  const hits = new Map<string, CalendarHit>();
  for (const yyyymm of months) {
    const html = await fetchText(`${BASE}/de/veranstaltungen/${yyyymm}`);
    for (const hit of parseCalendar(html)) {
      const key = `${hit.slug}|${hit.start_utc}`;
      if (!hits.has(key)) hits.set(key, hit);
    }
    await sleep(THROTTLE_MS);
  }

  const events: CanonicalScrapedEvent[] = [];
  for (const hit of hits.values()) {
    const start = dayjs.utc(hit.start_utc).tz(TZ);
    const end = hit.end_utc ? dayjs.utc(hit.end_utc).tz(TZ) : null;
    const date = start.format("YYYY-MM-DD");
    if (date < today || date > horizon) continue;
    if (isAllDayMarker(start, end)) continue;

    const detailHtml = await fetchText(`${BASE}${hit.detail_path}`);
    const details = parseDetail(detailHtml);
    await sleep(THROTTLE_MS);

    const title = stripHtml(decodeEntities(hit.title)).trim();
    const time = start.format("HH:mm");
    const endTime = end ? end.format("HH:mm") : null;
    const genre = classifyMusic(title, details.subtitle, details.description, "classical");

    events.push({
      source_event_id: hit.slug,
      title,
      subtitle: details.subtitle,
      description: details.description,
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      detail_url: `${BASE}${hit.detail_path}`,
      ticket_url: details.ticket_url,
      image_url: null,
      price_min: null,
      price_max: null,
      performers: details.performers,
      venue_room: details.room,
      labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "dr-hochs-konservatorium", display_name: "Dr. Hoch's Konservatorium", events };
}

function enumerateMonths(fromIso: string, toIso: string): string[] {
  const months: string[] = [];
  let year = parseInt(fromIso.slice(0, 4), 10);
  let month = parseInt(fromIso.slice(5, 7), 10);
  const endYear = parseInt(toIso.slice(0, 4), 10);
  const endMonth = parseInt(toIso.slice(5, 7), 10);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

function parseCalendar(html: string): CalendarHit[] {
  const hits: CalendarHit[] = [];
  const viewItemRe = /<div\s+class="view-item">([\s\S]*?)<div\s+class="cutoff">/g;
  let viewMatch: RegExpExecArray | null;
  while ((viewMatch = viewItemRe.exec(html)) !== null) {
    const block = viewMatch[1];
    const linkRe = /<a\s+href="(\/de\/content\/[^"]+)"[^>]*>([^<]+)<\/a>/;
    const linkMatch = block.match(linkRe);
    if (!linkMatch) continue;
    const detailPath = linkMatch[1];
    const titleRaw = linkMatch[2];
    const slug = detailPath.replace(/^\/de\/content\//, "").replace(/\/+$/, "");
    const datetimes = [...block.matchAll(/<time\s+datetime="([^"]+)"/g)].map((m) => m[1]);
    if (datetimes.length === 0) continue;
    hits.push({
      slug,
      title: titleRaw,
      detail_path: detailPath,
      start_utc: datetimes[0],
      end_utc: datetimes[1] ?? null,
    });
  }
  return hits;
}

function isAllDayMarker(start: dayjs.Dayjs, end: dayjs.Dayjs | null): boolean {
  if (start.hour() < 9) return true;
  if (!end) return false;
  const durationHours = end.diff(start, "hour", true);
  return durationHours > 6;
}

function parseDetail(html: string): DetailFields {
  const room = extractFieldText(html, "field--name-field-ort");
  const bodyHtml = extractFieldHtml(html, "field--name-body");
  if (!bodyHtml) return { room, subtitle: null, description: null, performers: null, ticket_url: null };
  const body = splitBody(bodyHtml);
  return { room, ...body, ticket_url: extractTicketUrl(bodyHtml) };
}

function extractFieldText(html: string, className: string): string | null {
  const inner = extractFieldHtml(html, className);
  if (!inner) return null;
  const text = stripHtml(decodeEntities(inner)).trim();
  return text || null;
}

function extractFieldHtml(html: string, className: string): string | null {
  const pattern = new RegExp(
    `<div[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/div>\\s*(?=<\\/div>|<div\\b|$)`,
  );
  const match = html.match(pattern);
  return match?.[1] ?? null;
}

/**
 * The body usually leads with a programme line — either a `<h3>` headline
 * (programme/composer) or a `<strong>` host clause, followed by a paragraph
 * naming the performers. We surface the headline as subtitle, the next
 * useful line as performers, and the rest as description.
 */
function splitBody(bodyHtml: string): {
  subtitle: string | null;
  performers: string | null;
  description: string | null;
} {
  const segments = splitSegments(bodyHtml);
  if (segments.length === 0) return { subtitle: null, performers: null, description: null };

  let subtitle: string | null = null;
  let performers: string | null = null;
  const descriptionParts: string[] = [];

  for (const seg of segments) {
    if (!subtitle && (seg.tag === "h2" || seg.tag === "h3" || seg.tag === "h4")) {
      subtitle = seg.text;
      continue;
    }
    if (!subtitle && seg.tag === "p" && /^\s*<strong>/i.test(seg.html) && seg.text.length <= 120) {
      subtitle = seg.text;
      continue;
    }
    if (!performers && looksLikePerformers(seg.text)) {
      performers = seg.text;
      continue;
    }
    descriptionParts.push(seg.text);
  }

  const description = descriptionParts.join(" ").trim();
  return {
    subtitle,
    performers,
    description: description ? truncate(description, 600) : null,
  };
}

interface BodySegment {
  tag: string;
  html: string;
  text: string;
}

function splitSegments(bodyHtml: string): BodySegment[] {
  const segments: BodySegment[] = [];
  const re = /<(p|h2|h3|h4|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(bodyHtml)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = match[2];
    const text = stripHtml(decodeEntities(inner)).trim();
    if (!text) continue;
    segments.push({ tag, html: inner, text });
  }
  return segments;
}

function looksLikePerformers(text: string): boolean {
  if (text.length > 200) return false;
  if (/^tickets?\b|^eintritt\b|^einlass\b|^reservix\b|^karten\b/i.test(text)) return false;
  return /[A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+/.test(text);
}

function extractTicketUrl(bodyHtml: string): string | null {
  const match = bodyHtml.match(/href="(https?:\/\/[^"]*(?:reservix|eventim|ticketshop|tickets?)[^"]*)"/i);
  return match ? normalizeUrl(match[1], BASE) : null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`dr-hochs fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
