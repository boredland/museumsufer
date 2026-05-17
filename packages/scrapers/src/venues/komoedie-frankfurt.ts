import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://diekomoedie.de";
const EVENTS_URL = `${BASE}/events/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Die Komödie runs the Modern Events Calendar (MEC) WordPress plugin.
 * `/events/` lists every upcoming performance as `<article class="mec-event-article">`,
 * each with a title, themisweb.de ticket link (carrying `yymm=YYYYMMDD`),
 * `<span class="mec-start-time">HH:MM</span>`, and optional caption labels.
 *
 * No public sold-out / price data. Description and image come from the
 * production's WordPress page (`/<slug>/`) — single fetch per show, then
 * fan-out across the show's performances.
 */

const ARTICLE_RE = /<article[^>]*\bmec-event-article\b[^>]*>([\s\S]*?)<\/article>/g;
const EVENT_LINK_RE =
  /<h3[^>]*class="[^"]*mec-event-title[^"]*"[^>]*>\s*<a[^>]*data-event-id="(\d+)"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
const TIME_RE = /<span class="mec-start-time">([^<]+)<\/span>/i;
const YYMM_RE = /[?&](?:amp;)?yymm=(\d{8})/;

interface RawPerf {
  slug: string;
  title: string;
  date: string;
  time: string | null;
  eventId: string;
  ticketUrl: string;
}

interface DetailFields {
  description: string | null;
  image: string | null;
  subtitle: string | null;
}

export async function scrapeKomoedieFrankfurt(): Promise<VenueScrapeResult> {
  const html = await fetchHtml(EVENTS_URL);
  const perfs = parsePerformances(html);
  const detailsBySlug = await enrichDetails(perfs);

  const events: CanonicalScrapedEvent[] = perfs.map((p) => {
    const detail = detailsBySlug.get(p.slug) ?? { description: null, image: null, subtitle: null };
    return {
      source_event_id: p.eventId,
      title: p.title,
      subtitle: detail.subtitle,
      description: detail.description ?? detail.subtitle,
      date: p.date,
      time: p.time,
      detail_url: normalizeUrl(`/${p.slug}/`, BASE),
      ticket_url: p.ticketUrl,
      image_url: detail.image,
      venue_room: null,
      labels: resolveStageLabels({ title: p.title, subtitle: detail.subtitle, confidence: 0.85 }),
    };
  });

  return { source_slug: "komoedie-frankfurt", display_name: "Die Komödie Frankfurt", events };
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

  for (const m of html.matchAll(ARTICLE_RE)) {
    const block = m[1];
    const linkMatch = block.match(EVENT_LINK_RE);
    if (!linkMatch) continue;

    const [, eventId, hrefRaw, titleRaw] = linkMatch;
    const ticketUrl = decodeEntities(hrefRaw);
    const title = stripHtml(titleRaw);
    if (!title) continue;

    const yymm = ticketUrl.match(YYMM_RE)?.[1];
    if (!yymm) continue;
    const date = `${yymm.slice(0, 4)}-${yymm.slice(4, 6)}-${yymm.slice(6, 8)}`;
    if (date < today) continue;

    const time = nullIfMidnight(stripHtml(block.match(TIME_RE)?.[1] ?? "")) || null;
    const slug = slugify(title);
    const dedup = `${slug}|${date}|${time ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    out.push({ slug, title, date, time, eventId, ticketUrl });
  }
  return out;
}

async function enrichDetails(perfs: RawPerf[]): Promise<Map<string, DetailFields>> {
  const bySlug = new Map<string, DetailFields>();
  for (const p of perfs) {
    if (bySlug.has(p.slug)) continue;
    try {
      const html = await fetchHtml(normalizeUrl(`/${p.slug}/`, BASE) ?? "");
      bySlug.set(p.slug, parseDetail(html));
    } catch (err) {
      console.warn(`komoedie-frankfurt detail enrichment failed for ${p.slug}:`, err);
      bySlug.set(p.slug, { description: null, image: null, subtitle: null });
    }
  }
  return bySlug;
}

function parseDetail(html: string): DetailFields {
  const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] ?? null;
  const heroImg =
    html.match(
      /<img[^>]*\bclass="[^"]*\b(?:wp-post-image|attachment-large|attachment-full)[^"]*"[^>]*\bsrc="([^"]+)"/i,
    )?.[1] ?? null;
  const fallbackImg =
    html.match(/<img[^>]*\bsrc="([^"]+\/wp-content\/uploads\/[^"]+\.(?:jpg|jpeg|png|webp))"/i)?.[1] ?? null;
  const image = og ?? heroImg ?? fallbackImg ?? null;

  const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripHtml(m[1]));
  const subtitle = ps.find((p) => p.length >= 12 && p.length <= 120 && !/cookie|datenschutz/i.test(p)) ?? null;
  const description = ps.find((p) => p.length >= 200 && !/cookie|datenschutz/i.test(p)) ?? null;

  return {
    description: description
      ? description.length > 800
        ? `${description.slice(0, 800).trimEnd()}…`
        : description
      : null,
    image,
    subtitle,
  };
}
