import { classifyMusic } from "@museumsufer/classify";
import {
  decodeEntities,
  GERMAN_MONTHS,
  normalizeUrl,
  nullIfMidnight,
  stripHtml,
  todayIso,
  truncate,
} from "@museumsufer/core";
import PQueue from "p-queue";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://oper-frankfurt.de";
const KONZERTE_URL = `${BASE}/de/konzerte/`;
const LIEDERABENDE_URL = `${BASE}/de/liederabende/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const REQUEST_DELAY_MS = 200;
const DETAIL_FETCH_BUDGET = 40;
const DETAIL_CONCURRENCY = 4;

type MusicFallback = "classical" | "chamber";

interface RawEvent {
  slug: string;
  title: string;
  subtitle: string | null;
  date: string;
  time: string | null;
  venueRoom: string | null;
  detailUrl: string;
  ticketUrl: string | null;
  providerEventId: string | null;
  fallbackGenre: MusicFallback;
}

/**
 * Oper Frankfurt's `/de/konzerte/` and `/de/liederabende/` pages render
 * `repertoire-element-mini` cards with the full date in `<span class="meta">`.
 * Liederabende default to chamber, konzerte to classical; the keyword pass
 * may upgrade either when title/subtitle indicates sacred/jazz/etc.
 */
export async function scrapeOperFrankfurtKonzerte(): Promise<VenueScrapeResult> {
  const konzerteHtml = await fetchHtml(KONZERTE_URL);
  await sleep(REQUEST_DELAY_MS);
  const liederHtml = await fetchHtml(LIEDERABENDE_URL);

  const raw: RawEvent[] = [...parseListing(konzerteHtml, "classical"), ...parseListing(liederHtml, "chamber")];

  const today = todayIso();
  const dedupedBySlug = new Map<string, RawEvent[]>();
  const seen = new Set<string>();

  for (const r of raw) {
    if (r.date < today) continue;
    const key = `${r.slug}|${r.date}|${r.time ?? ""}|${r.venueRoom ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bucket = dedupedBySlug.get(r.slug);
    if (bucket) bucket.push(r);
    else dedupedBySlug.set(r.slug, [r]);
  }

  const enrichment = new Map<string, OperDetail>();
  const slice = [...dedupedBySlug].slice(0, DETAIL_FETCH_BUDGET);
  const queue = new PQueue({ concurrency: DETAIL_CONCURRENCY });
  for (const [slug, group] of slice) {
    const sample = group.find((g) => g.providerEventId) ?? group[0];
    const enrichmentUrl = sample.providerEventId
      ? `${sample.detailUrl}?id_datum=${sample.providerEventId}`
      : sample.detailUrl;
    queue.add(async () => {
      try {
        const html = await fetchHtml(enrichmentUrl);
        enrichment.set(slug, parseOperDetail(html));
      } catch (err) {
        console.warn(`oper-frankfurt detail enrichment failed for ${slug}:`, err);
      }
    });
  }
  await queue.onIdle();

  const events: CanonicalScrapedEvent[] = [];
  for (const group of dedupedBySlug.values()) {
    for (const r of group) {
      const detail = enrichment.get(r.slug);
      const description = detail?.description ?? null;
      const genre = classifyMusic(r.title, r.subtitle, description, r.fallbackGenre);
      events.push({
        source_event_id: r.slug,
        title: r.title,
        subtitle: r.subtitle,
        description: description ? truncate(description, 800) : null,
        date: r.date,
        time: r.time,
        end_time: null,
        detail_url: r.detailUrl,
        ticket_url: r.ticketUrl,
        image_url: detail?.image ?? null,
        price_min: detail?.priceEuro ?? null,
        price_max: detail?.priceEuro ?? null,
        performers: null,
        venue_room: r.venueRoom,
        labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
      });
    }
  }

  return { source_slug: "oper-frankfurt-konzerte", events };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`oper-frankfurt fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseListing(html: string, fallbackGenre: MusicFallback): RawEvent[] {
  const blocks = extractRepertoireBlocks(html);
  const out: RawEvent[] = [];
  for (const block of blocks) {
    const parsed = parseElement(block, fallbackGenre);
    if (parsed) out.push(parsed);
  }
  return out;
}

interface OperDetail {
  priceEuro: number | null;
  description: string | null;
  image: string | null;
}

function parseOperDetail(html: string): OperDetail {
  const priceText = match1(html, /<dt>\s*Preise\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i);
  const priceMatch = priceText?.match(/(\d{1,3})\s*Euro/i);
  const priceEuro = priceMatch ? parseInt(priceMatch[1], 10) : null;

  let description: string | null = null;
  const articleStart = html.search(/<div\s+class="article-header"/i);
  if (articleStart !== -1) {
    const region = html.slice(articleStart);
    const firstLongP = [...region.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripHtml(decodeEntities(m[1])))
      .find((t) => t.length >= 120 && !/cookie|datenschutz|google|analyse/i.test(t));
    if (firstLongP) description = firstLongP;
  }

  const imageHref = match1(html, /<a\s+class="item slide"[^>]*data-src="([^"]+)"/);
  const image = imageHref ? normalizeUrl(imageHref, BASE) : null;

  return { priceEuro, description, image };
}

const REPERTOIRE_OPEN = /<div class="repertoire-element[^"]*">/g;

function extractRepertoireBlocks(html: string): string[] {
  const blocks: string[] = [];
  for (const match of html.matchAll(REPERTOIRE_OPEN)) {
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

function parseElement(block: string, fallbackGenre: MusicFallback): RawEvent | null {
  const linkMatch = block.match(/<a\b[^>]*\bhref="([^"]+)"[^>]*class="[^"]*\bseason-hover-text\b/);
  const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
  if (!linkMatch || !titleMatch) return null;

  const href = decodeEntities(linkMatch[1]);
  const slug = deriveSlug(href);
  const title = stripHtml(decodeEntities(titleMatch[1])).trim();
  if (!title) return null;

  const meta = textOf(block, /<span\s+class="meta"[^>]*>([\s\S]*?)<\/span>/);
  const parsedMeta = parseMeta(meta);
  if (!parsedMeta.date) return null;

  const subtitle = extractSubtitle(block);
  const idDatum = match1(href, /[?&]id_datum=(\d+)/);
  const hrefPath = href.split("?")[0];
  const detailUrl = normalizeUrl(hrefPath, BASE) ?? `${BASE}/de/spielplan/${slug}/`;
  const externalTicket = match1(
    block,
    /<div\s+class="element-labels[^"]*"[^>]*>[\s\S]*?<a\b[^>]*\bhref="([^"]+)"[^>]*class="[^"]*\bbtn-link-blank\b/,
  );
  const ticketUrl = externalTicket
    ? decodeEntities(externalTicket)
    : idDatum
      ? (normalizeUrl(href, BASE) ?? null)
      : null;

  return {
    slug,
    title,
    subtitle,
    date: parsedMeta.date,
    time: parsedMeta.time,
    venueRoom: parsedMeta.venueRoom,
    detailUrl,
    ticketUrl,
    providerEventId: idDatum,
    fallbackGenre,
  };
}

function extractSubtitle(block: string): string | null {
  const infoMatch = block.match(/<div\s+class="info"[^>]*>([\s\S]*?)<\/div>/);
  if (!infoMatch) return null;
  const em = infoMatch[1].match(/<em[^>]*>([\s\S]*?)<\/em>/);
  const candidate = em ? em[1] : infoMatch[1];
  const text = stripHtml(decodeEntities(candidate)).trim();
  if (!text) return null;
  if (/^vorverkauf\b/i.test(text)) return null;
  return text;
}

interface ParsedMeta {
  date: string | null;
  time: string | null;
  venueRoom: string | null;
}

function parseMeta(meta: string | null): ParsedMeta {
  if (!meta) return { date: null, time: null, venueRoom: null };
  const dateMatch = meta.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/);
  let date: string | null = null;
  if (dateMatch) {
    const month = GERMAN_MONTHS[dateMatch[2].toLowerCase()];
    if (month) {
      const day = dateMatch[1].padStart(2, "0");
      date = `${dateMatch[3]}-${String(month).padStart(2, "0")}-${day}`;
    }
  }
  const timeMatch = meta.match(/(\d{1,2})[.:](\d{2})\s*Uhr/);
  const time = timeMatch ? nullIfMidnight(`${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`) : null;

  const venueSegment = meta.split(",").pop()?.trim() ?? null;
  const venueRoom = venueSegment && !/\bUhr\b/.test(venueSegment) ? venueSegment : null;

  return { date, time, venueRoom };
}

function deriveSlug(href: string): string {
  const cleaned = href.replace(/^\/+/, "").replace(/^de\/spielplan\//, "");
  const m = cleaned.match(/^([^/?#]+)/);
  return m ? m[1] : cleaned;
}

function match1(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1] : null;
}

function textOf(block: string, re: RegExp): string | null {
  const m = block.match(re);
  return m ? stripHtml(decodeEntities(m[1])).trim() || null : null;
}
