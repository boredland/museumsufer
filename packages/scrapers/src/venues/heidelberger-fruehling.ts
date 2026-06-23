import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.heidelberger-fruehling.de";
const PROGRAM_URL = `${BASE}/programm-tickets/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.4122;
const LON = 8.71;
const CITY = "heidelberg";

const ARTICLE_RE = /<article\b[^>]*class="[^"]*event-list__item[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
const HREF_RE = /href="([^"]+)"/;
const EVENTIM_RE = /https?:\/\/[^"'\s]*eventim[^"'\s]*/i;
const DATE_RE = /\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b/;
const TIME_RE = /\b(\d{1,2})\.(\d{2})\s*Uhr/;

export async function scrapeHeidelbergerFruehling(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(PROGRAM_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Heidelberger Frühling fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  for (const m of html.matchAll(ARTICLE_RE)) {
    const block = m[1];
    const parsed = parseCard(block);
    if (!parsed || parsed.date < today) continue;

    const labels = resolveStageLabels({
      title: parsed.title,
      subtitle: parsed.subtitle,
      defaultLabel: "music:classical",
      classifier: "scraper-hardcoded",
      confidence: 0.9,
    });

    events.push({
      source_event_id: parsed.eventId,
      title: parsed.title,
      subtitle: parsed.subtitle,
      description: parsed.subtitle,
      date: parsed.date,
      time: parsed.time,
      detail_url: parsed.detailUrl,
      ticket_url: parsed.ticketUrl ?? parsed.detailUrl,
      image_url: parsed.imageUrl,
      venue_room: parsed.venueRoom,
      city: CITY,
      lat: LAT,
      lon: LON,
      labels,
    });
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return {
    source_slug: "heidelberger-fruehling",
    display_name: "Heidelberger Frühling",
    events,
  };
}

interface ParsedCard {
  eventId: string;
  title: string;
  subtitle: string | null;
  date: string;
  time: string | null;
  detailUrl: string;
  ticketUrl: string | null;
  imageUrl: string | null;
  venueRoom: string | null;
}

function parseCard(block: string): ParsedCard | null {
  const detailMatch = HREF_RE.exec(block);
  if (!detailMatch) return null;
  const detailUrl = normalizeUrl(detailMatch[1]);

  const eventId = /data-eventim="(\d+)"/.exec(block)?.[1] ?? detailUrl;

  const titleHtml = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(block)?.[1] ?? "";
  const titleParts = titleHtml
    .split(/<br\s*\/?>/i)
    .map((p) => cleanText(p))
    .filter(Boolean);
  const title = titleParts[0] ?? cleanText(titleHtml) ?? "";
  const subtitle = titleParts.slice(1).join(" ") || null;

  const dateMatch = DATE_RE.exec(block);
  if (!dateMatch) return null;
  const date = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;

  const timeMatch = TIME_RE.exec(block);
  const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

  const ticketMatch = EVENTIM_RE.exec(block);
  const ticketUrl = ticketMatch ? normalizeUrl(ticketMatch[0]) : null;

  const imageUrl = extractImage(block);

  const venueRoom = extractVenueRoom(block);

  return { eventId, title, subtitle, date, time, detailUrl, ticketUrl, imageUrl, venueRoom };
}

function extractImage(block: string): string | null {
  const srcset = /<source[^>]+data-srcset="([^"]+)"/.exec(block)?.[1];
  if (srcset) {
    const first = srcset.split(",")[0]?.trim().split(" ")[0];
    if (first) return first;
  }
  const img = /<img[^>]+src="([^"]+)"/.exec(block)?.[1];
  return img ? normalizeUrl(img) : null;
}

function extractVenueRoom(block: string): string | null {
  const firstColumn = /<div class="event-firstcolumn[^"]*">([\s\S]*?)<\/div>\s*<\/div>/.exec(block)?.[1];
  if (!firstColumn) return null;
  const lines = firstColumn
    .split(/<br\s*\/?>/i)
    .map((l) => cleanText(l))
    .filter(Boolean);
  if (lines.length >= 2) {
    return lines.slice(1).join(", ");
  }
  return null;
}

function normalizeUrl(url: string): string {
  return url.startsWith("http") ? url : `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

function cleanText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
  return text || null;
}
