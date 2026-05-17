import { classifyMusic } from "@museumsufer/classify";
import { dateOffset, decodeEntities, normalizeUrl, slugify, stripHtml, todayIso, truncate } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.kronbergacademy.de";
const CALENDAR_PATH = "/konzerte-projekte/kalender";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const MAX_PAGES = 20;
const THROTTLE_MS = 200;

export async function scrapeKronbergAcademy(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(150);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? `${BASE}${CALENDAR_PATH}` : `${BASE}${CALENDAR_PATH}/seite-${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`kronberg-academy fetch failed: ${url} → ${res.status}`);
    const html = await res.text();

    const blocks = extractEventBlocks(html);
    if (blocks.length === 0) break;

    let pastHorizon = false;
    for (const block of blocks) {
      const parsed = parseEvent(block);
      if (!parsed) continue;
      if (parsed.date < today) continue;
      if (parsed.date > horizon) {
        pastHorizon = true;
        continue;
      }
      const dedup = `${parsed.source_event_id}|${parsed.date}|${parsed.time ?? ""}|${parsed.venue_room ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      events.push(parsed);
    }

    if (pastHorizon) break;
    if (page < MAX_PAGES) await sleep(THROTTLE_MS);
  }

  return { source_slug: "kronberg-academy", display_name: "Kronberg Academy / Casals Forum", events };
}

function extractEventBlocks(html: string): string[] {
  const blocks: string[] = [];
  const opener = /<div class="events__list border-top[^"]*">/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(html)) !== null) {
    const end = findMatchingDivEnd(html, match.index + match[0].length);
    if (end > 0) blocks.push(html.slice(match.index, end));
  }
  return blocks;
}

function findMatchingDivEnd(html: string, start: number): number {
  const tag = /<\/?div\b[^>]*>/g;
  tag.lastIndex = start;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html)) !== null) {
    if (m[0].startsWith("</")) {
      depth--;
      if (depth === 0) return m.index + m[0].length;
    } else {
      depth++;
    }
  }
  return -1;
}

function parseEvent(block: string): CanonicalScrapedEvent | null {
  const dt = block.match(/<time[^>]*datetime="(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!dt) return null;
  const date = dt[1];
  const startTime = dt[2];

  const timeText = matchInner(block, /class="events__time"[^>]*>([^<]+)</);
  const endTime = extractEndTime(timeText);

  const titleHtml = matchInner(block, /<h5[^>]*class="[^"]*events__title[^"]*"[^>]*>([\s\S]*?)<\/h5>/);
  const linkMatch = titleHtml?.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  if (!linkMatch) return null;
  const detailPath = decodeEntities(linkMatch[1]);
  const title = stripHtml(linkMatch[2]);
  if (!title) return null;

  const series = stripHtmlOrNull(matchInner(block, /class="events__series"[^>]*>([\s\S]*?)<\/div>/));
  const teaser = stripHtmlOrNull(matchInner(block, /class="events__teaser"[^>]*>([\s\S]*?)<\/div>/));
  const location = stripHtmlOrNull(matchInner(block, /class="events__location"[^>]*>([\s\S]*?)<\/div>/));

  const performers = extractPerformers(block);
  const description = extractDescription(block);

  const priceText = matchInner(block, /class="events__prices[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  const { priceMin, priceMax } = parsePrice(priceText);

  const ticketUrl = extractTicketUrl(block);

  const detailUrl = normalizeUrl(detailPath, BASE);
  const slug = deriveSlug(detailPath, title, date);
  const subtitle = pickSubtitle(series, teaser);
  const genre = classifyMusic(title, subtitle, description, "classical");

  return {
    source_event_id: slug,
    title,
    subtitle,
    description,
    date,
    time: startTime,
    end_time: endTime,
    detail_url: detailUrl,
    ticket_url: ticketUrl,
    image_url: null,
    price_min: priceMin,
    price_max: priceMax,
    performers,
    venue_room: location,
    labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
  };
}

function matchInner(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern);
  return m ? m[1] : null;
}

function stripHtmlOrNull(html: string | null): string | null {
  if (!html) return null;
  const text = stripHtml(html);
  return text || null;
}

function extractEndTime(timeText: string | null): string | null {
  if (!timeText) return null;
  const m = timeText.match(/(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/);
  return m ? m[2] : null;
}

function extractPerformers(block: string): string | null {
  const names: string[] = [];
  const re = /<span class="events__person-name">([\s\S]*?)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const name = stripHtml(m[1]);
    if (name) names.push(name);
  }
  if (names.length === 0) return null;
  return names.join(", ");
}

function extractDescription(block: string): string | null {
  const programIdx = block.indexOf("Programm</p>");
  if (programIdx < 0) return null;
  const slice = block.slice(programIdx + "Programm</p>".length);
  const listMatch = slice.match(/<div class="events__programme-list">([\s\S]*?)<\/div>/);
  if (!listMatch) return null;
  return truncate(listMatch[1], 800);
}

function parsePrice(text: string | null): { priceMin: number | null; priceMax: number | null } {
  if (!text) return { priceMin: null, priceMax: null };
  const clean = stripHtml(text);
  if (!clean || /frei/i.test(clean)) return { priceMin: 0, priceMax: 0 };
  const numbers = [...clean.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) => Number(m[1].replace(",", ".")));
  if (numbers.length === 0) return { priceMin: null, priceMax: null };
  return {
    priceMin: Math.min(...numbers),
    priceMax: numbers.length > 1 ? Math.max(...numbers) : null,
  };
}

function extractTicketUrl(block: string): string | null {
  const m = block.match(/<a[^>]*class="[^"]*event-ticket__link[^"]*"[^>]*href="([^"]+)"/);
  if (!m) {
    const fallback = block.match(/href="(https:\/\/[^"]*eventim-inhouse[^"]+)"/);
    return fallback ? decodeEntities(fallback[1]) : null;
  }
  return decodeEntities(m[1]);
}

function pickSubtitle(series: string | null, teaser: string | null): string | null {
  if (series && teaser) return `${series} · ${teaser}`;
  return series || teaser;
}

function deriveSlug(detailPath: string, title: string, date: string): string {
  const tail = detailPath.split("/").filter(Boolean).pop();
  if (tail) return tail;
  return `${slugify(title)}-${date}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
