import { todayIso } from "../date";
import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml } from "../shared";
import type { ScrapedPerformance, ScrapedShow, ScrapeResult } from "../types";

const BASE = "https://theaterwillypraml.de";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Theater Willy Praml is a small WordPress site without a structured
 * spielplan. The current programme is the set of production posts shown
 * on the homepage as anchors `<a href="https://theaterwillypraml.de/<slug>/">`.
 * Each production page exposes its dates inside the `og:description`
 * meta tag in a fixed shape:
 *
 *   "Termine
 *
 *    17.05.2026 14:00-17:00 Uhr
 *    28.06.2026 14:00-17:00 Uhr
 *
 *    Eintritt 10,-€"
 *
 * We pull title, image, and dates from the per-production OG meta tags.
 */

const NAV_SLUGS = new Set([
  "archiv",
  "author",
  "category",
  "comments",
  "diskurs",
  "feed",
  "kontakt",
  "naxoshalle",
  "page",
  "presse",
  "repertoire",
  "reservierung",
  "schwarzes-brett",
  "spenden",
  "tag",
  "umfrage",
  "wp-admin",
  "wp-content",
  "wp-includes",
  "wp-json",
  "datenschutzerklaerung",
  "impressum",
  "newsletter",
]);

export async function scrapeWillyPraml(): Promise<ScrapeResult> {
  const home = await fetchHtml(`${BASE}/`);
  const slugs = extractProductionSlugs(home);

  const showsBySlug = new Map<string, ScrapedShow>();
  const performances: ScrapedPerformance[] = [];
  const seen = new Set<string>();
  const today = todayIso();

  for (const slug of slugs) {
    let html: string;
    try {
      html = await fetchHtml(`${BASE}/${slug}/`);
    } catch (err) {
      console.warn(`Willy Praml fetch ${slug} failed:`, err);
      continue;
    }
    const parsed = parseProduction(html, slug);
    if (!parsed) continue;
    const { show, perfs, priceEur } = parsed;

    let kept = 0;
    for (const p of perfs) {
      if (p.date < today) continue;
      const dedup = `${slug}|${p.date}|${p.time ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      performances.push({
        show_slug: slug,
        date: p.date,
        time: p.time,
        end_time: p.endTime,
        venue_room: p.venueRoom,
        provider_event_id: null,
        ticket_url: show.detail_url,
        status: "available",
        price_min: priceEur,
        price_max: priceEur,
      });
      kept++;
    }
    if (kept > 0) showsBySlug.set(slug, show);
  }

  return {
    theater_slug: "theater-willy-praml",
    shows: [...showsBySlug.values()],
    performances,
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

export function extractProductionSlugs(homeHtml: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of homeHtml.matchAll(
    /<a[^>]+href="https?:\/\/(?:www\.)?theaterwillypraml\.de\/([a-z][a-z0-9-]+)\/?"/gi,
  )) {
    const slug = m[1];
    if (NAV_SLUGS.has(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

interface ParsedProduction {
  show: ScrapedShow;
  perfs: { date: string; time: string | null; endTime: string | null; venueRoom: string | null }[];
  priceEur: number | null;
}

const DATE_TIME_RE = /(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2})[:.](\d{2})(?:\s*-\s*(\d{1,2})[:.](\d{2}))?/g;

export function parseProduction(html: string, slug: string): ParsedProduction | null {
  const title = decodeEntities(matchOg(html, "og:title") ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const description = decodeEntities(matchOg(html, "og:description") ?? "");
  const image = matchOg(html, "og:image") ?? null;

  if (!title) return null;
  if (!description.includes("Termine") && !DATE_TIME_RE.test(description)) {
    DATE_TIME_RE.lastIndex = 0;
    return null;
  }
  DATE_TIME_RE.lastIndex = 0;

  const perfs: ParsedProduction["perfs"] = [];
  for (const m of description.matchAll(DATE_TIME_RE)) {
    const date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const time = nullIfMidnight(`${m[4].padStart(2, "0")}:${m[5]}`);
    const endTime = m[6] ? nullIfMidnight(`${m[6].padStart(2, "0")}:${m[7]}`) : null;
    perfs.push({ date, time, endTime, venueRoom: parseVenueRoom(html) });
  }

  const priceEur = parsePrice(description);

  return {
    show: {
      slug,
      title,
      subtitle: parseSubtitle(description, title),
      description: stripHtml(description.replace(/Termine[\s\S]*?(?=Eintritt|$)/i, "")).slice(0, 800) || null,
      detail_url: `${BASE}/${slug}/`,
      image_url: image ? normalizeUrl(image, BASE) : null,
    },
    perfs,
    priceEur,
  };
}

function matchOg(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]*\\bcontent="([^"]+)"`, "i");
  const m = html.match(re);
  return m ? m[1] : null;
}

function parseSubtitle(description: string, title: string): string | null {
  // Often the description starts with "Termine ... Eintritt …" then the show title in caps,
  // followed by a German subtitle. Try to grab the first ≤120-char line that's not the title
  // and not the Termine block.
  const cleaned = description.replace(/Termine[\s\S]*?Eintritt[^.\n]*\.?/i, "").trim();
  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (line.length < 5 || line.length > 140) continue;
    if (line === title) continue;
    if (/^\d/.test(line)) continue;
    return line;
  }
  return null;
}

function parseVenueRoom(html: string): string | null {
  // Willy Praml runs almost exclusively at Naxoshalle. Fall back to that.
  if (/Naxoshalle/i.test(html)) return "Naxoshalle";
  return null;
}

const PRICE_RE = /Eintritt[\s\S]{0,40}?(\d+(?:[.,]\d{1,2})?)/i;

function parsePrice(description: string): number | null {
  const m = description.match(PRICE_RE);
  if (!m) return null;
  const num = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

void slugify;
