import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { Category, ScrapedEvent } from "../types";
import { type ProxyConfig, proxyFetch } from "./_proxy";

/**
 * Stadtbücherei Frankfurt — Lesungen, Vorträge, Buchpräsentationen at the
 * Zentralbibliothek and Stadtteilbibliotheken. Event details live on
 * frankfurt.de, which Cloudflare gates with a "Just a moment…" JS challenge
 * for non-residential IPs.
 *
 * We route through the optional FETCH_PROXY (apps/fetch-proxy) when
 * configured — same pattern used by frankfurt-museums for Bibelhaus etc.
 * If the proxy can't bypass the CF challenge either, the listing page
 * returns the challenge HTML and we get 0 events (logged as a warning).
 *
 * The two candidate listing URLs:
 *   - https://stadtbuecherei.frankfurt.de/  → curated landing (200 OK direct,
 *     but freeform card layout; no structured event listing)
 *   - https://frankfurt.de/.../stadtbuecherei/veranstaltungen → structured
 *     listing under the CF challenge
 *
 * We prefer the frankfurt.de listing via proxy; fall back to extracting any
 * event-detail URLs from the subdomain landing as a last resort.
 */

const STADTBUECHEREI_HOME = "https://www.stadtbuecherei.frankfurt.de";
const VERANSTALTUNGEN_URL =
  "https://frankfurt.de/service-und-rathaus/verwaltung/aemter-und-institutionen/stadtbuecherei/veranstaltungen";
const UA = "lehrhaus crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

const DETAIL_HREF_RE =
  /https:\/\/frankfurt\.de\/service-und-rathaus\/verwaltung\/aemter-und-institutionen\/stadtbuecherei\/veranstaltungen\/(?:lesung|kategorie-level-4-seite|vortrag|diskussion|buchpraesentation)\/[a-z0-9-]+/g;

const MONTHS_DE: Record<string, number> = {
  jan: 1,
  januar: 1,
  feb: 2,
  februar: 2,
  mar: 3,
  märz: 3,
  apr: 4,
  april: 4,
  mai: 5,
  jun: 6,
  juni: 6,
  jul: 7,
  juli: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dez: 12,
  dezember: 12,
};

export async function scrapeStadtbuechereiFrankfurt(proxy: ProxyConfig | null): Promise<ScrapedEvent[]> {
  const today = todayIso();
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();
  const detailUrls = new Set<string>();

  // Source 1: structured frankfurt.de listing (CF-challenged — needs proxy).
  // Tolerated to fail: we'll still try the subdomain fallback below.
  try {
    const listingHtml = await fetchHtml(VERANSTALTUNGEN_URL, proxy);
    if (isCloudflareChallenge(listingHtml)) {
      console.warn("[stadtbuecherei] frankfurt.de listing is Cloudflare-challenged even via proxy");
    } else {
      for (const m of listingHtml.matchAll(DETAIL_HREF_RE)) detailUrls.add(m[0]);
    }
  } catch (err) {
    console.warn(`[stadtbuecherei] listing fetch failed: ${err instanceof Error ? err.message : err}`);
  }

  // Source 2: stadtbuecherei.frankfurt.de subdomain landing — promotional
  // overview that surfaces a handful of upcoming-event detail links. Always
  // returns 200 OK; doesn't need the proxy.
  try {
    const subdomainHtml = await fetchHtml(STADTBUECHEREI_HOME, null);
    for (const m of subdomainHtml.matchAll(DETAIL_HREF_RE)) detailUrls.add(m[0]);
  } catch {
    // Non-fatal.
  }

  if (detailUrls.size === 0) return [];

  for (const detailUrl of detailUrls) {
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    let detailHtml: string;
    try {
      detailHtml = await fetchHtml(detailUrl, proxy);
    } catch (err) {
      console.warn(`[stadtbuecherei] detail fetch failed: ${detailUrl}`, err);
      continue;
    }
    if (isCloudflareChallenge(detailHtml)) continue;

    const parsed = parseDetail(detailHtml, detailUrl);
    if (!parsed) continue;
    if (parsed.date < today) continue;
    events.push(parsed);
  }

  return events;
}

function isCloudflareChallenge(html: string): boolean {
  return html.length < 12_000 && /Just a moment\.\.\.|cf-challenge|cf_chl_/.test(html);
}

interface ParsedDetail {
  title: string;
  date: string;
  time: string | null;
  detail_url: string;
  description: string | null;
  category: Category;
  language: string | null;
}

function parseDetail(html: string, detailUrl: string): ParsedDetail | null {
  // frankfurt.de detail pages use Sitecore — title in <h1>, date+time in a
  // metadata block, description in the first prominent <p>. We extract
  // defensively because the markup may not match the official styleguide.
  const titleRaw = html.match(/<h1[^>]*>([\s\S]+?)<\/h1>/i)?.[1];
  const title = titleRaw ? cleanText(titleRaw) : null;
  if (!title) return null;

  const dateTime = extractDateTime(html);
  if (!dateTime) return null;

  // First non-empty <p> in main content as the description.
  const descMatch = html.match(/<p[^>]*>([\s\S]{40,800}?)<\/p>/i);
  const description = descMatch ? cleanText(descMatch[1]).slice(0, 500) || null : null;

  // URL slug carries the format ("/lesung/" / "/vortrag/" / "/diskussion/").
  const category: Category = /\/lesung\//.test(detailUrl)
    ? "Lesung"
    : /\/diskussion\//.test(detailUrl)
      ? "Diskussion"
      : /\/vortrag\//.test(detailUrl)
        ? "Vortrag"
        : classifyHaystack(`${title} ${description ?? ""}`);

  return {
    title,
    date: dateTime.date,
    time: dateTime.time,
    detail_url: detailUrl,
    description,
    category,
    language: null,
  };
}

function classifyHaystack(s: string): Category {
  const h = s.toLowerCase();
  if (/lesung|buchpräsentation|buchvorstellung/.test(h)) return "Lesung";
  if (/diskussion|podium|debatte|gespräch/.test(h)) return "Diskussion";
  return "Vortrag";
}

function extractDateTime(html: string): { date: string; time: string | null } | null {
  // Patterns we accept (in priority order):
  //   "Donnerstag, 20.05.2026, 19:30 Uhr"
  //   "20. Mai 2026, 19:30 Uhr"
  //   "20.05.2026"  (no time)
  const numeric = html.match(/(\d{2})\.(\d{2})\.(20\d{2})(?:[\s,]+\s*(\d{1,2})[:.](\d{2}))?/);
  if (numeric) {
    const [, dd, mm, yyyy, hh, mi] = numeric;
    const time = hh && mi ? `${hh.padStart(2, "0")}:${mi}` : null;
    return { date: `${yyyy}-${mm}-${dd}`, time };
  }
  const written = html.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(20\d{2})(?:[\s,]+\s*(\d{1,2})[:.](\d{2}))?/);
  if (written) {
    const day = parseInt(written[1], 10);
    const month = MONTHS_DE[written[2].toLowerCase().replace(/[^a-zäöü]/g, "")];
    if (!month) return null;
    const year = parseInt(written[3], 10);
    const time = written[4] && written[5] ? `${written[4].padStart(2, "0")}:${written[5]}` : null;
    return {
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      time,
    };
  }
  return null;
}

async function fetchHtml(url: string, proxy: ProxyConfig | null): Promise<string> {
  const res = await proxyFetch(url, proxy, { headers: HEADERS });
  if (!res.ok) throw new Error(`stadtbuecherei fetch failed: ${res.status} ${url}`);
  return res.text();
}

function cleanText(s: string): string {
  return stripHtml(s).replace(/\s+/g, " ").trim();
}
