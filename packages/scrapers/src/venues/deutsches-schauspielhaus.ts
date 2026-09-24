import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://schauspielhaus.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
/** The spielplan pages by calendar month; three covers the hub's horizon. */
const MONTHS_AHEAD = 3;

const ROW_SPLIT_RE = /<div\s+class="list-row-item"\s+data-performance-date=/;
const DAYDATE_RE = /data-taiko-date="(\d{2})\/(\d{2})"/;
const TITLE_RE = /<a\s+class="list-row-item__main-link"\s+href="([^"]+)">\s*([\s\S]*?)\s*<\/a>/;
const INFO_RE = /<div\s+class="list-row-item__main-info">([\s\S]*?)<\/div>/;
const SUBTITLE_RE = /<div\s+class="list-row-item__info-content">\s*<div>\s*([\s\S]*?)\s*<\/div>/;
const STATUS_RE = /<span\s+class="list-row-item__status">([^<]+)<\/span>/;
const TICKET_RE = /<a\s+class="list-row-item__ticket-link"\s+href="([^"]+)"/;
const TIME_RE = /\b(\d{1,2})\.(\d{2})\s*Uhr\b/g;

/**
 * Deutsches SchauSpielHaus Hamburg. The house's own spielplan
 * (`/spielplan?schedule[0]=month:YYYY-MM`) is server-rendered Drupal: one
 * `list-row-item` per performance with a `DD/MM` day tag, the production
 * link, and an info line "… / 19.30 Uhr / MalerSaal". Status (Ausverkauft,
 * Abgesagt) sits in `list-row-item__status`.
 *
 * Multi-date package rows (e.g. the FREMDE SONNE marathon, which lists
 * several "DD/M/YYYY / HH.MM Uhr" pairs) are skipped: each part also
 * appears as its own dated row.
 *
 * Replaces the Reservix subdomain, which stopped publishing anything once
 * the house moved ticketing to shop.schauspielhaus.de.
 */
export async function scrapeDeutschesSchauspielhaus(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const month of upcomingMonths(today, MONTHS_AHEAD)) {
    const url = `${BASE}/spielplan?schedule%5B0%5D=month%3A${month}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
    if (!res.ok) throw new Error(`deutsches-schauspielhaus fetch failed: ${res.status} ${url}`);
    const html = await res.text();
    const year = month.slice(0, 4);

    for (const row of html.split(ROW_SPLIT_RE).slice(1)) {
      const day = row.match(DAYDATE_RE);
      const link = row.match(TITLE_RE);
      const infoRaw = row.match(INFO_RE)?.[1];
      if (!day || !link || !infoRaw) continue;

      const info = clean(infoRaw);
      const times = [...info.matchAll(TIME_RE)];
      if (times.length !== 1) continue;

      const date = `${year}-${day[2]}-${day[1]}`;
      if (date < today) continue;
      const time = `${times[0][1].padStart(2, "0")}:${times[0][2]}`;
      // "Uraufführung / 19.30 Uhr / MalerSaal / Empfohlen ab 16 Jahren": the
      // room is the segment right after the time; later ones are tags.
      const segments = info.split(" / ").map((s) => s.trim());
      const room = segments[segments.findIndex((s) => /\bUhr\b/.test(s)) + 1] || null;

      const status = row.match(STATUS_RE)?.[1]?.trim().toLowerCase() ?? null;
      if (status === "abgesagt") continue;

      const title = clean(link[2]);
      const path = link[1];
      const sourceEventId = `${path}|${date}|${time}`;
      if (!title || seen.has(sourceEventId)) continue;
      seen.add(sourceEventId);

      const subtitle = clean(row.match(SUBTITLE_RE)?.[1] ?? "") || null;
      const ticketHref = row.match(TICKET_RE)?.[1];

      events.push({
        source_event_id: sourceEventId,
        title,
        subtitle,
        description: null,
        date,
        time,
        detail_url: `${BASE}${path}`,
        ticket_url: ticketHref ? decodeEntities(ticketHref) : null,
        image_url: null,
        price_min: null,
        price_max: null,
        performers: null,
        venue_room: room,
        raw_category: status === "ausverkauft" ? "sold_out" : null,
        availability: status === "ausverkauft" ? "sold_out" : null,
        labels: resolveStageLabels({ title, subtitle, defaultLabel: "stage:theater", confidence: 0.85 }),
      });
    }
  }

  return { source_slug: "deutsches-schauspielhaus", display_name: "Deutsches Schauspielhaus", events };
}

function upcomingMonths(today: string, count: number): string[] {
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return out;
}

function clean(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
