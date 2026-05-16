import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://stalburg.de";
const PROGRAMM_URL = `${BASE}/programm/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Stalburg Theater renders /programm/ as a month-by-month list of
 * `<li class="event-list-item">` blocks. Tabs at the top link to the next
 * 5–6 months (`/programm/year:2026/month:05`, …). Each event carries date,
 * time, room, title, byline, and a Reservix ticket URL — either dated
 * (`…/p/reservix/event/<id>`) or production-level (`…/p/reservix/group/<id>`).
 * No public sold-out / cancelled markers, no inline prices.
 *
 * Show detail pages carry a high-resolution production photo inside
 * `<div class="hero-image">` — one fetch per unique show.
 */

const EVENT_RE = /<li\s+class="event-list-item[^"]*">([\s\S]*?)<\/li>/g;

interface ParsedEvent {
  slug: string;
  title: string;
  subtitle: string | null;
  detailUrl: string;
  date: string;
  time: string | null;
  venueRoom: string | null;
  ticketUrl: string | null;
  providerEventId: string | null;
}

export async function scrapeStalburgTheater(): Promise<VenueScrapeResult> {
  const initialHtml = await fetchHtml(PROGRAMM_URL);
  const monthPaths = extractMonthPaths(initialHtml);
  if (monthPaths.length === 0) monthPaths.push("");

  const today = todayIso();
  const seen = new Set<string>();
  const parsed: ParsedEvent[] = [];

  for (const path of monthPaths) {
    const html = path === "" ? initialHtml : await fetchHtml(`${BASE}${path}`).catch(() => null);
    if (!html) continue;

    for (const event of parseEvents(html)) {
      if (event.date < today) continue;
      const dedup = `${event.slug}|${event.date}|${event.time ?? ""}|${event.venueRoom ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      parsed.push(event);
    }
  }

  const imageBySlug = await enrichWithDetailPages(parsed);
  const events: CanonicalScrapedEvent[] = parsed.map((p) => ({
    source_event_id: p.providerEventId ?? `${p.slug}|${p.date}|${p.time ?? ""}`,
    title: p.title,
    subtitle: p.subtitle,
    description: p.subtitle,
    date: p.date,
    time: p.time,
    detail_url: p.detailUrl,
    ticket_url: p.ticketUrl,
    image_url: imageBySlug.get(p.slug) ?? null,
    venue_room: p.venueRoom,
    labels: resolveStageLabels({ title: p.title, subtitle: p.subtitle, confidence: 0.85 }),
  }));

  return { source_slug: "stalburg-theater", events };
}

async function enrichWithDetailPages(events: ParsedEvent[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const seen = new Set<string>();
  for (const ev of events) {
    if (seen.has(ev.slug)) continue;
    seen.add(ev.slug);
    if (!ev.detailUrl) continue;
    try {
      const html = await fetchHtml(ev.detailUrl);
      const m = html.match(/<div\s+class="hero-image">\s*<img[^>]+src="([^"]+)"/i);
      if (m) out.set(ev.slug, m[1]);
    } catch (err) {
      console.warn(`stalburg-theater detail enrichment failed for ${ev.slug}:`, err);
    }
  }
  return out;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function extractMonthPaths(html: string): string[] {
  const paths = [...html.matchAll(/href="(\/programm\/year:\d{4}\/month:\d{2})"/g)].map((m) => m[1]);
  return [...new Set(paths)];
}

function parseEvents(html: string): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  for (const m of html.matchAll(EVENT_RE)) {
    const block = m[1];

    const dateMatch = block.match(/<strong>\s*\w+,\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!dateMatch) continue;
    const date = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;

    const timeMatch = block.match(/(\d{1,2}):(\d{2})\s*Uhr/);
    const time = timeMatch ? nullIfMidnight(`${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`) : null;

    const venueRoom =
      stripHtml(block.match(/<span\s+class="event-item-location">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "") || null;

    const titleAnchor = block.match(
      /<a\s+href="(https?:\/\/(?:www\.)?stalburg\.de\/veranstaltungen\/([a-z0-9-]+))"\s+class[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>(?:\s*<p>([\s\S]*?)<\/p>)?/i,
    );
    if (!titleAnchor) continue;
    const detailUrl = decodeEntities(titleAnchor[1]);
    const slug = titleAnchor[2];
    const title = stripHtml(titleAnchor[3]);
    if (!title) continue;
    const subtitle = titleAnchor[4] ? stripHtml(titleAnchor[4]) || null : null;

    const ticketHref = block.match(/<a\s+class="icon--cart"\s+href="(https?:\/\/[^"]+)"/i)?.[1];
    const ticketUrl = ticketHref ? decodeEntities(ticketHref) : null;
    const providerEventId =
      ticketUrl?.match(/\/p\/reservix\/event\/(\d+)/)?.[1] ??
      ticketUrl?.match(/\/p\/reservix\/group\/(\d+)/)?.[1] ??
      null;

    out.push({
      slug: slug || slugify(title),
      title,
      subtitle,
      detailUrl: normalizeUrl(detailUrl, BASE) ?? detailUrl,
      date,
      time,
      venueRoom,
      ticketUrl,
      providerEventId,
    });
  }
  return out;
}
