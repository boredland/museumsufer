import { todayIso } from "../date";
import { normalizeUrl, nullIfMidnight, slugify, stripHtml } from "../shared";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://www.schauspielfrankfurt.de";
const SPIELPLAN_URL = `${BASE}/spielplan/`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeSchauspielFrankfurt(): Promise<ScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) {
    throw new Error(`Schauspiel spielplan fetch failed: ${res.status}`);
  }
  const html = await res.text();
  return parseSchauspielHtml(html);
}

export function parseSchauspielHtml(html: string): ScrapeResult {
  const blocks = extractPerformanceBlocks(html);

  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const block of blocks) {
    const parsed = parsePerformance(block);
    if (!parsed) continue;
    const { show, perf } = parsed;

    if (perf.date < today) continue;

    const dedup = `${show.slug}|${perf.date}|${perf.time ?? ""}|${perf.venue_room ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    if (!showsBySlug.has(show.slug)) showsBySlug.set(show.slug, show);
    performances.push({ ...perf, show_slug: show.slug });
  }

  return {
    theater_slug: "schauspiel-frankfurt",
    shows: [...showsBySlug.values()],
    performances,
  };
}

const PERFORMANCE_OPEN = /<div\s+class="performance[^"]*"[^>]*itemtype="http:\/\/schema\.org\/Event"[^>]*>/g;

function extractPerformanceBlocks(html: string): string[] {
  const blocks: string[] = [];
  for (const match of html.matchAll(PERFORMANCE_OPEN)) {
    const start = match.index;
    if (start === undefined) continue;
    const endIdx = findBlockEnd(html, start + match[0].length);
    if (endIdx > 0) blocks.push(html.slice(start, endIdx));
  }
  return blocks;
}

function findBlockEnd(html: string, from: number): number {
  let depth = 1;
  let i = from;
  while (i < html.length) {
    const open = html.indexOf("<div", i);
    const close = html.indexOf("</div>", i);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      depth++;
      i = open + 4;
    } else {
      depth--;
      i = close + 6;
      if (depth === 0) return i;
    }
  }
  return -1;
}

interface ParsedPerformance {
  show: ScrapedShow;
  perf: Omit<ScrapedPerformance, "show_slug">;
}

function parsePerformance(block: string): ParsedPerformance | null {
  const startDate = match1(block, /<meta\s+itemprop="startDate"\s+content="([^"]+)"/);
  if (!startDate) return null;

  const date = startDate.slice(0, 10);
  const time = nullIfMidnight(startDate.slice(11, 16));

  const dateLine = textOf(block, /<div\s+class="performance__dateandtime"[^>]*>([\s\S]*?)<\/div>/);
  const endTime = parseEndTime(dateLine);

  const venueRoom = textOf(block, /<div\s+class="performance__location"[^>]*>([\s\S]*?)<\/div>/);

  const titleLink = match1(block, /<h3[^>]*class="headline__headline"[^>]*>\s*<a\s+href="([^"]+)"/);
  const titleText = textOf(
    block,
    /<h3[^>]*class="headline__headline"[^>]*>[\s\S]*?<span\s+itemprop="name"[^>]*>([\s\S]*?)<\/span>/,
  );
  if (!titleLink || !titleText) return null;

  const title = titleText.replace(/­/g, "");
  const detailUrl = normalizeUrl(titleLink, BASE);
  const slug = deriveSlug(titleLink, title);

  const subtitle = textOf(block, /<div\s+class="performance__author"[^>]*>([\s\S]*?)<\/div>/);
  const productionInfo = textOf(block, /<div\s+class="performance__productioninfo"[^>]*>([\s\S]*?)<\/div>/);

  const ticketHref = extractTicketHref(block);
  const eventimEventId = ticketHref ? match1(ticketHref, /[?&](?:amp;)?event=(\d+)/) : null;
  const isCancelled = /performance--is-canceled/.test(block);
  const isSoldOut = /performance--is-soldout/.test(block);
  const status = isCancelled ? "cancelled" : isSoldOut ? "sold_out" : ticketHref ? "available" : "unknown";

  const show: ScrapedShow = {
    slug,
    title,
    subtitle: subtitle || null,
    description: productionInfo ? `${subtitle ? `${subtitle}\n` : ""}${productionInfo}`.trim() : subtitle || null,
    detail_url: detailUrl,
    image_url: null,
  };

  const perf: Omit<ScrapedPerformance, "show_slug"> = {
    date,
    time,
    end_time: endTime,
    venue_room: venueRoom || null,
    provider_event_id: eventimEventId,
    ticket_url: ticketHref || null,
    status,
  };

  return { show, perf };
}

function parseEndTime(line: string | null): string | null {
  if (!line) return null;
  const m = line.match(/(\d{1,2})[.:](\d{2})\s*[–-]\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  const h = m[3].padStart(2, "0");
  return nullIfMidnight(`${h}:${m[4]}`);
}

function deriveSlug(href: string, title: string): string {
  const m = href.match(/\/spielplan\/kalender\/([^/]+)\/?/);
  return m ? m[1] : slugify(title);
}

function extractTicketHref(block: string): string | null {
  for (const m of block.matchAll(/<a\b([^>]*)>/g)) {
    const attrs = m[1];
    if (!/class="[^"]*\bperformance__ticketlink\b/.test(attrs)) continue;
    const href = attrs.match(/href="([^"]+)"/);
    if (href) return decodeHtmlEntities(href[1]);
  }
  return null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function match1(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1] : null;
}

function textOf(block: string, re: RegExp): string | null {
  const m = block.match(re);
  return m ? stripHtml(m[1]) : null;
}
