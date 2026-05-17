import {
  decodeEntities,
  normalizeUrl,
  nullIfMidnight,
  slugify,
  stripHtml,
  todayIso,
  truncate,
} from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.diedramatischebuehne.de";
const PROGRAMM_URL = `${BASE}/programm/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Die Dramatische Bühne uses the Events Made Easy WordPress plugin.
 * `/programm/` renders an `<ul class="eme_events_list">` where every `<li>`
 * is one performance. Show detail pages add og:image and "Eintritt" pricing
 * — fetched once per show and fanned out across its performances.
 */

const GERMAN_MONTHS: Record<string, number> = {
  Januar: 1,
  Februar: 2,
  März: 3,
  April: 4,
  Mai: 5,
  Juni: 6,
  Juli: 7,
  August: 8,
  September: 9,
  Oktober: 10,
  November: 11,
  Dezember: 12,
};

const ITEM_RE = /<ul\s+class=['"]eme_events_list['"]>([\s\S]*?)<\/ul>/i;
const LI_RE = /<li>([\s\S]*?)<\/li>/g;
const TITLE_RE = /<h1>\s*<a[^>]+href=['"]([^'"]+)['"][^>]*>\s*([\s\S]*?)\s*<\/a>\s*<\/h1>/i;
const DATE_RE =
  /<h2>\s*(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(\d{4})\s*-\s*(\d{1,2})(?:[.:](\d{2}))?\s*Uhr\s*(?:,\s*([\s\S]*?))?\s*<\/h2>/i;
const IMG_RE = /<img[^>]+\bsrc=['"]([^'"]+)['"][^>]*\bclass=['"]eme_event_image['"]/i;

interface ShowEnrichment {
  image: string | null;
  priceMin: number | null;
  priceMax: number | null;
}

interface RawPerf {
  slug: string;
  title: string;
  detailUrl: string | null;
  date: string;
  time: string | null;
  venueRoom: string | null;
  description: string | null;
  image: string | null;
}

export async function scrapeDramatischeBuehne(): Promise<VenueScrapeResult> {
  const html = await fetchHtml(PROGRAMM_URL);
  const perfs = parsePerformances(html);
  const enrichment = await enrichShows(perfs);

  const events: CanonicalScrapedEvent[] = perfs.map((p) => {
    const e = enrichment.get(p.slug) ?? { image: null, priceMin: null, priceMax: null };
    return {
      source_event_id: `${p.slug}|${p.date}|${p.time ?? ""}|${p.venueRoom ?? ""}`,
      title: p.title,
      subtitle: null,
      description: p.description,
      date: p.date,
      time: p.time,
      detail_url: p.detailUrl,
      ticket_url: p.detailUrl,
      image_url: e.image ?? p.image,
      price_min: e.priceMin,
      price_max: e.priceMax,
      venue_room: p.venueRoom,
      labels: resolveStageLabels({ title: p.title, subtitle: null, hint: p.description, confidence: 0.85 }),
    };
  });

  return { source_slug: "dramatische-buehne", display_name: "Die Dramatische Bühne", events };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function parsePerformances(html: string): RawPerf[] {
  const today = todayIso();
  const out: RawPerf[] = [];
  const seen = new Set<string>();
  const list = html.match(ITEM_RE)?.[1];
  if (!list) return out;

  for (const m of list.matchAll(LI_RE)) {
    const block = m[1];
    const titleMatch = block.match(TITLE_RE);
    const dateMatch = block.match(DATE_RE);
    if (!titleMatch || !dateMatch) continue;

    const detailUrl = decodeEntities(titleMatch[1]);
    const title = stripHtml(titleMatch[2]);
    if (!title) continue;

    const day = parseInt(dateMatch[1], 10);
    const month = GERMAN_MONTHS[dateMatch[2]];
    if (!month) continue;
    const year = parseInt(dateMatch[3], 10);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date < today) continue;

    const hour = dateMatch[4].padStart(2, "0");
    const minute = dateMatch[5] ?? "00";
    const time = nullIfMidnight(`${hour}:${minute}`);

    const locationRaw = dateMatch[6]?.trim() ?? "";
    const venueRoom = parseRoom(locationRaw);

    const slug = slugify(title);
    const dedup = `${slug}|${date}|${time ?? ""}|${venueRoom ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    const imgSrc = block.match(IMG_RE)?.[1];
    out.push({
      slug,
      title,
      detailUrl: normalizeUrl(detailUrl, BASE),
      date,
      time,
      venueRoom,
      description: collectDescription(block),
      image: imgSrc ? normalizeUrl(imgSrc, BASE) : null,
    });
  }
  return out;
}

async function enrichShows(perfs: RawPerf[]): Promise<Map<string, ShowEnrichment>> {
  const out = new Map<string, ShowEnrichment>();
  for (const p of perfs) {
    if (out.has(p.slug) || !p.detailUrl) continue;
    try {
      const html = await fetchHtml(p.detailUrl);
      const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] ?? null;
      const range = parseEintrittRange(html);
      out.set(p.slug, {
        image: og,
        priceMin: range?.min ?? null,
        priceMax: range?.max ?? null,
      });
    } catch (err) {
      console.warn(`dramatische-buehne detail enrichment failed for ${p.slug}:`, err);
      out.set(p.slug, { image: null, priceMin: null, priceMax: null });
    }
  }
  return out;
}

function parseEintrittRange(html: string): { min: number; max: number } | null {
  const idx = html.search(/\bEintritt\b/i);
  if (idx < 0) return null;
  const window = html.slice(idx, idx + 800);
  const values = [...window.matchAll(/(\d{1,3})\s*(?:€|Euro)\b/gi)]
    .map((m) => parseInt(m[1], 10))
    .filter((n) => n >= 1 && n <= 200);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function parseRoom(location: string): string | null {
  if (!location) return null;
  const parts = location
    .split(/\s*,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return parts[0] || null;
  if (/Frankfurt am Main/i.test(parts[0]) && parts.length >= 2) return parts.slice(1).join(", ");
  return parts.join(", ");
}

function collectDescription(block: string): string | null {
  const paragraphs = [...block.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((m) => stripHtml(m[1]))
    .filter((t) => t.length >= 20);
  if (!paragraphs.length) return null;
  return truncate(paragraphs.join("\n"), 800);
}
