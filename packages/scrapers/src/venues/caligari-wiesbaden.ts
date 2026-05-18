import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://caligari.wiesbaden.de";
const RSS_URL = `${BASE}/programmuebersicht/aktuelles-programm?sp:out=rss`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const ITEM_RE = /<item>([\s\S]*?)<\/item>/g;
const GUID_RE = /<guid>([^<]+)<\/guid>/;
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
 * Caligari FilmBühne in Wiesbaden — municipal arthouse, programme rendered
 * via Sitepark's IES. The Sitepark page itself is JS-hydrated, but the
 * site exposes an RSS feed (sp:out=rss) listing every upcoming screening
 * as a separate item; each detail page embeds the show's actual datetime
 * in a `<meta name="application-name" data-content="..."` JSON blob
 * (Sitepark's schedule metadata).
 */
export async function scrapeCaligariWiesbaden(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const rssRes = await fetch(RSS_URL, { headers: { "User-Agent": UA, Accept: "application/rss+xml" } });
  if (!rssRes.ok) throw new Error(`caligari rss fetch failed: ${rssRes.status}`);
  const rss = await rssRes.text();

  const items = Array.from(rss.matchAll(ITEM_RE), (m) => m[1]);
  const enriched = await Promise.all(
    items.map(async (block) => {
      const link = block.match(LINK_RE)?.[1]?.trim();
      const guid = block.match(GUID_RE)?.[1]?.trim() ?? link ?? "";
      const title = block.match(TITLE_RE)?.[1]?.trim() ?? "";
      const description = block.match(DESC_RE)?.[1]?.trim() ?? "";
      if (!link || !title) return null;
      try {
        const detailRes = await fetch(link, { headers: { "User-Agent": UA } });
        if (!detailRes.ok) return null;
        const html = await detailRes.text();
        const content = extractContentData(html);
        if (!content?.date_from) return null;
        return { link, guid, title, description, content };
      } catch {
        return null;
      }
    }),
  );

  const events: CanonicalScrapedEvent[] = [];
  for (const entry of enriched) {
    if (!entry) continue;
    const { link, guid, title, description, content } = entry;
    const start = new Date(content.date_from!);
    if (Number.isNaN(start.getTime())) continue;
    const date = toBerlinDate(start);
    if (date < today) continue;
    const time = toBerlinTime(start);
    const end = content.date_to ? new Date(content.date_to) : null;
    const endTime = end && !Number.isNaN(end.getTime()) ? toBerlinTime(end) : null;

    const sourceId = guid.replace(/[^a-zA-Z0-9]/g, "_") || String(content.id ?? "");
    const cleanDescription = stripHtml(description).replace(/\s+/g, " ").trim() || null;

    events.push({
      source_event_id: sourceId,
      title: decodeXmlEntities(title),
      description: cleanDescription,
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      detail_url: link,
      ticket_url: null,
      labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "caligari-wiesbaden", display_name: "Caligari FilmBühne Wiesbaden", events };
}

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
    return JSON.parse(raw) as ContentData;
  } catch {
    return null;
  }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
