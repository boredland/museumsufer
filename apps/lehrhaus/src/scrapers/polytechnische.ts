import { classifyEvent, detectTalkLanguage } from "@museumsufer/core/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { ScrapedEvent } from "../types";
import { talkCategory } from "./shared";

const BASE = "https://polytechnische.de";
const LISTING_URL = `${BASE}/veranstaltungen`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

/** Event slugs follow the pattern /veranstaltungen/saison-YYYY-YYYY/DD-MM-rest */
const EVENT_LINK_RE = /href="(\/veranstaltungen\/saison-(\d{4})-(\d{4})\/(\d{2})-(\d{2})-[^"]+)"/g;

export async function scrapePolytechnische(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml(LISTING_URL);
  const links = extractEventLinks(html);
  const today = todayIso();

  const futures = links.filter((l) => l.date >= today);
  const results = await Promise.all(futures.map(({ href, date }) => fetchDetail(href, date)));
  return results.filter((e): e is ScrapedEvent => e !== null);
}

interface EventLink {
  href: string;
  date: string;
}

function extractEventLinks(html: string): EventLink[] {
  const seen = new Set<string>();
  const links: EventLink[] = [];

  for (const m of html.matchAll(EVENT_LINK_RE)) {
    const href = m[1];
    if (seen.has(href)) continue;
    seen.add(href);

    const yearA = parseInt(m[2], 10);
    const yearB = parseInt(m[3], 10);
    const day = m[4];
    const month = m[5];
    // Months 1-8 fall in the second calendar year of the season; 9-12 in the first.
    const year = parseInt(month, 10) >= 9 ? yearA : yearB;
    const date = `${year}-${month}-${day}`;
    links.push({ href, date });
  }

  return links;
}

async function fetchDetail(href: string, date: string): Promise<ScrapedEvent | null> {
  try {
    const html = await fetchHtml(`${BASE}${href}`);
    return parseDetail(html, date, `${BASE}${href}`);
  } catch {
    return null;
  }
}

function parseDetail(html: string, date: string, detailUrl: string): ScrapedEvent | null {
  const title = stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").trim();
  if (!title) return null;

  const category = classifyEvent(title);
  if (category !== "Vortrag") return null;

  const timeRaw = html.match(/(\d{1,2}):(\d{2})\s*Uhr/)?.[0] ?? null;
  const time = timeRaw
    ? timeRaw
        .replace(/\s*Uhr/, "")
        .replace(/(\d):/, "0$1:")
        .padStart(5, "0")
    : null;

  const descMatch = html.match(
    /<div[^>]*class="[^"]*(?:description|content|text|topic|thema)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );
  const description = descMatch ? stripHtml(descMatch[1]).trim().slice(0, 600) || null : null;

  const ticketHref = html.match(/href="([^"]*(?:ticket|anmeld|register|eventbrite|reservix)[^"]*)"/i)?.[1] ?? null;

  return {
    title,
    date,
    time: normalizeTime(time),
    description,
    detail_url: detailUrl,
    ticket_url: ticketHref,
    category: talkCategory(title, description),
    language: detectTalkLanguage(title, description),
  };
}

function normalizeTime(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`polytechnische fetch failed: ${res.status} ${url}`);
  return res.text();
}
