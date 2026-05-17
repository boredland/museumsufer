import { classifyTalk } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Karl Marx Buchhandlung (Frankfurt-Bockenheim) — left-leaning bookshop
 * with a steady reading + discussion programme. WordPress category page
 * lists each event as an <article> with the date encoded in the URL
 * slug (DD-MM-YYYY-...) and the title prefix ([DD.MM.YYYY] ...). The
 * detail page has the start time as "HH:MM Uhr". Events sort by event
 * date descending, so upcoming ones come first.
 */
const BASE = "https://karl-marx-buchhandlung.de";
const LIST_URL = `${BASE}/www/category/veranstaltungen/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const ARTICLE_RE =
  /<article\s+id="post-(\d+)"[^>]*class="([^"]*)"[\s\S]*?<h2\s+class="entry-title"><a\s+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/g;
const URL_DATE_RE = /\/(\d{2})-(\d{2})-(\d{4})-/;
const TIME_RE = /(\d{1,2}):(\d{2})\s*Uhr/i;
const DETAIL_DESCRIPTION_RE = /<div[^>]+class="entry-content[^"]*"[^>]*>([\s\S]*?)(?:<footer|<\/article)/i;

const TAG_LABEL: Array<{ tag: string; label: string }> = [
  { tag: "tag-diskussion", label: "talk:diskussion" },
  { tag: "tag-lesung", label: "talk:lesung" },
  { tag: "tag-buchvorstellung", label: "talk:lesung" },
  { tag: "tag-vortrag", label: "talk:vortrag" },
];

export async function scrapeKarlMarxBuchhandlung(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`karl-marx-buchhandlung fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const futures: { id: string; detailUrl: string; date: string; titleRaw: string; classes: string }[] = [];

  for (const m of html.matchAll(ARTICLE_RE)) {
    const id = m[1];
    const classes = m[2];
    const detailUrl = m[3];
    const titleRaw = m[4];

    const urlDate = detailUrl.match(URL_DATE_RE);
    if (!urlDate) continue;
    const date = `${urlDate[3]}-${urlDate[2]}-${urlDate[1]}`;
    if (date < today) continue;

    futures.push({ id, detailUrl, date, titleRaw, classes });
  }

  if (futures.length === 0) {
    return { source_slug: "karl-marx-buchhandlung", display_name: "Karl Marx Buchhandlung", events: [] };
  }

  const events = await Promise.all(futures.map(fetchDetail));
  return {
    source_slug: "karl-marx-buchhandlung",
    display_name: "Karl Marx Buchhandlung",
    events: events.filter((e): e is CanonicalScrapedEvent => e !== null),
  };
}

async function fetchDetail(entry: {
  id: string;
  detailUrl: string;
  date: string;
  titleRaw: string;
  classes: string;
}): Promise<CanonicalScrapedEvent | null> {
  try {
    const res = await fetch(entry.detailUrl, {
      headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const title = stripHtml(decodeEntities(entry.titleRaw))
      // Drop the redundant "[DD.MM.YYYY] " prefix the bookshop puts in every title.
      .replace(/^\[\d{1,2}\.\d{1,2}\.\d{4}\]\s*/, "")
      .replace(/­/g, "") // soft hyphens
      .trim();
    if (!title) return null;

    const timeMatch = html.match(TIME_RE);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

    const descBlock = html.match(DETAIL_DESCRIPTION_RE)?.[1];
    const description = descBlock
      ? stripHtml(decodeEntities(descBlock)).replace(/\s+/g, " ").trim().slice(0, 800) || null
      : null;

    const label = labelForTags(entry.classes, title, description);

    return {
      source_event_id: entry.id,
      title,
      description,
      date: entry.date,
      time,
      end_date: null,
      end_time: null,
      detail_url: entry.detailUrl,
      ticket_url: null,
      image_url: null,
      raw_category: null,
      labels: [{ label, confidence: 0.85, classifier: "scraper-hardcoded" }],
    };
  } catch {
    return null;
  }
}

function labelForTags(classes: string, title: string, description: string | null): string {
  for (const { tag, label } of TAG_LABEL) {
    if (classes.includes(tag)) return label;
  }
  // The bookshop's core programme is readings; default to the talk:* subtype
  // classifyTalk picks from title/description.
  return `talk:${classifyTalk(title, description).toLowerCase()}`;
}
