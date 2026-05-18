import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://malsehnkino.de";
const WEEK_URL = `${BASE}/index.php?section=week`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

const BLOCK_RE =
  /<div class="contentBlock">([\s\S]*?)(?=<div class="contentBlock">|<div id="rightCol"|<\/div>\s*<\/div>\s*<\/div>)/g;
const DAY_RE = /<h2 class="blockTitleLeft">[^,]*,\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/;
const ENTRY_RE =
  /<div class="entry"[^>]*>\s*<p class="time">(\d{1,2}:\d{2})<\/p>\s*<h2 class="overview"><a href="([^"]*movieID=(\d+)[^"]*)">([^<]+?)<\/a><\/h2>\s*(?:<h3>([^<]*)<\/h3>)?[\s\S]*?<p class="description">([\s\S]*?)<\/p>/g;

export async function scrapeMalsehn(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(WEEK_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`mal seh'n fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const blockMatch of html.matchAll(BLOCK_RE)) {
    const block = blockMatch[1];
    const dayMatch = block.match(DAY_RE);
    if (!dayMatch) continue;
    const [, day, month, year] = dayMatch;
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (date < today) continue;

    for (const entry of block.matchAll(ENTRY_RE)) {
      const [, time, rawUrl, movieId, rawTitle, subtitleHtml, descHtml] = entry;
      const detail_url = rawUrl.replace(/&amp;/g, "&").startsWith("http")
        ? rawUrl
        : `${BASE}/${rawUrl.replace(/&amp;/g, "&")}`;
      const title = stripHtml(rawTitle).trim();
      if (!title) continue;
      const subtitle = subtitleHtml
        ? stripHtml(subtitleHtml)
            .trim()
            .replace(/^\(|\)$/g, "") || null
        : null;
      const description = descHtml ? stripHtml(descHtml).replace(/\s+/g, " ").trim() || null : null;
      const sourceId = `${movieId}-${date}-${time.replace(":", "")}`;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);

      events.push({
        source_event_id: sourceId,
        title,
        subtitle,
        description,
        date,
        time,
        detail_url,
        labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
      });
    }
  }

  return { source_slug: "malsehn", display_name: "Mal seh'n Kino", events };
}
