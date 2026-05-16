import { decodeEntities, normalizeUrl, nullIfMidnight, stripHtml } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://theaterwillypraml.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Theater Willy Praml is a small WordPress site without a structured
 * spielplan. The current programme is the set of production posts shown
 * on the homepage as anchors `<a href="https://theaterwillypraml.de/<slug>/">`.
 * Each production page exposes its dates inside the `og:description` meta
 * tag in a fixed shape:
 *
 *   "Termine
 *
 *    17.05.2026 14:00-17:00 Uhr
 *    28.06.2026 14:00-17:00 Uhr
 *
 *    Eintritt 10,-€"
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

const DATE_TIME_RE = /(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2})[:.](\d{2})(?:\s*-\s*(\d{1,2})[:.](\d{2}))?/g;
const PRICE_RE = /Eintritt[\s\S]{0,40}?(\d+(?:[.,]\d{1,2})?)/i;

export async function scrapeTheaterWillyPraml(): Promise<VenueScrapeResult> {
  const home = await fetchHtml(`${BASE}/`);
  const slugs = extractProductionSlugs(home);
  const today = new Date().toISOString().slice(0, 10);

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const slug of slugs) {
    let html: string;
    try {
      html = await fetchHtml(`${BASE}/${slug}/`);
    } catch (err) {
      console.warn(`theater-willy-praml fetch ${slug} failed:`, err);
      continue;
    }
    const parsed = parseProduction(html, slug, today);
    if (!parsed) continue;
    for (const ev of parsed) {
      if (seen.has(ev.source_event_id)) continue;
      seen.add(ev.source_event_id);
      events.push(ev);
    }
  }

  return { source_slug: "theater-willy-praml", events };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function extractProductionSlugs(homeHtml: string): string[] {
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

function parseProduction(html: string, slug: string, today: string): CanonicalScrapedEvent[] | null {
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

  const subtitle = parseSubtitle(description, title);
  const body = parseDescription(description);
  const priceEur = parsePrice(description);
  const venueRoom = parseVenueRoom(html);
  const detailUrl = `${BASE}/${slug}/`;
  const imageUrl = image ? normalizeUrl(image, BASE) : null;
  const labels = resolveStageLabels({ title, subtitle, hint: body, confidence: 0.85 });

  const events: CanonicalScrapedEvent[] = [];
  for (const m of description.matchAll(DATE_TIME_RE)) {
    const date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (date < today) continue;
    const time = nullIfMidnight(`${m[4].padStart(2, "0")}:${m[5]}`);
    const endTime = m[6] ? nullIfMidnight(`${m[6].padStart(2, "0")}:${m[7]}`) : null;
    events.push({
      source_event_id: `${slug}|${date}|${time ?? ""}`,
      title,
      subtitle,
      description: body,
      date,
      time,
      end_time: endTime,
      detail_url: detailUrl,
      ticket_url: detailUrl,
      image_url: imageUrl,
      price_min: priceEur,
      price_max: priceEur,
      venue_room: venueRoom,
      labels,
    });
  }
  return events;
}

function matchOg(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]*\\bcontent="([^"]+)"`, "i");
  const m = html.match(re);
  return m ? m[1] : null;
}

/**
 * og:description starts with "Termine\n\n<dates>\n\nEintritt …\n<title>\n<body>".
 * Take the substring AFTER the date block so productions without Eintritt
 * still get their body text.
 */
function parseDescription(raw: string): string | null {
  let body = raw;
  const dates = [...raw.matchAll(/\d{1,2}\.\d{1,2}\.\d{4}[\s\S]{0,30}?Uhr/g)];
  if (dates.length) {
    const last = dates[dates.length - 1];
    body = raw.slice(last.index + last[0].length);
  }
  body = body.replace(/^[\s ]*Eintritt[^.\n]*\.?[\s ]*/i, "");
  body = body.replace(/^[\s ]*Anmeldung[^.\n]*\.?[\s ]*/i, "");
  body = stripHtml(body).trim();
  if (!body) return null;
  return body.length > 800 ? `${body.slice(0, 800).trimEnd()}…` : body;
}

function parseSubtitle(description: string, title: string): string | null {
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
  if (/Naxoshalle/i.test(html)) return "Naxoshalle";
  return null;
}

function parsePrice(description: string): number | null {
  const m = description.match(PRICE_RE);
  if (!m) return null;
  const num = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}
