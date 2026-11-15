import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { absolute, addDaysIso, clean, EXHIBITION_LABEL, eventLabels, fetchText, numericDates, OPEN_ENDED_DAYS, parseDateSpan, VALENCIA } from "./_valencia";

/**
 * Bombas Gens Centre d'Arts Digitals. The `/es/activitats/` agenda is an
 * Elementor loop grid (five cards, no pager) mixing exhibitions and one-off
 * events. A card heading carries "dd.mm.yyyy" or "dd.mm.yyyy - dd.mm.yyyy"; a
 * range means an exhibition. Cards without a date heading ("Desde el 7 de
 * octubre", recurring guided tours) fall back to the detail page, and are
 * dropped when that has no start date either.
 */
const BASE = "https://bombasgens.com";

export async function scrapeBombasGens(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const html = await fetchText(`${BASE}/es/activitats/`);
  const events: CanonicalScrapedEvent[] = [];

  for (const card of html.split('data-elementor-type="loop-item"').slice(1)) {
    const link = card.match(/<h2[^>]*><a href="([^"]+)">([\s\S]*?)<\/a><\/h2>/);
    if (!link) continue;
    const url = absolute(BASE, link[1]);
    const title = clean(link[2]);
    const heading = card.match(/<h2[^>]*>([^<]*\d{2}\.\d{2}\.\d{4}[^<]*)<\/h2>/)?.[1] ?? "";

    let dates = numericDates(heading);
    let openEndedExhibition = false;
    if (dates.length === 0) {
      const detail = clean(await fetchText(url));
      const since = detail.match(/Desde el \d{1,2} de [a-zé]+( de \d{4})?/i)?.[0];
      const span = since ? parseDateSpan(since, today) : null;
      if (!span) continue;
      dates = [span.start];
      openEndedExhibition = true;
    }
    const [date] = dates;
    // "Desde el 7 de octubre" names no closing date; list it for OPEN_ENDED_DAYS from opening.
    const end = dates.length > 1 ? dates[dates.length - 1] : openEndedExhibition ? addDaysIso(date, OPEN_ENDED_DAYS) : null;
    if ((end ?? date) < today) continue;

    const isExhibition = openEndedExhibition || end !== null;
    const img = card.match(/<img[^>]+src="([^"]+)"/)?.[1];
    events.push({
      source_event_id: new URL(url).pathname,
      title,
      date,
      end_date: end,
      detail_url: url,
      image_url: img ? absolute(BASE, img) : null,
      labels: isExhibition ? [EXHIBITION_LABEL] : eventLabels(title),
      lat: 39.4896,
      lon: -0.3917,
      ...VALENCIA,
    });
  }
  return { source_slug: "bombas-gens", display_name: "Bombas Gens Centre d'Arts Digitals", events };
}
