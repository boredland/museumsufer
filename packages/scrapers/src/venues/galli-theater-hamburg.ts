import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * Galli Theater Hamburg — interactive fairy-tale and clown theatre for
 * children (Johannes Galli repertoire) plus evening solo pieces. No fixed
 * house: performances run at partner venues (Kunstklinik Eppendorf, Planten
 * un Blomen, seasonal Ostsee stages). The WordPress "Events Manager" plugin
 * renders a server-side spielplan grouped by month; tickets go through
 * eventim-light. We parse the SSR list — its times are local (the `?ical=1`
 * feed emits UTC, which would shift every showtime).
 */
const SPIELPLAN_URL = "https://galli-hamburg.de/spielplan/";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mär: "03",
  mae: "03",
  apr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  okt: "10",
  nov: "11",
  dez: "12",
};

export async function scrapeGalliTheaterHamburg(): Promise<VenueScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`galli-theater-hamburg fetch failed: ${res.status}`);
  const html = await res.text();
  const today = todayIso();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  let year: string | null = null;
  let month: string | null = null;

  // The list interleaves `<h2>Monat Jahr</h2>` headers with per-show
  // `spielplanV1` blocks; split on both so each block inherits the month/year
  // of the most recent header.
  for (const part of html.split(/(?=<div class="spielplanV1">)|(?=<h2>)/)) {
    const head = part.match(/^<h2>\s*([A-Za-zÄÖÜäöüß.]+)\.?\s+(\d{4})\s*<\/h2>/);
    if (head) {
      month = MONTHS[head[1].toLowerCase().slice(0, 3)] ?? null;
      year = head[2];
      continue;
    }
    if (!part.startsWith('<div class="spielplanV1">') || !month || !year) continue;

    const day = part.match(/class="datumV1">\s*(\d{1,2})\s*</)?.[1];
    const titleM = part.match(/class="titelV1">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
    if (!day || !titleM) continue;
    const detailUrl = titleM[1];
    const title = clean(titleM[2]);
    if (!title) continue;

    const sub = clean(part.match(/class="untertitelV1">([\s\S]*?)<\/div>/)?.[1] ?? "");
    const timeM = sub.match(/(\d{1,2}):(\d{2})/);
    const time = timeM ? `${timeM[1].padStart(2, "0")}:${timeM[2]}` : null;
    const category = sub.replace(/^\s*\d{1,2}:\d{2}\s*h?\s*\/?\s*/, "").trim() || null;
    const venueRoom = clean(part.match(/class="gastspielortV1">([\s\S]*?)<\/div>/)?.[1] ?? "") || null;
    const ticketUrl = part.match(/class="buttonV1" href="([^"]+)"/)?.[1] || null;
    const image = part.match(/class="imageV1"><img[^>]*\bsrc="([^"]+)"/)?.[1] || null;

    const date = `${year}-${month}-${day.padStart(2, "0")}`;
    if (date < today) continue;

    const slug = detailUrl.match(/\/events\/([^/]+)\//)?.[1] ?? `${title}-${date}-${time ?? ""}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    events.push({
      source_event_id: slug,
      title,
      subtitle: category,
      description: null,
      date,
      time,
      detail_url: detailUrl,
      ticket_url: ticketUrl,
      image_url: image,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: venueRoom,
      raw_category: category,
      labels: resolveStageLabels({
        title,
        subtitle: category,
        defaultLabel: "stage:theater",
        confidence: 0.85,
        classifier: "scraper-hardcoded",
      }),
    });
  }

  return { source_slug: "galli-theater-hamburg", display_name: "Galli Theater Hamburg", events };
}

function clean(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
