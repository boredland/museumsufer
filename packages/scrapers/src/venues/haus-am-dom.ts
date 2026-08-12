import { classifyDance, classifyMusic, classifyTalk, detectTalkLanguage } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import { type ProxyConfig, proxyFetch } from "../proxy";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://hausamdom-frankfurt.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

/**
 * Haus am Dom — TYPO3+Solr. Each event detail page tags itself with one or
 * more `news-categories-item-link` titles (Konzert/Film/Theater/Vortrag/…) —
 * we keep all events and emit appropriate labels per category.
 *
 * The site no longer answers `tx_solr[…]` in the query string: any request
 * carrying one is torn down mid-response (HTTP/2 PROTOCOL_ERROR, surfacing as
 * a 502 through the proxy). Pagination is the "Mehr Veranstaltungen laden"
 * form instead — a POST to /programm with the page number and the date/pid
 * filters as hidden fields. Page 1 is the plain GET.
 */
const LISTING_URL = `${BASE}/programm`;

function listingBody(page: number, today: string): URLSearchParams {
  const body = new URLSearchParams({ "tx_solr[page]": String(page) });
  body.append("tx_solr[filter][]", `date:${today.replace(/-/g, "")}-202709000000`);
  body.append("tx_solr[filter][]", "(pid:6645 OR pid:6647 OR pid:6646)");
  return body;
}

const CARD_RE =
  /<div[^>]*class="[^"]*event-list[^"]*"[^>]*data-document-url="(https:\/\/hausamdom-frankfurt\.de\/programm\/[^"]+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*event-list[^"]*"|$)/g;
const DATE_RE = /<time\s+datetime="(\d{4}-\d{2}-\d{2})"/;
const TITLE_RE = /<h3\s+class="event-title">([\s\S]*?)<\/h3>/i;
// Haus am Dom prints times in both "19:30 Uhr" and German "19.30 Uhr" form.
const TIME_RE = /(\d{1,2})[:.](\d{2})\s*Uhr/;
const CATEGORY_RE = /<a[^>]*class="news-categories-item-link"[^>]*title="([^"]+)"/g;
const LOAD_MORE_RE = /class="[^"]*loadMoreResults[^"]*"/;

export async function scrapeHausAmDom(proxy: ProxyConfig | null = null): Promise<VenueScrapeResult> {
  const today = todayIso();
  const cards: Array<{ url: string; date: string }> = [];
  const seenUrls = new Set<string>();

  // ~26 pages of 6 cards cover the published season; the load-more check ends
  // the walk earlier in quieter months.
  for (let page = 1; page <= 40; page++) {
    const html = await fetchHtml(LISTING_URL, proxy, page === 1 ? null : listingBody(page, today));
    let foundNew = false;

    for (const m of html.matchAll(CARD_RE)) {
      const url = m[1];
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const inner = m[2];
      const title = stripHtml(inner.match(TITLE_RE)?.[1] ?? "").trim();
      if (!title || title.startsWith("ENTFÄLLT")) continue;

      const date = inner.match(DATE_RE)?.[1];
      if (!date || date < today) continue;

      cards.push({ url, date });
      foundNew = true;
    }

    if (!LOAD_MORE_RE.test(html)) break;
    if (!foundNew) break;
  }

  const results = await Promise.all(cards.map(({ url, date }) => fetchDetail(url, date, proxy)));
  const events = results.filter((e): e is CanonicalScrapedEvent => e !== null);
  return { source_slug: "haus-am-dom", display_name: "Haus am Dom – Kath. Akademie Rabanus Maurus", events };
}

async function fetchDetail(
  url: string,
  date: string,
  proxy: ProxyConfig | null,
): Promise<CanonicalScrapedEvent | null> {
  try {
    const html = await fetchHtml(url, proxy);
    return parseDetail(html, date, url);
  } catch {
    return null;
  }
}

function parseDetail(html: string, date: string, detailUrl: string): CanonicalScrapedEvent | null {
  const categories = [...html.matchAll(CATEGORY_RE)].map((m) => m[1].toLowerCase());
  const title = stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").trim();
  if (!title) return null;

  const timeMatch = html.match(TIME_RE);
  const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

  const descMatch = html.match(
    /<div[^>]*class="[^"]*(?:abstract|description|lead|teaser)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );
  const description = descMatch ? stripHtml(descMatch[1]).trim().slice(0, 600) || null : null;

  const ticketHref = html.match(/href="([^"]*(?:ticket|anmeld|register|eventbrite|reservix)[^"]*)"/i)?.[1] ?? null;
  const labels = labelsFromCategories(categories, title, description);
  if (labels.length === 0) {
    labels.push({
      label: `talk:${classifyTalk(title, description).toLowerCase()}`,
      confidence: 0.6,
      classifier: "keyword:talk",
    });
  }

  const slug = detailUrl.replace(/\/+$/, "").split("/").pop() ?? detailUrl;

  return {
    source_event_id: slug,
    title,
    date,
    time,
    description,
    detail_url: detailUrl,
    ticket_url: ticketHref,
    language: detectTalkLanguage(title, description),
    raw_category: categories.join(","),
    labels,
  };
}

function labelsFromCategories(
  categories: readonly string[],
  title: string,
  description: string | null,
): ScrapedLabel[] {
  const labels: ScrapedLabel[] = [];
  const set = new Set(categories);
  if (set.has("konzert")) {
    labels.push({
      label: `music:${classifyMusic(title, null, description, "classical")}`,
      confidence: 1.0,
      classifier: "upstream-category",
    });
  }
  if (set.has("film")) labels.push({ label: "film:cinema", confidence: 1.0, classifier: "upstream-category" });
  if (set.has("ausstellung")) {
    labels.push({ label: "museum:vernissage", confidence: 0.9, classifier: "upstream-category" });
  }
  if (set.has("exkursion") || set.has("ausflug")) {
    labels.push({ label: "museum:fuehrung", confidence: 0.9, classifier: "upstream-category" });
  }
  if (set.has("workshop")) {
    labels.push({ label: "museum:workshop", confidence: 1.0, classifier: "upstream-category" });
  }
  if (set.has("theater")) labels.push({ label: "stage:theater", confidence: 1.0, classifier: "upstream-category" });
  if (set.has("performance")) {
    labels.push({
      label: `dance:${classifyDance(title, null, description, "contemporary")}`,
      confidence: 0.85,
      classifier: "upstream-category",
    });
  }
  if (set.has("führung") || set.has("fuehrung")) {
    labels.push({ label: "museum:fuehrung", confidence: 1.0, classifier: "upstream-category" });
  }
  if (set.has("vortrag") || set.has("diskussion") || set.has("lesung") || set.has("buchpräsentation")) {
    labels.push({
      label: `talk:${classifyTalk(title, description).toLowerCase()}`,
      confidence: 1.0,
      classifier: "upstream-category",
    });
  }
  return labels;
}

async function fetchHtml(url: string, proxy: ProxyConfig | null, body: URLSearchParams | null = null): Promise<string> {
  // The Solr-backed listing endpoint frequently throttles GH Actions IPs
  // with 503; routing through fetch-proxy (Cloudflare worker) gives us a
  // different egress IP. Retry once with backoff in case the proxy itself
  // returns a transient error.
  const init: RequestInit = body
    ? { method: "POST", headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" }, body }
    : { headers: HEADERS };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await proxyFetch(url, proxy, init);
    if (res.ok) return res.text();
    if (res.status >= 500 && res.status < 600 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    throw new Error(`haus-am-dom fetch failed: ${res.status} ${url}`);
  }
  throw new Error(`haus-am-dom fetch exhausted retries: ${url}`);
}
