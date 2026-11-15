import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { absolute, clean, EXHIBITION_LABEL, eventLabels, fetchText, iso, monthNumber, numericDates, VALENCIA } from "./_valencia";

/**
 * MuVIM (Museu Valencià de la Il·lustració i de la Modernitat), a Drupal 7 site
 * served over plain http (its TLS endpoint is broken). `/es/exposiciones` lists
 * the running exhibitions, `/es/cartelera` the dated activities; the exhibition
 * cards only say "Desde el 7 de marzo", so the range comes from each detail page's
 * `date-display-start` / `date-display-end` fields.
 */
const BASE = "http://www.muvim.es";
const SLUG = "muvim";
const ROW_SPLIT = /<div class="views-row /;

export async function scrapeMuvim(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const [exhibitions, agenda] = await Promise.all([
    fetchText(`${BASE}/es/exposiciones`),
    fetchText(`${BASE}/es/cartelera`),
  ]);
  const events: CanonicalScrapedEvent[] = [];

  for (const row of exhibitions.split(ROW_SPLIT).slice(1)) {
    const item = parseRow(row);
    if (!item) continue;
    const detail = await fetchText(item.url);
    const start = detail.match(/date-display-start"[^>]*>(\d{1,2}\/\d{2}\/\d{4})</)?.[1];
    const end = detail.match(/date-display-end"[^>]*>(\d{1,2}\/\d{2}\/\d{4})</)?.[1];
    const [startIso] = start ? numericDates(start) : [];
    const [endIso] = end ? numericDates(end) : [];
    if (!startIso || (endIso ?? startIso) < today) continue;
    events.push({
      source_event_id: `exposicion|${new URL(item.url).pathname}`,
      title: item.title,
      description: clean(detail.match(/field-name-body[\s\S]*?<div class="field-item[^"]*">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? "").slice(0, 2000) || null,
      date: startIso,
      end_date: endIso && endIso !== startIso ? endIso : null,
      detail_url: item.url,
      image_url: item.image,
      venue_room: item.place,
      labels: [EXHIBITION_LABEL],
      ...MUVIM_GEO,
      ...VALENCIA,
    });
  }

  for (const row of agenda.split(ROW_SPLIT).slice(1)) {
    const item = parseRow(row);
    const dateText = clean(row.match(/views-field-portales7-eventdate">[\s\S]*?<\/div><\/div>/)?.[0] ?? "");
    const m = dateText.match(/(\d{1,2})\s+([A-Za-zñ]+)\s+(\d{4})/);
    const month = m ? monthNumber(m[2]) : null;
    if (!item || !m || !month) continue;
    const date = iso(m[3], month, m[1]);
    // Exhibitions also appear in the agenda; they are already listed above.
    if (date < today || /exposici[oó]n/i.test(item.pretitle)) continue;
    events.push({
      source_event_id: `${new URL(item.url).pathname}|${date}`,
      title: item.title,
      date,
      detail_url: item.url,
      image_url: item.image,
      venue_room: item.place,
      raw_category: item.pretitle || null,
      price_min: row.includes("Gratuita") ? 0 : null,
      labels: eventLabels(item.pretitle, item.title),
      ...MUVIM_GEO,
      ...VALENCIA,
    });
  }
  return { source_slug: SLUG, display_name: "MuVIM", events };
}

const MUVIM_GEO = { lat: 39.4701, lon: -0.3828 };

function parseRow(row: string) {
  const link = row.match(/views-field-title"><span class="field-content"><a href="([^"]+)">([^<]+)<\/a>/);
  if (!link) return null;
  const img = row.match(/<img src="([^"]+)"/)?.[1];
  const placeHtml = row.match(/views-field-portales7-place"><div class="field-content">([\s\S]*)/)?.[1] ?? "";
  return {
    url: absolute(BASE, link[1]),
    title: clean(link[2]),
    image: img ? absolute(BASE, img) : null,
    pretitle: clean(row.match(/views-field-portales7-pretitle"><div class="field-content">([\s\S]*?)<\/div>/)?.[1] ?? ""),
    // Some rooms are embedded entity nodes, others plain text.
    place: clean(placeHtml.match(/field-item even">([^<]+)</)?.[1] ?? placeHtml.split("</div>")[0]).slice(0, 80) || null,
  };
}
