import { classifyEvent, classifyTalk, eventTypeToLabel } from "@museumsufer/classify";
import { decodeEntities, normalizeUrl, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Union Club Frankfurt (UIC) — TYPO3 site running sf_event_mgt. The
 * /veranstaltungsuebersicht page lists each upcoming event as one
 * event-mgr-overview--event-teaser block with image, h5 title, date+time
 * line ("29.05.2026, 20:00"), and a teaser paragraph. The event id is
 * embedded in the details URL as `tx_sfeventmgt_pievent[event]=NNN`.
 *
 * The club mixes social events (cocktails, lunches), lectures, kids
 * programmes, and concerts. We run classifyEvent over each title and
 * fall back to `museum:event` when nothing matches — keeps the variety
 * intact without forcing every social into a talk label.
 */
const BASE = "https://www.union-club.com";
const LIST_URL = `${BASE}/veranstaltungsuebersicht`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const TEASER_RE = /<div class="event-mgr-overview--event-teaser">([\s\S]*?)<\/div>\s*<\/div>(?=\s*<\/div>)/g;
const IMG_RE = /<img\s+src="([^"]+)"/i;
const TITLE_RE = /<h5>\s*([\s\S]*?)\s*<\/h5>/i;
const DATE_RE = /event-mgr-overview--event-teaser-date">\s*(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,\s*(\d{1,2}):(\d{2}))?\s*</;
const TEXT_RE = /event-mgr-overview--event-teaser-text">\s*([\s\S]*?)\s*<\/div>/i;
const EVENT_ID_RE = /tx_sfeventmgt_pievent%5Bevent%5D=(\d+)/;
const DETAIL_URL_RE = /<a\s+href="(\/event-details[^"]+)"/i;
const REGISTER_URL_RE = /<a\s+href="(\/event-registration[^"]+)"/i;

export async function scrapeUnionClubFrankfurt(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`union-club-frankfurt fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(TEASER_RE)) {
    const block = m[1];
    const dateMatch = block.match(DATE_RE);
    if (!dateMatch) continue;
    const date = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
    if (date < today) continue;
    const time = dateMatch[4] && dateMatch[5] ? `${dateMatch[4].padStart(2, "0")}:${dateMatch[5]}` : null;

    const title = stripHtml(decodeEntities(block.match(TITLE_RE)?.[1] ?? "")).trim();
    if (!title) continue;

    const detailHref = block.match(DETAIL_URL_RE)?.[1];
    const idFromUrl = detailHref?.match(EVENT_ID_RE)?.[1];
    const sourceEventId = idFromUrl ?? `${date}|${title}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const description = stripHtml(decodeEntities(block.match(TEXT_RE)?.[1] ?? "")).trim() || null;
    const imageHref = block.match(IMG_RE)?.[1] ?? null;
    const image = imageHref ? normalizeUrl(decodeEntities(imageHref), BASE) : null;
    const ticketHref = block.match(REGISTER_URL_RE)?.[1] ?? null;

    events.push({
      source_event_id: sourceEventId,
      title,
      description,
      date,
      time,
      end_date: null,
      end_time: null,
      detail_url: detailHref ? normalizeUrl(decodeEntities(detailHref), BASE) : LIST_URL,
      ticket_url: ticketHref ? normalizeUrl(decodeEntities(ticketHref), BASE) : null,
      image_url: image,
      raw_category: null,
      labels: labelsFor(title, description),
    });
  }

  return { source_slug: "union-club-frankfurt", display_name: "Union International Club Frankfurt", events };
}

function labelsFor(title: string, description: string | null): ScrapedLabel[] {
  const override = OVERRIDES.find((o) => o.match.test(title));
  if (override) return [{ label: override.label, confidence: 0.9, classifier: "scraper-hardcoded" }];

  const type = classifyEvent(title, description);
  if (type === "Vortrag") {
    const sub = classifyTalk(title, description).toLowerCase();
    return [{ label: `talk:${sub}`, confidence: 0.8, classifier: "keyword:event" }];
  }
  const mapped = eventTypeToLabel(type);
  if (mapped) return [{ label: mapped, confidence: 0.8, classifier: "keyword:event" }];
  return [{ label: "museum:event", confidence: 0.4, classifier: "scraper-hardcoded" }];
}

/** Recurring programme titles where classifyEvent's keyword set doesn't
 *  catch the talk-shape. "Frankfurter Köpfe" is the club's portrait-
 *  interview series, Speaker's Luncheon / Dinner Speech are obvious talks,
 *  Literatur im Club is a reading. */
const OVERRIDES: ReadonlyArray<{ match: RegExp; label: string }> = [
  { match: /literatur im club/i, label: "talk:lesung" },
  { match: /frankfurter köpfe/i, label: "talk:vortrag" },
  { match: /speaker['’]?s luncheon/i, label: "talk:vortrag" },
  { match: /dinner speech/i, label: "talk:vortrag" },
];
