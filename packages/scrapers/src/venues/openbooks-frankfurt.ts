import { classifyTalk } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.openbooks-frankfurt.de";
const LISTING_URL = `${BASE}/programm/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 300;

const DAYTITLE_RE = /data-day="(\d{8})"/g;
const ARTICLE_RE = /<article\s+data-day=(\d{8})[^>]*>([\s\S]*?)<\/article>/g;
const TIME_RE = /<time[^>]*>([^<]+)<\/time>/;
const TITLE_RE = /<h2[^>]*>([\s\S]*?)<\/h2>/;
const LINK_RE = /href="(https:\/\/www\.openbooks-frankfurt\.de\/termin\/[^"?#]+)"/;

export async function scrapeOpenBooks(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const html = await fetchText(LISTING_URL);

  const days = new Set<string>();
  for (const m of html.matchAll(DAYTITLE_RE)) {
    days.add(m[1]);
  }
  if (days.size === 0) return { source_slug: "openbooks-frankfurt", events: [] };

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const ddmmyyyy of days) {
    const date = ddmmyyyyToIso(ddmmyyyy);
    if (date < today) continue;

    await sleep(THROTTLE_MS);
    const tt = `${ddmmyyyy.slice(4, 8)}${ddmmyyyy.slice(2, 4)}${ddmmyyyy.slice(0, 2)}`;
    const dayHtml = await fetchText(`${LISTING_URL}?tt=${tt}`);

    for (const m of dayHtml.matchAll(ARTICLE_RE)) {
      const content = m[2];

      const linkMatch = LINK_RE.exec(content);
      if (!linkMatch) continue;
      const detailUrl = linkMatch[1];
      if (seen.has(detailUrl)) continue;
      seen.add(detailUrl);

      const titleMatch = TITLE_RE.exec(content);
      if (!titleMatch) continue;
      const title = stripHtml(decodeEntities(titleMatch[1])).trim();
      if (!title) continue;

      const timeMatch = TIME_RE.exec(content);
      const timeRaw = timeMatch ? decodeEntities(timeMatch[1]) : null;
      const time = timeRaw ? (/(\d{1,2}:\d{2})$/.exec(timeRaw.trim())?.[1] ?? null) : null;
      const sourceEventId = detailUrl.replace(/\/+$/, "").split("/").pop() ?? detailUrl;

      events.push({
        source_event_id: sourceEventId,
        title,
        date,
        time,
        detail_url: detailUrl,
        labels: [
          {
            label: `talk:${classifyTalk(title).toLowerCase()}`,
            confidence: 0.9,
            classifier: "scraper-hardcoded",
          },
        ],
      });
    }
  }

  return { source_slug: "openbooks-frankfurt", events };
}

function ddmmyyyyToIso(ddmmyyyy: string): string {
  return `${ddmmyyyy.slice(4, 8)}-${ddmmyyyy.slice(2, 4)}-${ddmmyyyy.slice(0, 2)}`;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`openbooks fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
