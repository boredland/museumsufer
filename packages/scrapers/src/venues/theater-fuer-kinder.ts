import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * "Theater für Kinder" is the children's programme of the Allee Theater in
 * Hamburg. The old theater-fuer-kinder.reservix.de subdomain now serves
 * Reservix's generic portal front page (no organiser listing), and the
 * venue's own theater-fuer-kinder.de has an invalid TLS certificate. The
 * current season (Spielzeit) overview on alleetheater.de lists each production
 * with one eventim-inhouse ticket link per performance, labelled
 * "So 22.Nov - 14:00h" — no year, so it is derived from the weekday.
 */
const BASE = "https://alleetheater.de";
const LIST_URL = `${BASE}/kindertheater/spielplan-uebersicht-theater-fuer-kinder/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// Every production starts with its poster link, immediately followed by the title block.
const PRODUCTION_RE = /<a href="https:\/\/alleetheater\.de\/events\/([a-z0-9-]+)\/"><img\b[^>]*?\bsrc="([^"]+)"/g;
const TITLE_RE = /<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i;
const DESC_P_RE = /<p>([\s\S]*?)<\/p>/g;
const PERFORMANCE_RE =
  /<a\b[^>]*href="https:\/\/alleetheater\.eventim-inhouse\.de\/[^"]*?event=(\d+)"[^>]*>\s*(Mo|Di|Mi|Do|Fr|Sa|So)\s+(\d{1,2})\.\s*([A-Za-zä]{3})\s*-\s*(\d{1,2}):(\d{2})h\s*<\/a>/g;

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export async function scrapeTheaterFuerKinder(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`theater-fuer-kinder fetch failed: ${LIST_URL} → ${res.status}`);
  const html = await res.text();

  const starts = [...html.matchAll(PRODUCTION_RE)];
  if (starts.length === 0) throw new Error("theater-fuer-kinder: no production blocks on the Spielplan page");

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  let performances = 0;

  for (let i = 0; i < starts.length; i++) {
    const [, slug, poster] = starts[i];
    const segment = html.slice(starts[i].index, starts[i + 1]?.index ?? html.length);

    const title = stripHtml(TITLE_RE.exec(segment)?.[1] ?? "");
    if (!title) throw new Error(`theater-fuer-kinder: production ${slug} has no title`);
    const intro = [...segment.matchAll(DESC_P_RE)].map((p) => stripHtml(p[1].replace(/<br\s*\/?>/gi, " · ")));
    const description = intro.filter(Boolean).join(" · ") || null;

    for (const m of segment.matchAll(PERFORMANCE_RE)) {
      performances++;
      const [, ticketId, weekday, dd, mon, hh, mm] = m;
      const date = resolveDate(Number(dd), mon, weekday, today);
      if (date < today) continue;
      // Weekday-morning slots are school performances, not on sale to the public.
      if (!["Sa", "So"].includes(weekday) && Number(hh) < 12) continue;

      const id = `theater-fuer-kinder|${ticketId}`;
      if (seen.has(id)) continue;
      seen.add(id);

      events.push({
        source_event_id: id,
        title,
        subtitle: null,
        description,
        date,
        time: `${hh.padStart(2, "0")}:${mm}`,
        end_time: null,
        detail_url: `${BASE}/events/${slug}/`,
        ticket_url: decodeEntities(m[0].match(/href="([^"]+)"/)![1]),
        image_url: decodeEntities(poster),
        price_min: null,
        price_max: null,
        performers: null,
        venue_room: "Allee Theater",
        raw_category: null,
        labels: resolveStageLabels({ title, subtitle: null, defaultLabel: "stage:theater", confidence: 0.85 }),
      });
    }
  }

  if (performances === 0) throw new Error("theater-fuer-kinder: productions found but no performance ticket links parsed");

  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return { source_slug: "theater-fuer-kinder", display_name: "Theater für Kinder", events };
}

/** The page prints no year; the weekday pins it to the one of this/next year that fits. */
function resolveDate(day: number, monAbbr: string, weekday: string, today: string): string {
  const month = MONTHS.indexOf(monAbbr);
  if (month < 0) throw new Error(`theater-fuer-kinder: unknown month "${monAbbr}"`);
  const thisYear = Number(today.slice(0, 4));
  for (const year of [thisYear, thisYear + 1]) {
    if (WEEKDAYS[new Date(Date.UTC(year, month, day)).getUTCDay()] === weekday) {
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  throw new Error(`theater-fuer-kinder: ${weekday} ${day}.${monAbbr} matches no weekday in ${thisYear}/${thisYear + 1}`);
}
