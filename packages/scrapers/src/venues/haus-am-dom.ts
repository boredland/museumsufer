import { classifyMusic, classifyTalk, detectTalkLanguage } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://hausamdom-frankfurt.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

/**
 * Haus am Dom — TYPO3+Solr. The listing paginates via `tx_solr[page]`.
 * Each event detail page tags itself with one or more
 * `news-categories-item-link` titles (Konzert/Film/Theater/Vortrag/…) —
 * we keep all events and emit appropriate labels per category.
 */

function listingUrl(page: number, today: string): string {
  const dateFilter = `date%3A${today.replace(/-/g, "")}-202709000000`;
  return `${BASE}/programm?tx_solr%5Bfilter%5D%5B1%5D=%28pid%3A6645+OR+pid%3A6647+OR+pid%3A6646%29&tx_solr%5Bfilter%5D%5B2%5D=${dateFilter}&tx_solr%5Bpage%5D=${page}&content=11235`;
}

const CARD_RE =
  /<div[^>]*class="[^"]*event-list[^"]*"[^>]*data-document-url="(https:\/\/hausamdom-frankfurt\.de\/programm\/[^"]+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*event-list[^"]*"|$)/g;
const DATE_RE = /<time\s+datetime="(\d{4}-\d{2}-\d{2})"/;
const TITLE_RE = /<h3\s+class="event-title">([\s\S]*?)<\/h3>/i;
const TIME_RE = /(\d{1,2}):(\d{2})\s*Uhr/;
const CATEGORY_RE = /<a[^>]*class="news-categories-item-link"[^>]*title="([^"]+)"/g;
const LOAD_MORE_RE = /class="[^"]*loadMoreResults[^"]*"/;

export async function scrapeHausAmDom(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const cards: Array<{ url: string; date: string }> = [];
  const seenUrls = new Set<string>();

  for (let page = 1; page <= 20; page++) {
    const html = await fetchHtml(listingUrl(page, today));
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

  const results = await Promise.all(cards.map(({ url, date }) => fetchDetail(url, date)));
  const events = results.filter((e): e is CanonicalScrapedEvent => e !== null);
  return { source_slug: "haus-am-dom", display_name: "Haus am Dom – Kath. Akademie Rabanus Maurus", events };
}

async function fetchDetail(url: string, date: string): Promise<CanonicalScrapedEvent | null> {
  try {
    const html = await fetchHtml(url);
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
  if (set.has("performance")) labels.push({ label: "stage:dance", confidence: 0.85, classifier: "upstream-category" });
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

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`haus-am-dom fetch failed: ${res.status} ${url}`);
  return res.text();
}
