import { classifyEvent, classifyTalk, detectTalkLanguage, looksLikeMusic } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://polytechnische.de";
const LISTING_URL = `${BASE}/veranstaltungen`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

const EVENT_LINK_RE = /href="(\/veranstaltungen\/saison-(\d{4})-(\d{4})\/(\d{2})-(\d{2})-[^"]+)"/g;
// Polytechnische updates the visible date on rescheduled events by renaming
// the teaser image to `<slug>_verschoben_DD.MM.YYYY.<ext>` — the URL stays
// frozen at the original DD-MM. The /veranstaltungen list keeps the old
// image; the homepage's upcoming carousel has the postponed version.
const POSTPONED_IMG_RE = /verschoben_(\d{1,2})\.(\d{1,2})\.(\d{4})/gi;
const POSTPONED_DETAIL_RE =
  /VERSCHOBEN\s+auf\s+den\s+(\d{1,2})\.\s+(Januar|Februar|M[aä]rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/i;

const MONTHS_DE: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

export async function scrapePolytechnische(): Promise<VenueScrapeResult> {
  const [listingHtml, homepageHtml] = await Promise.all([fetchHtml(LISTING_URL), fetchHtml(BASE)]);
  const links = extractEventLinks(listingHtml);
  const homepagePostponements = extractPostponementsFromHomepage(homepageHtml);
  for (const link of links) {
    const override = homepagePostponements.get(link.href);
    if (override && override > link.date) link.date = override;
  }

  const today = todayIso();
  const futures = links.filter((l) => l.date >= today);
  const results = await Promise.all(futures.map(({ href, date }) => fetchDetail(href, date)));
  const events = results.filter((e): e is CanonicalScrapedEvent => e !== null);
  return { source_slug: "polytechnische-gesellschaft", display_name: "Polytechnische Gesellschaft Frankfurt", events };
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
    links.push({ href, date: `${year}-${month}-${day}` });
  }

  return links;
}

/** Walk the homepage by event-link offsets; for each link, scan the
 *  segment up to the next link for a `verschoben_DD.MM.YYYY` image marker. */
function extractPostponementsFromHomepage(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const matches = [...html.matchAll(EVENT_LINK_RE)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index! + m[0].length;
    const end = matches[i + 1]?.index ?? Math.min(start + 4000, html.length);
    const segment = html.slice(start, end);
    const post = segment.match(POSTPONED_IMG_RE);
    if (!post) continue;
    const parts = post[0].match(/verschoben_(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
    if (!parts) continue;
    out.set(m[1], `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`);
  }
  return out;
}

async function fetchDetail(href: string, date: string): Promise<CanonicalScrapedEvent | null> {
  try {
    const html = await fetchHtml(`${BASE}${href}`);
    return parseDetail(html, date, href, `${BASE}${href}`);
  } catch {
    return null;
  }
}

function parseDetail(html: string, listingDate: string, href: string, detailUrl: string): CanonicalScrapedEvent | null {
  const title = stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").trim();
  if (!title) return null;

  // The detail page carries the authoritative VERSCHOBEN notice when an
  // event has been rescheduled. Override the listing-derived date.
  const postponed = html.match(POSTPONED_DETAIL_RE);
  let date = listingDate;
  if (postponed) {
    const month = MONTHS_DE[postponed[2].toLowerCase()];
    if (month) {
      const override = `${postponed[3]}-${String(month).padStart(2, "0")}-${postponed[1].padStart(2, "0")}`;
      if (override > date) date = override;
    }
  }

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

  const labels: ScrapedLabel[] = [];
  const type = classifyEvent(title, description);
  if (type === "Vortrag" || type == null) {
    labels.push({
      label: `talk:${classifyTalk(title, description).toLowerCase()}`,
      confidence: 0.85,
      classifier: "keyword:talk",
    });
  } else if (type === "Konzert" || looksLikeMusic(title, description)) {
    labels.push({ label: "music:classical", confidence: 0.75, classifier: "keyword:music" });
  }
  if (labels.length === 0) {
    labels.push({
      label: `talk:${classifyTalk(title, description).toLowerCase()}`,
      confidence: 0.6,
      classifier: "keyword:talk",
    });
  }

  return {
    source_event_id: href.split("/").filter(Boolean).pop() ?? href,
    title,
    date,
    time: normalizeTime(time),
    description,
    detail_url: detailUrl,
    ticket_url: ticketHref,
    language: detectTalkLanguage(title, description),
    labels,
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
