import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Garage Saarbrücken — rock/metal/punk/indie club operated by Saarevent GmbH.
 * WordPress/WooCommerce site at saarevent.com (garage-sb.de redirects here).
 */
const BASE = "https://www.saarevent.com";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeGarageSaarbruecken(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(BASE, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`saarevent fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Event blocks: date + title + link in WooCommerce product listing
  // Pattern: DD.MM.YYYY followed by title in h2 with link to /event/...
  const blockRe = /(\d{2}\.\d{2}\.\d{4})\s*[\s\S]*?<h2[^>]*>\s*<a[^>]*href="([^"]*\/event\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(html)) !== null) {
    const dateStr = match[1]; // DD.MM.YYYY
    const href = match[2];
    const title = stripHtml(match[3]).trim();

    const [, dd, mm, yyyy] = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/) ?? [];
    if (!dd) continue;
    const date = `${yyyy}-${mm}-${dd}`;

    if (date < today) continue;

    // Skip "Ausverkauft" (sold out) prefix in dedup key but keep in title
    const cleanTitle = title.replace(/^Ausverkauft:\s*/i, "");
    const dedupKey = `${cleanTitle}|${date}`;
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
      labels: [{ label: "music:rock", confidence: 0.8, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "garage-saarbruecken", display_name: "Garage Saarbrücken", events };
}
