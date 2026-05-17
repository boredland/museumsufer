import { decodeEntities, normalizeUrl, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Frankfurt University of Applied Sciences (FRA-UAS) — TYPO3 news_list
 * on /de/aktuelles/veranstaltungskalender/. Articles cover both public
 * lectures (Ringvorlesungen, Fachtage, IDialog series, Symposien) and
 * internal-ish stuff (career fairs, start-up workshops, mentoring drop-
 * ins). We keep only the public-talk shapes — SKIP_PATTERNS filters
 * obvious admin events first, then LABELS picks a sub-label by title
 * keyword.
 */
const BASE = "https://www.frankfurt-university.de";
const LIST_URL = `${BASE}/de/aktuelles/veranstaltungskalender/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const ARTICLE_RE = /<article\s+class="news-simple-list__item[^>]*>([\s\S]*?)<\/article>/g;
const DATE_RE = /<time\s+datetime="(\d{4}-\d{2}-\d{2})"/;
const TIME_RE = /<\/time>\s*<\/span>[\s\S]*?(\d{1,2}):(\d{2})\s*(?:bis\s*(\d{1,2}):(\d{2}))?/;
const VENUE_ROOM_RE = /\|\s*<\/[a-z]+>\s*([\s\S]*?)\s*<\/span>/;
const TITLE_LINK_RE = /<a\s+class="news-article-header__link"\s+href="([^"]+)"[^>]*>\s*<h3[^>]*>\s*([\s\S]*?)\s*<\/h3>/;
const DESC_RE = /<div\s+itemprop="description">\s*<p>\s*([\s\S]*?)\s*<\/p>/;

const SKIP_PATTERNS =
  /karrieremesse|karriere(?:woche|tag|forum|messe)|meet@|start[-\s]?up\s*werkstatt|sprechstunde|mentoring|bewerbung|networking|international\s+week|fokus\s+akademische\s+karriere|werkstatt\s+\d/i;
const LABEL_LESUNG = /\blesung\b|buchvorstellung|buchpr[äa]sentation|liest\s+aus/i;
const LABEL_DISKUSSION = /\bdiskussion\b|\bpodium\b|\bdebatte\b|streitgespr/i;

export async function scrapeFrankfurtUas(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`frankfurt-uas fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ARTICLE_RE)) {
    const block = m[1];

    const date = block.match(DATE_RE)?.[1];
    if (!date || date < today) continue;

    const titleMatch = block.match(TITLE_LINK_RE);
    if (!titleMatch) continue;
    const href = titleMatch[1];
    const title = stripHtml(decodeEntities(titleMatch[2])).trim().replace(/\s+/g, " ");
    if (!title) continue;
    if (SKIP_PATTERNS.test(title)) continue;

    const sourceEventId = href.split("/").filter(Boolean).pop() || `${date}|${title}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const timeMatch = block.match(TIME_RE);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;
    const endTime = timeMatch?.[3] && timeMatch?.[4] ? `${timeMatch[3].padStart(2, "0")}:${timeMatch[4]}` : null;

    const venueRoom = stripHtml(decodeEntities(block.match(VENUE_ROOM_RE)?.[1] ?? "")).trim() || null;
    const description = stripHtml(decodeEntities(block.match(DESC_RE)?.[1] ?? "")).trim() || null;

    events.push({
      source_event_id: sourceEventId,
      title,
      description,
      date,
      time,
      end_date: null,
      end_time: endTime,
      detail_url: normalizeUrl(href, BASE),
      ticket_url: null,
      image_url: null,
      venue_room: venueRoom,
      raw_category: null,
      labels: [labelFor(title, description)],
    });
  }

  return { source_slug: "frankfurt-uas", display_name: "Frankfurt University of Applied Sciences", events };
}

function labelFor(title: string, description: string | null): ScrapedLabel {
  const haystack = `${title} ${description ?? ""}`;
  if (LABEL_LESUNG.test(haystack)) {
    return { label: "talk:lesung", confidence: 0.85, classifier: "keyword:event" };
  }
  if (LABEL_DISKUSSION.test(haystack)) {
    return { label: "talk:diskussion", confidence: 0.85, classifier: "keyword:event" };
  }
  return { label: "talk:vortrag", confidence: 0.8, classifier: "scraper-hardcoded" };
}
