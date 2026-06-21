import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * TAUNALE — Taunus Filmfest Oberursel. A multi-day short-film festival whose
 * programme (workshops, screenings and Open-Air-Kurzfilm-/Langfilmabende at
 * Rushmoor Park) is published only as prose on /programm/, which is too loose
 * to scrape film-by-film. Instead we emit a single coarse festival entry per
 * edition.
 *
 * The robust signal is the "add to Google Calendar" CTA on the homepage, an
 * all-day template link carrying structured fields:
 *   text=Taunale+<year> & dates=<start>/<end> & details=<prose>
 * gcal's all-day `end` is exclusive, so the festival's last day is end − 1.
 */
const HOME_URL = "https://taunale.de/";
const PROGRAM_URL = "https://taunale.de/programm/";
const TICKETS_URL = "https://taunale.de/tickets/";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const GCAL_RE = /calendar\/render\?[^"']*/i;

function isoFromCompact(d: string): string {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}
function minusOneDay(iso: string): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
}

export async function scrapeTaunaleOberursel(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(HOME_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`taunale-oberursel fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];

  const link = GCAL_RE.exec(html)?.[0];
  if (link) {
    const params = new URLSearchParams(decodeEntities(link).replace(/^calendar\/render\?/i, ""));
    const range = params.get("dates"); // "20260805/20260810"
    const m = /^(\d{8})\/(\d{8})$/.exec(range ?? "");
    if (m) {
      const date = isoFromCompact(m[1]);
      const endDate = minusOneDay(isoFromCompact(m[2]));
      // Skip an edition that has already ended.
      if (endDate >= today) {
        const year = /Taunale\+(\d{4})/i.exec(link)?.[1] ?? date.slice(0, 4);
        const details = params.get("details");
        const description = details ? stripHtml(decodeEntities(details)).replace(/\s+/g, " ").trim() || null : null;

        events.push({
          source_event_id: `taunale-${year}`,
          title: "TAUNALE – Taunus Filmfest Oberursel",
          description,
          date,
          end_date: endDate > date ? endDate : null,
          time: null,
          detail_url: PROGRAM_URL,
          ticket_url: TICKETS_URL,
          image_url: null,
          labels: [{ label: "film:cinema", confidence: 0.85, classifier: "scraper-hardcoded" }],
        });
      }
    }
  }

  return { source_slug: "taunale-oberursel", display_name: "TAUNALE – Taunus Filmfest Oberursel", events };
}
