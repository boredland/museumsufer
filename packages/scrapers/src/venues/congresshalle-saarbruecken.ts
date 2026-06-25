import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Congress Centrum Saar — Congresshalle + Saarlandhalle Saarbrücken.
 * WordPress site at ccsaar.de with an /events/ listing page.
 */
const BASE = "https://www.ccsaar.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeCongresshalleSaarbruecken(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(`${BASE}/events/`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`ccsaar fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Each event card: date line, title anchor with href, optional category
  const cardRe = /<h2[^>]*>\s*<a[^>]*href="([^"]*\/events\/[^"]*)"[^>]*>([^<]+)<\/a>\s*<\/h2>/gi;
  // Date pattern: "28. - 29. Jun 2026" or "13. Jul 2026" or "07. – 08. Nov 2026"
  const dateRe = /(\d{1,2})\.\s*(?:[-–]\s*\d{1,2}\.\s*)?(?:(Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\w*)\s+(\d{4})/gi;

  const monthMap: Record<string, string> = {
    Jan: "01", Feb: "02", Mär: "03", Apr: "04", Mai: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Okt: "10", Nov: "11", Dez: "12",
  };

  // Extract event blocks — each event section starts with a date, then title
  const blocks = html.split(/(?=<div[^>]*class="[^"]*event-card)/i);
  for (const block of blocks) {
    const titleMatch = cardRe.exec(block);
    if (!titleMatch) { cardRe.lastIndex = 0; continue; }
    cardRe.lastIndex = 0;

    const href = titleMatch[1];
    const title = stripHtml(titleMatch[2]).trim();
    if (!title) continue;

    const dm = dateRe.exec(block);
    dateRe.lastIndex = 0;
    if (!dm) continue;

    const day = dm[1].padStart(2, "0");
    const month = monthMap[dm[2]] ?? "01";
    const year = dm[3];
    const date = `${year}-${month}-${day}`;

    if (date < today) continue;

    const dedupKey = `${title}|${date}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const detailUrl = href.startsWith("http") ? href : `${BASE}${href}`;

    events.push({
      source_event_id: dedupKey,
      title,
      description: null,
      date,
      time: null,
      detail_url: detailUrl,
      labels: [{ label: "music:classical", confidence: 0.7, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "congresshalle-saarbruecken", display_name: "Congresshalle Saarbrücken", events };
}
