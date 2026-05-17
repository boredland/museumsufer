import { classifyTalk, detectTalkLanguage } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.literaturhaus-frankfurt.de";
const LISTING_URL = `${BASE}/programm/kalender/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

const CARD_RE =
  /<a\s+href="(https?:\/\/literaturhaus-frankfurt\.de\/programm\/termine\/[^"]+)"\s+title="([^"]+)"[\s\S]*?<div class="list-hour">(\d{2}\.\d{2}\.\d{2})<\/div>[\s\S]*?<span class="news-list-hour">(\d{1,2})\.(\d{2})\s*h<\/span>/g;

export async function scrapeLiteraturhaus(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const html = await fetchHtml(LISTING_URL);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(CARD_RE)) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);

    const title = stripHtml(m[2]).trim();
    if (!title) continue;
    // SEXYUNDERGROUND is a recurring writing workshop, not a public reading.
    if (/sexyunderground/i.test(title)) continue;

    const [day, month, yr] = m[3].split(".");
    const year = parseInt(yr, 10) + 2000;
    const date = `${year}-${month}-${day}`;
    if (date < today) continue;

    const time = `${m[4].padStart(2, "0")}:${m[5]}`;
    const sourceEventId = url.replace(/\/+$/, "").split("/").pop() ?? url;

    events.push({
      source_event_id: sourceEventId,
      title,
      date,
      time,
      detail_url: url,
      language: detectTalkLanguage(title),
      labels: [
        {
          label: `talk:${classifyTalk(title).toLowerCase()}`,
          confidence: 0.9,
          classifier: "scraper-hardcoded",
        },
      ],
    });
  }

  return { source_slug: "literaturhaus-frankfurt", display_name: "Literaturhaus Frankfurt", events };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`literaturhaus fetch failed: ${res.status} ${url}`);
  return res.text();
}
