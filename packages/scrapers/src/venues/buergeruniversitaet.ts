import { classifyTalk, detectTalkLanguage } from "@museumsufer/classify";
import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core/date";
import { decodeEntities, normalizeUrl, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.uni-frankfurt.de";
const LIST_URL = `${BASE}/de/events`;
/** The calendar paginates 15 events per page and wraps back to page 1 past the end,
 *  so a repeated first link is the stop signal; this cap only guards a runaway. */
const MAX_PAGES = 30;
/** The origin resets connections above ~3 parallel requests. */
const DETAIL_CONCURRENCY = 2;
const DETAIL_ATTEMPTS = 3;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

/** Site category shown on the detail page; only lectures belong in the talk apps.
 *  Concerts, tours and conferences have their own homes. */
const TALK_CATEGORY = "Vorträge";

const CARD_RE = /<article data-testid="EventTeaser"[\s\S]*?<\/article>/g;
const LD_RE = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
const CATEGORY_RE = /\\"eventCategory\\":\\"([^"\\]*)\\"/;

interface LdEvent {
  "@type"?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  location?: { name?: string } | null;
}

/**
 * Goethe-Universität Frankfurt — public lectures. The old WordPress calendar at
 * aktuelles.uni-frankfurt.de was retired (its REST route now serves a directory
 * index); the university's Magnolia calendar lists every public event with a
 * detail page that carries an Event JSON-LD block plus the site's own category.
 * The listing has no category, so each detail page is read and only "Vorträge"
 * are kept.
 */
export async function scrapeBuergeruniversitaet(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const links = await listEventLinks();
  if (links.length === 0) throw new Error("buergeruniversitaet: calendar lists no events (markup changed?)");

  const events: CanonicalScrapedEvent[] = [];
  let failed = 0;
  await mapLimit(links, DETAIL_CONCURRENCY, async (link) => {
    const detail = await fetchDetail(link);
    if (!detail) {
      failed++;
      return;
    }
    if (detail.category !== TALK_CATEGORY) return;

    const { ld } = detail;
    const title = decodeEntities(ld.name ?? "").trim();
    if (!title || !ld.startDate) return;
    const start = new Date(ld.startDate);
    const date = toBerlinDate(start);
    if (date < today) return;
    const end = ld.endDate ? new Date(ld.endDate) : null;
    const description = stripHtml(ld.description ?? "").slice(0, 600) || null;

    events.push({
      source_event_id: link,
      title,
      description,
      date,
      time: toBerlinTime(start),
      end_time: end && toBerlinDate(end) === date ? toBerlinTime(end) : null,
      detail_url: normalizeUrl(link, BASE),
      venue_room: ld.location?.name ? decodeEntities(ld.location.name) : null,
      language: detectTalkLanguage(title, description),
      labels: [
        {
          label: `talk:${classifyTalk(title, description).toLowerCase()}`,
          confidence: 0.9,
          classifier: "upstream-category",
        },
      ],
    });
  });

  // A few flaky detail fetches must not quietly thin the programme out.
  if (failed > Math.max(2, links.length * 0.1)) {
    throw new Error(`buergeruniversitaet: ${failed} of ${links.length} detail pages failed`);
  }

  events.sort((a, b) => a.source_event_id.localeCompare(b.source_event_id));
  return { source_slug: "buergeruniversitaet", display_name: "Goethe-Uni Bürgeruniversität", events };
}

async function listEventLinks(): Promise<string[]> {
  const links: string[] = [];
  const seen = new Set<string>();
  let firstOfFirstPage: string | null = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${LIST_URL}?page=${page}`, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`buergeruniversitaet listing failed: ${res.status} (page ${page})`);
    const html = (await res.text()).replace(/<svg[\s\S]*?<\/svg>/g, "");
    const pageLinks = [...html.matchAll(CARD_RE)]
      .map((m) => m[0].match(/href="(\/de\/home\/events\/[^"]+)"/)?.[1])
      .filter((l): l is string => !!l);
    if (pageLinks.length === 0) break;
    if (page === 1) firstOfFirstPage = pageLinks[0];
    else if (pageLinks[0] === firstOfFirstPage) break;
    for (const l of pageLinks) {
      if (seen.has(l)) continue;
      seen.add(l);
      links.push(l);
    }
  }
  return links;
}

async function fetchDetail(link: string): Promise<{ category: string | null; ld: LdEvent } | null> {
  for (let attempt = 1; attempt <= DETAIL_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${BASE}${link}`, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(String(res.status));
      const html = await res.text();
      let ld: LdEvent | null = null;
      for (const m of html.matchAll(LD_RE)) {
        const parsed = JSON.parse(m[1]) as LdEvent;
        if (parsed["@type"] === "Event") ld = parsed;
      }
      if (!ld) return null;
      return { category: html.match(CATEGORY_RE)?.[1] ?? null, ld };
    } catch {
      if (attempt === DETAIL_ATTEMPTS) return null;
      await new Promise<void>((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  return null;
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}
