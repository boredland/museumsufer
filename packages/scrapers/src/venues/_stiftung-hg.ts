import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Stiftung Hospital zum Heiligen Geist (operating Krankenhaus Nordwest +
 * Hospital zum Heiligen Geist) — both hospitals share a TYPO3 event
 * backend and run the joint "Medizin im Fokus" patient-lecture series.
 *
 * Each event card carries one or both data-katid markers:
 *   katid=6 → Krankenhaus Nordwest (khnw)
 *   katid=7 → Hospital zum Heiligen Geist
 *
 * Joint events appear at both venues. We fetch the listing once and
 * fan out to two VenueScrapeResults so the hub can attribute events
 * correctly.
 */
const BASE = "https://www.krankenhaus-nordwest.de";
const LIST_URL = `${BASE}/veranstaltungen`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const ARTICLE_RE =
  /<a\s+class="article\s+articletype-\d+"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>(?=\s*(?:<a\s+class="article"|<\/div>|<!--))/g;
const KATID_RE = /data-katid="(\d+)"/g;
const DATE_RE = /<time\s+datetime="(\d{2})\|(\d{4})"[^>]*>\s*(\d{1,2})\.(\d{1,2})\.\d{4}/;
const TITLE_RE = /<h3>\s*([\s\S]*?)\s*<\/h3>/;
const DESC_RE = /<p>\s*([\s\S]*?)\s*<\/p>/;

/** Lecture-style events use 'Medizin im Fokus' as a prefix; everything
 *  else (Trauergruppe, Trauercafé, Familientage, Schwangerschaftskurse, …)
 *  goes through the keyword classifier so support groups don't end up in
 *  the lehrhaus lecture feed. Unclassifiable cards fall back to an
 *  `event:support` label that no app filters on. */
const LECTURE_PREFIX_RE = /^Medizin im Fokus/i;
const SUPPORT_KEYWORDS_RE = /trauer|selbsthilfe|gruppentreffen|peergroup|gesprächskreis|gespraechskreis/i;

export async function scrapeStiftungHg(): Promise<VenueScrapeResult[]> {
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`stiftung-hg fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const nordwestEvents: CanonicalScrapedEvent[] = [];
  const hgEvents: CanonicalScrapedEvent[] = [];

  for (const m of html.matchAll(ARTICLE_RE)) {
    const href = m[1];
    const block = m[2];

    const dateMatch = block.match(DATE_RE);
    if (!dateMatch) continue;
    const date = `${dateMatch[2]}-${dateMatch[1]}-${dateMatch[3].padStart(2, "0")}`;
    if (date < today) continue;

    const title = stripHtml(decodeEntities(block.match(TITLE_RE)?.[1] ?? "")).trim();
    if (!title) continue;

    const description = stripHtml(decodeEntities(block.match(DESC_RE)?.[1] ?? "")).trim() || null;
    const slug = href.split("/").filter(Boolean).pop() ?? `${date}|${title}`;
    const detailUrl = href.startsWith("http") ? href : `${BASE}${href}`;
    const labels: ScrapedLabel[] = [labelsFor(title, description)];

    const katids = new Set<string>();
    for (const k of block.matchAll(KATID_RE)) katids.add(k[1]);

    if (katids.has("6")) {
      nordwestEvents.push({
        source_event_id: slug,
        title,
        description,
        date,
        time: null,
        end_date: null,
        end_time: null,
        detail_url: detailUrl,
        ticket_url: null,
        image_url: null,
        raw_category: null,
        labels,
      });
    }
    if (katids.has("7")) {
      hgEvents.push({
        source_event_id: slug,
        title,
        description,
        date,
        time: null,
        end_date: null,
        end_time: null,
        detail_url: detailUrl.replace("krankenhaus-nordwest.de", "hospital-zum-heiligen-geist.de"),
        ticket_url: null,
        image_url: null,
        raw_category: null,
        labels,
      });
    }
  }

  return [
    { source_slug: "krankenhaus-nordwest", display_name: "Krankenhaus Nordwest", events: nordwestEvents },
    { source_slug: "hospital-zum-heiligen-geist", display_name: "Hospital zum Heiligen Geist", events: hgEvents },
  ];
}

function labelsFor(title: string, description: string | null): ScrapedLabel {
  if (LECTURE_PREFIX_RE.test(title)) {
    return { label: "talk:vortrag", confidence: 0.95, classifier: "scraper-hardcoded" };
  }
  // Support / community formats (Trauergruppe, Trauercafé, Selbsthilfegruppe, …)
  // are explicitly NOT lectures — keep them out of lehrhaus.
  if (SUPPORT_KEYWORDS_RE.test(title) || (description && SUPPORT_KEYWORDS_RE.test(description))) {
    return { label: "event:support", confidence: 0.9, classifier: "scraper-hardcoded" };
  }
  const type = classifyEvent(title, description);
  if (type === "Vortrag") return { label: "talk:vortrag", confidence: 0.85, classifier: "keyword:event" };
  const mapped = eventTypeToLabel(type);
  if (mapped) return { label: mapped, confidence: 0.8, classifier: "keyword:event" };
  // Unknown category at a hospital — neutral label so it doesn't appear in
  // lehrhaus by default.
  return { label: "event:venue", confidence: 0.5, classifier: "scraper-hardcoded" };
}
