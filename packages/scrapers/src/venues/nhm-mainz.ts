import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.mainz.de";
const RSS_URL = `${BASE}/microsite/naturhistorisches-museum/entdecken/eventkalender/030_eventkalender.php?sp:out=rss`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const ITEM_RE = /<item>([\s\S]*?)<\/item>/g;
const TITLE_RE = /<title>([^<]+)<\/title>/;
const LINK_RE = /<link>([^<]+)<\/link>/;
const DESC_RE = /<description>([\s\S]*?)<\/description>/;
const DATA_CONTENT_RE = /<meta name="application-name"[^>]+data-content="([^"]+)"/;

interface ContentData {
  id?: number;
  title?: string;
  date_from?: string;
  date_to?: string;
}

/**
 * Naturhistorisches Museum Mainz — Sitepark IES on mainz.de. The event
 * calendar exposes an RSS feed listing event instances; each item links
 * to a detail page whose `<meta name="application-name" data-content>`
 * carries the actual datetime as `date_from` / `date_to` (ISO 8601).
 * We fetch the RSS, then resolve each item's detail page for dates;
 * items whose detail page is unreachable or has no date are dropped.
 */
export async function scrapeNhmMainz(): Promise<VenueScrapeResult> {
  const today = todayIso();

  // 1. Fetch RSS feed
  const rssRes = await fetch(RSS_URL, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml" },
  });
  if (!rssRes.ok) throw new Error(`nhm-mainz rss fetch failed: ${rssRes.status}`);
  const rss = await rssRes.text();

  const items = Array.from(rss.matchAll(ITEM_RE), (m) => m[1]);
  if (items.length === 0) {
    return { source_slug: "nhm-mainz", display_name: "Naturhistorisches Museum Mainz", events: [] };
  }

  // 2. Resolve detail pages in parallel
  const enriched = await Promise.all(
    items.map(async (block) => {
      const link = block.match(LINK_RE)?.[1]?.trim();
      const title = block.match(TITLE_RE)?.[1]?.trim() ?? "";
      const description = block.match(DESC_RE)?.[1]?.trim() ?? "";
      if (!link || !title) return null;
      try {
        const detailRes = await fetch(link, { headers: { "User-Agent": UA } });
        if (!detailRes.ok) return null;
        const html = await detailRes.text();
        const content = extractContentData(html);
        if (!content?.date_from) return null;
        return { link, title, description, content };
      } catch {
        return null;
      }
    }),
  );

  // 3. Build canonical events
  const events: CanonicalScrapedEvent[] = [];
  for (const entry of enriched) {
    if (!entry) continue;
    const { link, title, description, content } = entry;

    const start = new Date(content.date_from!);
    if (Number.isNaN(start.getTime())) continue;
    const date = toBerlinDate(start);
    if (date < today) continue;
    const time = toBerlinTime(start);

    const end = content.date_to ? new Date(content.date_to) : null;
    const endTime = end && !Number.isNaN(end.getTime()) ? toBerlinTime(end) : null;

    const cleanDescription = stripHtml(description).replace(/\s+/g, " ").trim() || null;

    events.push({
      source_event_id: `${content.id ?? title}|${date}|${time ?? ""}`,
      title: decodeXmlEntities(title),
      description: cleanDescription,
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      detail_url: link,
      labels: buildLabels(title, cleanDescription),
    });
  }

  return { source_slug: "nhm-mainz", display_name: "Naturhistorisches Museum Mainz", events };
}

// ─── helpers ────────────────────────────────────────────────────────────

function extractContentData(html: string): ContentData | null {
  const m = html.match(DATA_CONTENT_RE);
  if (!m) return null;
  const raw = m[1]
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}

function buildLabels(
  title: string,
  description: string | null,
): Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> {
  const labels: Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> = [
    { label: "museum:event", confidence: 0.95, classifier: "scraper-hardcoded" },
  ];
  const t = (title + " " + (description ?? "")).toLowerCase();
  if (t.includes("führung") || t.includes("rundgang") || t.includes("spaziergang")) {
    labels.push({ label: "museum:fuehrung", confidence: 0.8, classifier: "scraper-hardcoded" });
  }
  if (t.includes("vortrag") || t.includes("gespräch") || t.includes("diskussion")) {
    labels.push({ label: "talk:lecture", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  if (t.includes("workshop") || t.includes("werkstatt") || t.includes("forscher") || t.includes("ferien")) {
    labels.push({ label: "museum:workshop", confidence: 0.7, classifier: "scraper-hardcoded" });
  }
  return labels;
}
