/**
 * TU Darmstadt public lectures / Ringvorlesungen.
 *
 * Source: the central public-events HTML calendar
 * (`veranstaltungen_6/index.de.jsp`). It only exposes the next ~two days of
 * events, but that is enough to surface public lectures, Ringvorlesungen and
 * colloquia. We filter the mixed calendar down to lecture-shaped items by
 * keyword.
 */

import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const CALENDAR_URL = "https://www.tu-darmstadt.de/universitaet/aktuelles_meldungen/veranstaltungen_6/index.de.jsp";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const COORDS = { lat: 49.877, lon: 8.651 };

/** Lecture keywords to filter the mixed public calendar down to talks/lectures. */
const LECTURE_RE = /\b(Vorlesung|Ringvorlesung|Vortrag|Kolloquium|Antrittsvorlesung|Vorlesungsreihe)\b/i;

function cleanText(raw: string): string {
  return decodeEntities(stripHtml(raw)).replace(/\s+/g, " ").trim();
}

function isLecture(title: string, description: string): boolean {
  return LECTURE_RE.test(`${title} ${description}`);
}

/** "23.06.2026 , 17:15-18:15" -> { date: "2026-06-23", time: "17:15" } */
function parseDateTime(raw: string): { date: string; time: string | null } | null {
  const d = raw.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!d) return null;
  const t = raw.match(/(\d{2}):(\d{2})/);
  return {
    date: `${d[3]}-${d[2]}-${d[1]}`,
    time: t ? `${t[1]}:${t[2]}` : null,
  };
}

export async function scrapeTuDarmstadtVortraege(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(CALENDAR_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`TU Darmstadt calendar fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  for (const m of html.matchAll(/<li class="article-list-item[^"]*"[\s\S]*?<\/li>/g)) {
    const block = m[0];
    const linkMatch = block.match(/<a class="link[^"]*"[^>]*href="([^"]+)"/);
    const dateMatch = block.match(/<p class="sans-body[^"]*">([\s\S]*?)<\/p>/);
    const titleMatch = block.match(/<h3 class="sans-h5[^"]*">([\s\S]*?)<\/h3>/);
    const descMatch = block.match(/<p class="sans-mini[^"]*">([\s\S]*?)<\/p>/);
    if (!linkMatch || !dateMatch || !titleMatch) continue;

    const title = cleanText(titleMatch[1]);
    const description = descMatch ? cleanText(descMatch[1]) : "";
    if (!isLecture(title, description)) continue;

    const parsed = parseDateTime(cleanText(dateMatch[1]));
    if (!parsed || parsed.date < today) continue;

    const idMatch = linkMatch[1].match(/veranstaltung_(\d+)\.de\.jsp$/);
    const detailUrl = new URL(linkMatch[1], CALENDAR_URL).href;

    events.push({
      source_event_id: idMatch ? idMatch[1] : detailUrl,
      title,
      subtitle: null,
      description: description || null,
      date: parsed.date,
      time: parsed.time,
      detail_url: detailUrl,
      ticket_url: null,
      city: "darmstadt",
      lat: COORDS.lat,
      lon: COORDS.lon,
      venue_room: null,
      performers: null,
      labels: [{ label: "talk:vortrag", confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

  return {
    source_slug: "tu-darmstadt-vortraege",
    display_name: "TU Darmstadt – Öffentliche Vorträge",
    events,
  };
}
