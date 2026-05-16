import { classifyMusic, classifyTalk, detectTalkLanguage, looksLikeMusic } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import { type ProxyConfig, proxyFetch } from "../proxy";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const STADTBUECHEREI_HOME = "https://www.stadtbuecherei.frankfurt.de";
const VERANSTALTUNGEN_URL =
  "https://frankfurt.de/service-und-rathaus/verwaltung/aemter-und-institutionen/stadtbuecherei/veranstaltungen";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

/**
 * Stadtbücherei Frankfurt — Lesungen, Vorträge, Buchpräsentationen at the
 * Zentralbibliothek and Stadtteilbibliotheken. Event details live on
 * frankfurt.de, which Cloudflare gates with a "Just a moment…" JS challenge
 * for non-residential IPs; the hub routes through FETCH_PROXY when set.
 *
 * The CMS files everything under `/lesung/`, `/vortrag/`, `/diskussion/`,
 * or `/buchpraesentation/` URL slugs. That slug is the strongest available
 * signal, but it lies sometimes (Swing Belleville: a jazz concert filed
 * under `/lesung/`). So the hub emits both labels — the URL-slug-derived
 * one AND a music label when title/description suggests music. The lehrhaus
 * app's Phase-2 filter drops events carrying any `music:*` label.
 */

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

export async function scrapeStadtbuechereiFrankfurt(proxy: ProxyConfig | null): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  const detailUrls = new Set<string>();

  const addHrefsFrom = (html: string): void => {
    for (const m of html.matchAll(DETAIL_HREF_RE)) {
      const href = m[0].startsWith("http") ? m[0] : `${FRANKFURT_DE_BASE}${m[0]}`;
      detailUrls.add(href);
    }
  };

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

  try {
    const subdomainHtml = await fetchHtml(STADTBUECHEREI_HOME, null);
    addHrefsFrom(subdomainHtml);
  } catch {
    // Non-fatal — subdomain landing is a secondary discovery channel.
  }

  if (detailUrls.size === 0) return { source_slug: "stadtbuecherei-frankfurt", events };

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

  return { source_slug: "stadtbuecherei-frankfurt", events };
}

function isCloudflareChallenge(html: string): boolean {
  return html.length < 12_000 && /Just a moment\.\.\.|cf-challenge|cf_chl_/.test(html);
}

function parseDetail(html: string, detailUrl: string): CanonicalScrapedEvent | null {
  const titleTag = html.match(/<title[^>]*>([\s\S]+?)<\/title>/i)?.[1];
  const titleFromTag = titleTag ? cleanText(titleTag).replace(/\s*\|\s*Stadt Frankfurt am Main\s*$/i, "") : "";
  const titleFromH1 = cleanText(html.match(/<h1[^>]*>([\s\S]+?)<\/h1>/i)?.[1] ?? "");
  const title = titleFromTag || titleFromH1;
  if (!title) return null;

  const dateTime = extractDateTime(html);
  if (!dateTime) return null;

  const description = pickDescription(html);
  const labels: ScrapedLabel[] = [];

  const slugCategory = inferSlugCategory(detailUrl);
  if (slugCategory) {
    labels.push({ label: `talk:${slugCategory}`, confidence: 1.0, classifier: "url-slug" });
  } else {
    labels.push({
      label: `talk:${classifyTalk(title, description).toLowerCase()}`,
      confidence: 0.7,
      classifier: "keyword:talk",
    });
  }

  if (looksLikeMusic(title, description)) {
    labels.push({
      label: `music:${classifyMusic(title, null, description, "jazz")}`,
      confidence: 0.85,
      classifier: "keyword:music",
    });
  }

  const sourceEventId = detailUrl.replace(/\/+$/, "").split("/").pop() ?? detailUrl;

  return {
    source_event_id: sourceEventId,
    title,
    description,
    date: dateTime.date,
    time: dateTime.time,
    detail_url: detailUrl,
    language: detectTalkLanguage(title, description),
    labels,
  };
}

function inferSlugCategory(detailUrl: string): "lesung" | "vortrag" | "diskussion" | null {
  if (/\/lesung\//.test(detailUrl)) return "lesung";
  if (/\/diskussion\//.test(detailUrl)) return "diskussion";
  if (/\/vortrag\//.test(detailUrl)) return "vortrag";
  if (/\/buchpraesentation\//.test(detailUrl)) return "lesung";
  return null;
}

function pickDescription(html: string): string | null {
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

function extractDateTime(html: string): { date: string; time: string | null } | null {
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
