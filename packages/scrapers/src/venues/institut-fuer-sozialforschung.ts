import { classifyTalk, detectTalkLanguage } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.ifs.uni-frankfurt.de";
const LISTING_URL = `${BASE}/aktuell.html`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const EVENT_RE =
  /<h3 class="event-category hide-sm">([^<]+)<\/h3>[\s\S]{0,1000}?<a href="(eventleser\/[^"]+)" title="([^"]+)" itemprop="url">/g;

const DATE_RE =
  /\((?:[A-Za-zäöüÄÖÜ]+,\s*)?(\d{2})\.(\d{2})\.(\d{4})(?:,\s*(\d{1,2}:\d{2})(?:[–-](\d{1,2}:\d{2}))?)?\)\s*$/;
const STRIP_DATE_RE = /\s*\((?:[A-Za-zäöüÄÖÜ]+,\s*)?\d{2}\.\d{2}\.\d{4}.*?\)\s*$/;

export async function scrapeInstitutFuerSozialforschung(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(LISTING_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`ifs fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(EVENT_RE)) {
    const category = stripHtml(m[1]).trim();
    if (category === "Tagungen, Konferenzen, Workshops") continue;

    const href = m[2];
    const url = `${BASE}/${href}`;
    if (seen.has(url)) continue;
    seen.add(url);

    const titleAttr = m[3];
    const dm = titleAttr.match(DATE_RE);
    if (!dm) continue;

    const date = `${dm[3]}-${dm[2]}-${dm[1]}`;
    if (date < today) continue;

    const time = dm[4] ?? null;
    const endTime = dm[5] ?? null;
    const title = stripHtml(titleAttr.replace(STRIP_DATE_RE, "")).trim();
    if (!title) continue;
    const sourceEventId = href.replace(/^eventleser\//, "").replace(/\.html$/, "");

    events.push({
      source_event_id: sourceEventId,
      title,
      date,
      time,
      end_time: endTime,
      detail_url: url,
      language: detectTalkLanguage(title),
      raw_category: category,
      labels: [
        {
          label: `talk:${classifyTalk(title).toLowerCase()}`,
          confidence: 0.85,
          classifier: "upstream-category",
        },
      ],
    });
  }

  return { source_slug: "institut-fuer-sozialforschung", events };
}
