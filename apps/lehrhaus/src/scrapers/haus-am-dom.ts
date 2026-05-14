import { detectTalkLanguage } from "@museumsufer/core/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { ScrapedEvent } from "../types";
import { talkCategory } from "./shared";

const BASE = "https://hausamdom-frankfurt.de";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

/**
 * Haus am Dom uses TYPO3+Solr. The listing at /programm paginates 6 events
 * at a time via tx_solr[page]=N. Each card has a data-document-url pointing
 * to the detail page. We fetch the detail page to read site-assigned categories
 * (news-categories-item-link) and filter out non-talk types (Film, Konzert,
 * Ausstellung, Exkursion, Workshop).
 */

// Listing page that fetches all future events, starting from today
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

const EXCLUDE_CATEGORIES = new Set([
  "film",
  "konzert",
  "ausstellung",
  "exkursion",
  "ausflug",
  "workshop",
  "theater",
  "performance",
  "führung",
  "fuehrung",
]);

export async function scrapeHausAmDom(): Promise<ScrapedEvent[]> {
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
  return results.filter((e): e is ScrapedEvent => e !== null);
}

async function fetchDetail(url: string, date: string): Promise<ScrapedEvent | null> {
  try {
    const html = await fetchHtml(url);
    return parseDetail(html, date, url);
  } catch {
    return null;
  }
}

function parseDetail(html: string, date: string, detailUrl: string): ScrapedEvent | null {
  const categories = [...html.matchAll(CATEGORY_RE)].map((m) => m[1].toLowerCase());
  if (categories.some((c) => EXCLUDE_CATEGORIES.has(c))) return null;

  const title = stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").trim();
  if (!title) return null;

  const timeMatch = html.match(TIME_RE);
  const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

  const descMatch = html.match(
    /<div[^>]*class="[^"]*(?:abstract|description|lead|teaser)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );
  const description = descMatch ? stripHtml(descMatch[1]).trim().slice(0, 600) || null : null;

  const ticketHref = html.match(/href="([^"]*(?:ticket|anmeld|register|eventbrite|reservix)[^"]*)"/i)?.[1] ?? null;

  return {
    title,
    date,
    time,
    description,
    detail_url: detailUrl,
    ticket_url: ticketHref,
    category: talkCategory(title, description),
    language: detectTalkLanguage(title, description),
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`haus-am-dom fetch failed: ${res.status} ${url}`);
  return res.text();
}
