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

// Hrefs on frankfurt.de are sometimes absolute, sometimes relative. We
// match both and normalise to absolute downstream. Only buckets that
// represent actual lehr.salon-shaped events (Lesung / Vortrag /
// Diskussion / Buchpräsentation) — `/kategorie-level-4-seite/` is the
// site's catch-all bin and contains family-day festivals, STEM events,
// children's programming etc. which we don't want here.
const DETAIL_HREF_RE =
  /(?:https:\/\/frankfurt\.de)?\/service-und-rathaus\/verwaltung\/aemter-und-institutionen\/stadtbuecherei\/veranstaltungen\/(?:lesung|vortrag|diskussion|buchpraesentation)\/[a-z0-9-]+/g;
const FRANKFURT_DE_BASE = "https://frankfurt.de";

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

  const addHrefsFrom = (html: string): void => {
    for (const m of html.matchAll(DETAIL_HREF_RE)) {
      const href = m[0].startsWith("http") ? m[0] : `${FRANKFURT_DE_BASE}${m[0]}`;
      detailUrls.add(href);
    }
  };

  // Source 1: structured frankfurt.de listing (CF-challenged — needs proxy).
  // Tolerated to fail: we'll still try the subdomain fallback below.
  try {
    const listingHtml = await fetchHtml(VERANSTALTUNGEN_URL, proxy);
    if (isCloudflareChallenge(listingHtml)) {
      console.warn("[stadtbuecherei] frankfurt.de listing is Cloudflare-challenged even via proxy");
    } else {
      addHrefsFrom(listingHtml);
    }
  } catch (err) {
    console.warn(`[stadtbuecherei] listing fetch failed: ${err instanceof Error ? err.message : err}`);
  }

  // Source 2: stadtbuecherei.frankfurt.de subdomain landing — promotional
  // overview that surfaces a handful of upcoming-event detail links. Always
  // returns 200 OK; doesn't need the proxy.
  try {
    const subdomainHtml = await fetchHtml(STADTBUECHEREI_HOME, null);
    addHrefsFrom(subdomainHtml);
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
  // frankfurt.de detail pages use Sitecore. Title sources, in priority order:
  //   1) <title> minus the " | Stadt Frankfurt am Main" suffix (canonical,
  //      always includes the full talk title — e.g. "Author: Book (Verlag)")
  //   2) <h1> (often just the author name, missing the talk's actual title —
  //      use only as fallback)
  const titleTag = html.match(/<title[^>]*>([\s\S]+?)<\/title>/i)?.[1];
  const titleFromTag = titleTag ? cleanText(titleTag).replace(/\s*\|\s*Stadt Frankfurt am Main\s*$/i, "") : "";
  const titleFromH1 = cleanText(html.match(/<h1[^>]*>([\s\S]+?)<\/h1>/i)?.[1] ?? "");
  const title = titleFromTag || titleFromH1;
  if (!title) return null;

  const dateTime = extractDateTime(html);
  if (!dateTime) return null;

  // First substantive <p> as the description — skip the cookie banner that
  // frankfurt.de injects at the top of every Sitecore page.
  const description = pickDescription(html);

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

function pickDescription(html: string): string | null {
  // Walk paragraphs in order; skip cookie-banner / consent / boilerplate
  // text until we hit one that looks like real event copy. Cap at 500 chars.
  for (const m of html.matchAll(/<p[^>]*>([\s\S]{40,1500}?)<\/p>/gi)) {
    const text = cleanText(m[1]);
    if (!text) continue;
    if (
      /cookies?|datenschutzerklärung|google fonts|tracking|jetzt zustimmen|nur notwendige|alle akzeptieren|matomo|piwik/i.test(
        text,
      )
    )
      continue;
    return text.slice(0, 500);
  }
  return null;
}

function classifyHaystack(s: string): Category {
  const h = s.toLowerCase();
  if (/lesung|buchpräsentation|buchvorstellung/.test(h)) return "Lesung";
  if (/diskussion|podium|debatte|gespräch/.test(h)) return "Diskussion";
  return "Vortrag";
}

function extractDateTime(html: string): { date: string; time: string | null } | null {
  // Patterns we accept (in priority order):
  //   "Mittwoch, 20.5.2026, 19.30 Uhr"  ← frankfurt.de canonical form
  //   "Donnerstag, 20.05.2026, 19:30 Uhr"
  //   "20. Mai 2026, 19:30 Uhr"
  //   "20.05.2026" (no time)
  // Day and month may be single- or two-digit; time separator may be . or :.
  const numeric = html.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})(?:[\s,]+(\d{1,2})[:.](\d{2}))?/);
  if (numeric) {
    const [, dd, mm, yyyy, hh, mi] = numeric;
    const time = hh && mi ? `${hh.padStart(2, "0")}:${mi}` : null;
    return { date: `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`, time };
  }
  const written = html.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(20\d{2})(?:[\s,]+(\d{1,2})[:.](\d{2}))?/);
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
