import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * Bessunger Knabenschule — socio-cultural centre in Darmstadt. The programme
 * page is a small custom PHP site where each event is an <li> with a thumbnail,
 * date/time, title, teaser and description. Ticketing is a mix of ztix.de
 * purchase links and hessen-szene.de reservation links; the site does not use
 * YesTicket, so we scrape the listing directly rather than through a shared
 * ticketing adapter.
 */

const BASE = "https://www.knabenschule.de";
const PROGRAM_URL = `${BASE}/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const LAT = 49.852;
const LON = 8.652;

interface ParsedEvent {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  date: string;
  time: string;
  image: string | null;
  ticketUrl: string | null;
  priceMin: number | null;
}

export async function scrapeBessungerKnabenschule(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(PROGRAM_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`knabenschule fetch failed: ${res.status}`);

  const html = await res.text();
  const events = parseEvents(html)
    .filter((e) => e.date >= today)
    .map((e) => toCanonical(e));

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return {
    source_slug: "bessunger-knabenschule",
    display_name: "Bessunger Knabenschule",
    events,
  };
}

function toCanonical(e: ParsedEvent): CanonicalScrapedEvent {
  const description = e.description?.replace(/\s+/g, " ").trim() ?? null;

  return {
    source_event_id: e.id,
    title: e.title,
    subtitle: e.subtitle,
    description,
    date: e.date,
    time: e.time,
    detail_url: `${BASE}/index.php?id=${e.id}`,
    ticket_url: e.ticketUrl,
    image_url: e.image,
    price_min: e.priceMin,
    city: "darmstadt",
    lat: LAT,
    lon: LON,
    labels: resolveStageLabels({
      title: e.title,
      subtitle: e.subtitle,
      hint: description,
      defaultLabel: "stage:theater",
      classifier: "scraper-hardcoded",
      confidence: 0.8,
    }),
  };
}

function parseEvents(html: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  // Split at each programme item so we can keep the regexps simple.
  const chunks = html.split('<li id="li');

  for (const chunk of chunks.slice(1)) {
    const idMatch = chunk.match(/^(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];

    const rightIdx = chunk.indexOf('<div class="right">');
    if (rightIdx === -1) continue;
    const leftHtml = chunk.slice(0, rightIdx);
    const rightHtml = chunk.slice(rightIdx + '<div class="right">'.length);

    const header = extractHeader(leftHtml);
    if (!header) continue;

    const description = extractDescription(rightHtml);
    const subtitle = extractTeaser(rightHtml);
    const image = extractImage(rightHtml) ?? extractThumb(leftHtml);
    const ticketUrl = pickTicketUrl(extractButtonUrls(leftHtml));
    const priceMin = extractPrice(leftHtml);

    events.push({
      id,
      title: header.title,
      subtitle,
      description,
      date: header.date,
      time: header.time,
      image,
      ticketUrl,
      priceMin,
    });
  }

  return events;
}

function extractHeader(leftHtml: string): { title: string; date: string; time: string } | null {
  const m = leftHtml.match(/<h2><span class="date">([^<]+)<\/span><br \/>([^<]+)<\/h2>/);
  if (!m) return null;

  const dateTime = parseGermanDateTime(decodeEntities(m[1]));
  if (!dateTime) return null;

  return {
    title: decodeEntities(stripHtml(m[2])).trim(),
    date: dateTime.date,
    time: dateTime.time,
  };
}

function parseGermanDateTime(raw: string): { date: string; time: string } | null {
  const m = raw.match(/(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, day, month, year, hour, minute] = m;
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

function extractTeaser(rightHtml: string): string | null {
  const m = rightHtml.match(/<span class="teaser">([^<]+)<\/span>/);
  return m ? decodeEntities(stripHtml(m[1])).trim() : null;
}

function extractDescription(rightHtml: string): string | null {
  const paragraphs: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/g;
  for (const m of rightHtml.matchAll(re)) {
    const text = decodeEntities(stripHtml(m[1])).trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs.length > 0 ? paragraphs.join(" ") : null;
}

function extractThumb(leftHtml: string): string | null {
  const m = leftHtml.match(/<a href="index\.php\?id=\d+" class="imglink"><img src="([^"]+)"/);
  return m ? toAbsolute(m[1]) : null;
}

function extractImage(rightHtml: string): string | null {
  const m = rightHtml.match(/<img src="([^"]+)"/);
  return m ? toAbsolute(m[1]) : null;
}

function extractButtonUrls(leftHtml: string): string[] {
  const urls: string[] = [];
  const tagRe = /<a\b[^>]*\bclass="button"[^>]*>/g;
  for (const tag of leftHtml.matchAll(tagRe)) {
    const href = tag[0].match(/\bhref="([^"]+)"/);
    if (href) urls.push(decodeEntities(href[1]));
  }
  return urls;
}

function pickTicketUrl(urls: string[]): string | null {
  if (urls.length === 0) return null;
  const ztix = urls.find((u) => u.includes("ztix.de"));
  if (ztix) return ztix;
  const hessen = urls.find((u) => u.includes("hessen-szene.de"));
  if (hessen) return hessen;
  return urls[0];
}

function extractPrice(leftHtml: string): number | null {
  const text = decodeEntities(stripHtml(leftHtml)).replace(/\s+/g, " ");
  if (/Eintritt\s+(frei|kostenlos)/i.test(text)) return null;
  const m = text.match(/Eintritt\s+(\d{1,3}(?:[.,]\d{2})?)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toAbsolute(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return `${BASE}/${src.replace(/^\//, "")}`;
}
