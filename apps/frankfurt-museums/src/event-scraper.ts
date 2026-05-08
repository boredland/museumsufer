/**
 * Pure-function event scraper. Per-museum: dispatches to the typed API
 * parser in api-scrapers.ts, normalises into the bundle's Event shape,
 * optionally enriches the next 7 days from detail pages. No D1.
 *
 * The script wires the result into SCRAPE_DATA. Previous-bundle data is
 * passed in to gate the website-URL discovery (sticky once found) and
 * enrichment passes (don't re-fetch already-enriched events).
 */

import { logFail, logInfo, logOk } from "@museumsufer/core";
import PQueue from "p-queue";
import { fetchEventsFromApi } from "./api-scrapers";
import { dateOffset, todayIso } from "./date";
import { getMuseumConfig } from "./museum-config";
import type { ParsedMuseum } from "./scraper";
import { classifyEvent, normalizeUrl } from "./shared";

const CONCURRENCY = 5;

export interface ScrapedEvent {
  museum_slug: string;
  title: string;
  date: string;
  time: string | null;
  end_time: string | null;
  end_date: string | null;
  description: string | null;
  url: string | null;
  detail_url: string | null;
  image_url: string | null;
  price: string | null;
  category: string | null;
}

export interface PreviousEvents {
  events: ScrapedEvent[];
  museums: ParsedMuseum[];
}

interface ProxyConfig {
  url?: string;
  token?: string;
}

/** Fetch every museum's events, optionally enrich the next 7 days. The
 *  museums list is mutated in place to fill missing `website_url`s. */
export async function scrapeMuseumWebsites(
  museums: Map<string, ParsedMuseum>,
  opts: { previous?: PreviousEvents; proxy?: ProxyConfig } = {},
): Promise<ScrapedEvent[]> {
  await discoverWebsiteUrls(museums, opts.previous?.museums ?? []);

  const queue = new PQueue({ concurrency: CONCURRENCY });
  const all: ScrapedEvent[][] = [];
  for (const museum of museums.values()) {
    const config = getMuseumConfig(museum.slug);
    if (!config?.eventApi) continue; // skip silently — most museums don't have an API
    queue.add(async () => {
      try {
        const events = await scrapeOneMuseum(museum, opts.proxy);
        all.push(events);
        logOk("events", museum.slug, `${events.length} events`);
      } catch (e) {
        logFail("events", museum.slug, e instanceof Error ? e.message : String(e));
      }
    });
  }
  await queue.onIdle();

  const events = all.flat();
  const enriched = await enrichUpcomingEvents(events, opts.previous?.events ?? []);
  logInfo(`events: enriched ${enriched} of next 7 days from detail pages`);
  return events;
}

async function scrapeOneMuseum(museum: ParsedMuseum, proxy: ProxyConfig | undefined): Promise<ScrapedEvent[]> {
  const config = getMuseumConfig(museum.slug);
  const eventApi = config?.eventApi;
  if (!eventApi) return [];

  const proxyArg = config.proxy && proxy?.url ? { url: proxy.url, token: proxy.token } : undefined;
  const apiEvents = await fetchEventsFromApi(eventApi, proxyArg);

  return apiEvents
    .filter((e) => e.title && e.date)
    .map(
      (e): ScrapedEvent => ({
        // The override slug is honoured at the dump stage by mapping to a
        // resolvable museum slug — for now we record it in the same shape.
        museum_slug: e.museum_slug_override || museum.slug,
        title: e.title.replace(/\\"/g, '"').replace(/\\'/g, "'"),
        date: e.date,
        time: e.time,
        end_time: e.end_time,
        end_date: e.end_date,
        description: e.description ? e.description.replace(/\\"/g, '"').replace(/\\'/g, "'") : e.description,
        url: eventApi.endpoint,
        detail_url: e.detail_url,
        image_url: e.image_url,
        price: e.price,
        category: e.category || classifyEvent(e.title, e.description) || null,
      }),
    );
}

// ─── website_url discovery ────────────────────────────────────────────

async function discoverWebsiteUrls(museums: Map<string, ParsedMuseum>, previous: ParsedMuseum[]): Promise<void> {
  const previousBySlug = new Map(previous.map((m) => [m.slug, m]));

  const needsLookup: ParsedMuseum[] = [];
  for (const m of museums.values()) {
    if (m.website_url) continue;
    const prev = previousBySlug.get(m.slug);
    if (prev?.website_url) {
      m.website_url = prev.website_url; // sticky
      continue;
    }
    if (m.museumsufer_url.includes("museumsufer.de")) needsLookup.push(m);
  }

  const fetched = await Promise.all(
    needsLookup.map(async (museum) => {
      try {
        const res = await fetch(museum.museumsufer_url);
        if (!res.ok) return null;
        const html = await res.text();
        const match = html.match(/href="(https?:\/\/[^"]+)"[^>]*class="[^"]*margRight15\s+externelLink/);
        if (!match) return null;
        const websiteUrl = match[1];
        if (websiteUrl.includes("kultur-frankfurt.de")) return null;
        return { slug: museum.slug, websiteUrl };
      } catch (e) {
        console.error(`Failed to discover website for museum ${museum.slug}:`, e);
        return null;
      }
    }),
  );

  for (const f of fetched) {
    if (!f) continue;
    const m = museums.get(f.slug);
    if (m) m.website_url = f.websiteUrl;
  }
}

// ─── upcoming-event detail enrichment ─────────────────────────────────

async function enrichUpcomingEvents(events: ScrapedEvent[], previousEvents: ScrapedEvent[]): Promise<number> {
  const today = todayIso();
  const weekAhead = dateOffset(7);

  // Carry over previous enrichment so we don't re-fetch the same detail pages.
  const previousByKey = new Map(previousEvents.map((e) => [keyForEvent(e), e]));
  for (const ev of events) {
    const prev = previousByKey.get(keyForEvent(ev));
    if (!prev) continue;
    ev.price ??= prev.price;
    ev.image_url ??= prev.image_url;
    ev.time ??= prev.time;
    ev.end_time ??= prev.end_time;
    ev.description ??= prev.description;
  }

  const candidates = events
    .filter(
      (ev) =>
        ev.date >= today &&
        ev.date <= weekAhead &&
        ev.detail_url &&
        (ev.price === null || ev.image_url === null || ev.time === null || ev.description === null),
    )
    .slice(0, 30);

  let enriched = 0;
  await Promise.all(
    candidates.map(async (ev) => {
      try {
        const details = await fetchEventDetails(ev.detail_url as string);
        if (!details) return;
        let touched = false;
        if (details.price && !ev.price) {
          ev.price = details.price;
          touched = true;
        }
        if (details.image_url && !ev.image_url) {
          ev.image_url = details.image_url;
          touched = true;
        }
        if (details.time && !ev.time) {
          ev.time = details.time;
          touched = true;
        }
        if (details.end_time && !ev.end_time) {
          // Reject if it's <= the start time (likely an opening-hours range).
          const start = ev.time || details.time || null;
          if (!start || details.end_time > start) {
            ev.end_time = details.end_time;
            touched = true;
          }
        }
        if (details.description && !ev.description) {
          ev.description = details.description;
          touched = true;
        }
        if (touched) enriched++;
      } catch {}
    }),
  );
  return enriched;
}

function keyForEvent(ev: ScrapedEvent): string {
  return `${ev.museum_slug}|${ev.title}|${ev.date}`;
}

async function fetchEventDetails(detailUrl: string): Promise<{
  price: string | null;
  image_url: string | null;
  time: string | null;
  end_time: string | null;
  description: string | null;
} | null> {
  let html: string;
  try {
    const res = await fetch(detailUrl, { redirect: "follow" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const imageUrl = extractImageFromHtml(html, detailUrl);
  const { time, end_time } = extractTimeFromHtml(html);
  const description = extractDescriptionFromHtml(html, "");
  const price = extractPriceFromHtml(html);

  return { price, image_url: imageUrl, time, end_time, description };
}

function extractTimeFromHtml(html: string): { time: string | null; end_time: string | null } {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const rangeMatch = text.match(/(\d{1,2}[:.]\d{2})\s*(?:–|-)\s*(\d{1,2}[:.]\d{2})\s*(?:Uhr|h)?/);
  if (rangeMatch) {
    return {
      time: rangeMatch[1].replace(".", ":"),
      end_time: rangeMatch[2].replace(".", ":"),
    };
  }
  const singleMatch = text.match(/(\d{1,2}[:.]\d{2})\s*(?:Uhr|h)/);
  if (singleMatch) {
    return { time: singleMatch[1].replace(".", ":"), end_time: null };
  }
  const commaMatch = text.match(/\d{2}\.\d{2}\.\d{4},?\s*(\d{1,2}[:.]\d{2})/);
  if (commaMatch) {
    return { time: commaMatch[1].replace(".", ":"), end_time: null };
  }
  return { time: null, end_time: null };
}

const AMOUNT = String.raw`\d+(?:[.,]\d{1,2})?(?:,-)?`;
const PRICE_TOKEN = String.raw`(?:€\s*${AMOUNT}|${AMOUNT}\s*(?:€|Euro|EUR))`;
const PRICE_RANGE = new RegExp(
  String.raw`${PRICE_TOKEN}(?:\s*(?:\/|–|-|bis)\s*${PRICE_TOKEN}(?:\s*(?:erm[äa]ßigt|reduziert|ermäßigt))?)?`,
  "i",
);

export function extractPriceFromHtml(html: string): string | null {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const scope = findContentScope(stripped);
  const text = decodeEntities(scope.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

  const eintrittFree = text.match(/Eintritt:?\s*(frei|kostenlos|kostenfrei)\b/i);
  if (eintrittFree) return "Eintritt frei";

  const eintrittPrice = text.match(new RegExp(String.raw`Eintritt:?\s*(${PRICE_RANGE.source})`, "i"));
  if (eintrittPrice) return `Eintritt ${eintrittPrice[1].trim()}`.replace(/\s+/g, " ");

  if (/\b(?:kostenlos|kostenfrei|Eintritt\s+frei|free\s+admission)\b/i.test(text)) {
    return "Eintritt frei";
  }

  const priceMatch = text.match(PRICE_RANGE);
  if (priceMatch) return priceMatch[0].replace(/\s+/g, " ").trim();

  return null;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ndash;": "–",
  "&mdash;": "—",
  "&#8211;": "–",
  "&#8212;": "—",
  "&#8216;": "‘",
  "&#8217;": "’",
  "&#8220;": "“",
  "&#8221;": "”",
  "&hellip;": "…",
  "&#8230;": "…",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

const DATETIME_ONLY = /^\s*\d{1,2}[.\s]\s?[\w.]+\s?\d{0,4}.{0,40}(?:Uhr|h)?\s*$/i;

const CAPTION_HINT = /(©|Photo:|Foto:|Courtesy)/i;
const CONTENT_CONTAINERS = [
  /<div[^>]*\bclass="(?:[^"]*\s)?(?:page-content|entry-content|wp-block-post-content|event-description|single-event-content|content-area|main-content|c-event-description|event-content)(?:\s[^"]*)?"[^>]*>/i,
  /<article\b[^>]*>/i,
  /<main\b[^>]*>/i,
];

function findContentScope(html: string): string {
  for (const re of CONTENT_CONTAINERS) {
    const m = re.exec(html);
    if (!m) continue;
    const start = m.index + m[0].length;
    const slice = html.slice(start, start + 60000);
    if (slice.length > 200) return slice;
  }
  return html;
}

export function extractDescriptionFromHtml(html: string, title: string): string | null {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const scope = findContentScope(stripped);
  const titleLower = title.toLowerCase().slice(0, 60);

  const paragraphs: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null = re.exec(scope);
  while (m !== null) {
    let text = m[1].replace(/<[^>]+>/g, " ");
    text = decodeEntities(text);
    text = text.replace(/\s+/g, " ").trim();
    if (
      text.length >= 80 &&
      !text.toLowerCase().startsWith(titleLower) &&
      !DATETIME_ONLY.test(text) &&
      !CAPTION_HINT.test(text.slice(0, 120))
    ) {
      paragraphs.push(text);
    }
    if (paragraphs.join(" ").length > 600) break;
    m = re.exec(scope);
  }

  if (paragraphs.length === 0) return null;
  let out = paragraphs.join(" ");
  if (out.length > 600) {
    const cut = out.slice(0, 600);
    const lastSpace = cut.lastIndexOf(" ");
    out = `${cut.slice(0, lastSpace > 0 ? lastSpace : 600)}…`;
  }
  return out;
}

export function extractImageFromHtml(html: string, pageUrl: string): string | null {
  const baseUrl = new URL(pageUrl).origin;
  const pageDomain = new URL(pageUrl).hostname;

  const ogMatch =
    html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i) ||
    html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i);
  if (ogMatch) {
    const ogUrl = normalizeUrl(ogMatch[1], baseUrl);
    if (ogUrl && isSameDomain(ogUrl, pageDomain)) return ogUrl;
  }

  const mainContent =
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html;

  const imgRe = /<img[^>]+src="([^"]+)"/gi;
  let match: RegExpExecArray | null = imgRe.exec(mainContent);
  while (match !== null) {
    const src = match[1];
    if (isContentImage(src)) {
      const url = normalizeUrl(src, baseUrl);
      if (url && isSameDomain(url, pageDomain)) return url;
    }
    match = imgRe.exec(mainContent);
  }

  return null;
}

function isContentImage(src: string): boolean {
  const lower = src.toLowerCase();
  if (!/\.(jpg|jpeg|png|webp)/.test(lower)) return false;
  if (/logo|icon|favicon|sprite|banner|partner|sponsor|social|button|badge/i.test(lower)) return false;
  if (/1x1|pixel|tracking|spacer/i.test(lower)) return false;
  return true;
}

function isSameDomain(url: string, pageDomain: string): boolean {
  try {
    const imgDomain = new URL(url).hostname;
    return imgDomain === pageDomain || imgDomain.endsWith(`.${pageDomain}`) || pageDomain.endsWith(`.${imgDomain}`);
  } catch {
    return true;
  }
}
