import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://diekomoedie.de";
const EVENTS_URL = `${BASE}/events/`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Die Komödie runs the Modern Events Calendar (MEC) WordPress plugin.
 * `/events/` lists every upcoming performance as `<article class="mec-event-article">`,
 * each with a title, themisweb.de ticket link (carrying `yymm=YYYYMMDD`),
 * `<span class="mec-start-time">HH:MM</span>`, and optional caption labels
 * like "Premiere".
 *
 * The site doesn't expose sold-out indicators or prices publicly, so every
 * row ships as `available` with null price.
 *
 * Description and image are pulled from each unique production's WordPress
 * page (`/<slug>/`) — single fetch per production.
 */

export async function scrapeKomoedieFrankfurt(): Promise<ScrapeResult> {
  const html = await fetchHtml(EVENTS_URL);
  const result = parseKomoedieHtml(html);
  await enrichShowsFromDetailPages(result);
  return result;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

const ARTICLE_RE = /<article[^>]*\bmec-event-article\b[^>]*>([\s\S]*?)<\/article>/g;
const EVENT_LINK_RE =
  /<h3[^>]*class="[^"]*mec-event-title[^"]*"[^>]*>\s*<a[^>]*data-event-id="(\d+)"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
const TIME_RE = /<span class="mec-start-time">([^<]+)<\/span>/i;
const YYMM_RE = /[?&](?:amp;)?yymm=(\d{8})/;

export function parseKomoedieHtml(html: string): ScrapeResult {
  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

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
    const dedup = `${slug}|${date}|${time}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    if (!showsBySlug.has(slug)) {
      showsBySlug.set(slug, {
        slug,
        title,
        subtitle: null,
        description: null,
        detail_url: normalizeUrl(`/${slug}/`, BASE),
        image_url: null,
      });
    }

    performances.push({
      show_slug: slug,
      date,
      time,
      end_time: null,
      venue_room: null,
      provider_event_id: eventId,
      ticket_url: ticketUrl,
      status: "available",
    });
  }

  return {
    theater_slug: "komoedie-frankfurt",
    shows: [...showsBySlug.values()],
    performances,
  };
}

async function enrichShowsFromDetailPages(result: ScrapeResult): Promise<void> {
  for (const show of result.shows) {
    if (!show.detail_url) continue;
    try {
      const html = await fetchHtml(show.detail_url);
      const detail = parseKomoedieDetail(html);
      if (detail.description) show.description = detail.description;
      if (detail.image) show.image_url = detail.image;
      if (detail.subtitle && !show.subtitle) show.subtitle = detail.subtitle;
    } catch (err) {
      console.warn(`Komödie detail enrichment failed for ${show.slug}:`, err);
    }
  }
}

interface KomoedieDetail {
  description: string | null;
  image: string | null;
  subtitle: string | null;
}

export function parseKomoedieDetail(html: string): KomoedieDetail {
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
