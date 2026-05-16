import { detectTalkLanguage } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const FEED_URL = "https://fgz-risc.uni-frankfurt.de/category/veranstaltungen/streitclub/feed/";
const TICKET_BASE = "https://english-theatre.de/tickets/event/";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const DE_MONTHS: Record<string, string> = {
  Januar: "01",
  Februar: "02",
  März: "03",
  April: "04",
  Mai: "05",
  Juni: "06",
  Juli: "07",
  August: "08",
  September: "09",
  Oktober: "10",
  November: "11",
  Dezember: "12",
};

const ITEM_RE = /<item>([\s\S]*?)<\/item>/g;
const TITLE_RE = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([^<]*)<\/title>/;
const LINK_RE = /<link>([^<]+)<\/link>/;
const DATE_RE =
  /(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*(\d{4})/;
const TIME_RE = /(\d{1,2}):(\d{2})\s*(?:&#8211;|-|–)/;

export async function scrapeFgzStreitclub(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(FEED_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`fgz-streitclub fetch failed: ${res.status}`);

  const xml = await res.text();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of xml.matchAll(ITEM_RE)) {
    const item = m[1];

    const title = stripHtml(item.match(TITLE_RE)?.[1] ?? item.match(TITLE_RE)?.[2] ?? "").trim();
    if (!title || !title.includes("StreitClub")) continue;

    const url = item.match(LINK_RE)?.[1]?.trim() ?? "";
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const dm = item.match(DATE_RE);
    if (!dm) continue;
    const month = DE_MONTHS[dm[2]];
    if (!month) continue;
    const date = `${dm[3]}-${month}-${dm[1].padStart(2, "0")}`;
    if (date < today) continue;

    const tm = item.match(TIME_RE);
    const time = tm ? `${tm[1].padStart(2, "0")}:${tm[2]}` : null;

    const slug = url.replace(/.*\/([^/]+)\/$/, "$1");
    const ticketUrl = `${TICKET_BASE}${slug}/`;

    events.push({
      source_event_id: slug,
      title,
      date,
      time,
      detail_url: url,
      ticket_url: ticketUrl,
      language: detectTalkLanguage(title),
      labels: [{ label: "talk:diskussion", confidence: 1.0, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "fgz-streitclub", events };
}
