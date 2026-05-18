import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://hafen2.net";
const LISTING_URL = `${BASE}/1-0-Programm.html`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const EVENT_RE =
  /<div class="date[^"]*"[^>]*>\s*<div class="left">([A-Z]{2})<\/div>\s*<div class="right">(\d+)<\/div>\s*<\/div>\s*<div class="head[^"]*"[^>]*>\s*([\s\S]*?)<\/div>\s*<\/div>\s*<div class="body[^"]*"[^>]*>([\s\S]*?)<p class="location">\s*(\d{1,2})\.(\d{1,2})\.?,?\s*(\d{1,2}):(\d{2})\s*Uhr([^<]*)<\/p>([\s\S]*?)(?:<div class="hr">|<\/div>\s*<\/div>\s*<\/div>)/g;

const TICKET_RE = /<a[^>]+href="([^"]+)"[^>]*class="ticket"/;

/**
 * Hafen 2 in Offenbach — Programmkultur venue mixing indie concerts, film
 * series, and art events. The site is a legacy custom CMS (wemove); each
 * event renders as a date+head+body block with a "DD.MM., HH:MM Uhr" line
 * in the body. We emit one event per block, classifying by the "Konzert:"
 * / "Film:" / "Kino:" prefix in the head.
 */
export async function scrapeHafen2(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(LISTING_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`hafen 2 fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(EVENT_RE)) {
    const [, , dayNum, headHtml, , dd, mm, hh, mi, priceTail, tail] = m;

    const head = stripHtml(headHtml).replace(/\s+/g, " ").trim();
    if (!head) continue;
    const category = head.split(":")[0].trim();
    const title = head.includes(":") ? head.slice(head.indexOf(":") + 1).trim() : head;
    if (!title) continue;

    const date = `${inferYear(parseInt(mm, 10), today)}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    if (date < today) continue;
    const time = `${hh.padStart(2, "0")}:${mi}`;

    const price = priceTail.replace(/^,\s*/, "").trim() || null;
    const ticketMatch = (tail.match(TICKET_RE) ?? [])[1] ?? null;

    const labels: ScrapedLabel[] = labelsForCategory(category, title);
    const sourceId = `${dd}${mm}-${hh}${mi}-${title.slice(0, 30)}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    events.push({
      source_event_id: sourceId,
      title,
      subtitle: price,
      raw_category: category || null,
      date,
      time,
      detail_url: ticketMatch ?? LISTING_URL,
      ticket_url: ticketMatch,
      labels,
    });
    void dayNum;
  }

  return { source_slug: "hafen-2-offenbach", display_name: "Hafen 2 Offenbach", events };
}

function inferYear(month: number, today: string): number {
  const currentYear = parseInt(today.slice(0, 4), 10);
  const currentMonth = parseInt(today.slice(5, 7), 10);
  return month < currentMonth ? currentYear + 1 : currentYear;
}

function labelsForCategory(category: string, title: string): ScrapedLabel[] {
  const haystack = `${category.toLowerCase()} ${title.toLowerCase()}`;
  if (/film|kino|omu|ov\b/.test(haystack)) {
    return [{ label: "film:cinema", confidence: 0.85, classifier: "keyword:event" }];
  }
  if (haystack.startsWith("konzert")) {
    return [{ label: "music:experimental", confidence: 0.75, classifier: "keyword:event" }];
  }
  return [{ label: "event:venue", confidence: 0.5, classifier: "scraper-hardcoded" }];
}
