import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.literaturhaus-darmstadt.de";
const LISTING_URL = `${BASE}/programm/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const CARD_RE = /<a href="(\/programm\/[a-z0-9-]+\/)">([\s\S]*?)<\/a>/g;
const DATE_RE =
  /class="date">\s*(\d{2})\.(\d{2})\.(\d{4})(?:\s*-\s*(\d{2})\.(\d{2})\.(\d{4}))?(?:,\s*(\d{1,2}):(\d{2}))?/;
const LOCATION_RE = /class="location">([\s\S]*?)<\/p>/;
const TITLE_RE = /class="title">([\s\S]*?)<\/h3>/;
const SUBTITLE_RE = /class="subtitle">([\s\S]*?)<\/h4>/;

/**
 * Literaturhaus Darmstadt — literary centre (readings, salons, Vorträge, the
 * occasional Kammerkonzert). No Reservix/ztix link surfaces in the markup, but
 * the `/programm/` index server-renders every upcoming event as a clean
 * `.event-item` card: `.date` (DD.MM.YYYY[ - DD.MM.YYYY], HH:MM), `.location`
 * (room), `.title`, optional `.subtitle`. One fetch covers the full calendar.
 */
export async function scrapeLiteraturhausDarmstadt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(LISTING_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`literaturhaus-darmstadt fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  for (const card of html.matchAll(CARD_RE)) {
    const path = card[1];
    const block = card[2];

    const d = block.match(DATE_RE);
    if (!d) continue;
    const date = `${d[3]}-${d[2]}-${d[1]}`;
    const endDate = d[6] ? `${d[6]}-${d[5]}-${d[4]}` : null;
    // Multi-day runs (Ausstellungen) stay visible until their end date.
    if ((endDate ?? date) < today) continue;
    const time = d[7] ? `${d[7].padStart(2, "0")}:${d[8]}` : null;

    const titleMatch = block.match(TITLE_RE);
    if (!titleMatch) continue;
    const title = decodeEntities(stripHtml(titleMatch[1])).replace(/\s+/g, " ").trim();
    if (!title) continue;

    const subtitleMatch = block.match(SUBTITLE_RE);
    const subtitle = subtitleMatch
      ? decodeEntities(stripHtml(subtitleMatch[1])).replace(/\s+/g, " ").trim() || null
      : null;
    const locationMatch = block.match(LOCATION_RE);
    const room = locationMatch ? decodeEntities(stripHtml(locationMatch[1])).replace(/\s+/g, " ").trim() || null : null;

    const slug = path.replace(/\/$/, "").split("/").pop() ?? path;
    if (seen.has(slug)) continue;
    seen.add(slug);

    events.push({
      source_event_id: slug,
      title,
      subtitle,
      date,
      time,
      end_date: endDate,
      detail_url: `${BASE}${path}`,
      venue_room: room,
      city: "darmstadt",
      lat: 49.876,
      lon: 8.642,
      labels: resolveStageLabels({
        title,
        subtitle,
        defaultLabel: "talk:vortrag",
        classifier: "scraper-hardcoded",
        confidence: 0.8,
      }),
    });
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.source_event_id.localeCompare(b.source_event_id),
  );

  return { source_slug: "literaturhaus-darmstadt", display_name: "Literaturhaus Darmstadt", events };
}
