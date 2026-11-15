import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { absolute, clean, EXHIBITION_LABEL, fetchText, parseDateSpan, VALENCIA } from "./_valencia";

/**
 * Fundación Bancaja, Valencia. `/exposiciones/` renders the current
 * exhibitions server-side as `listado-item` cards ("20 Julio 2025 ➟ 31
 * Diciembre 2026"); the "Anteriores" tab loads lazily and is not read. Its REST
 * API is blocked (iThemes Security), so the listing HTML is the source.
 * Cards for other cities ("Fundación Bancaja – Castellón") are dropped.
 */
const BASE = "https://www.fundacionbancaja.es";

export async function scrapeFundacionBancaja(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const html = await fetchText(`${BASE}/exposiciones/`);
  const events: CanonicalScrapedEvent[] = [];
  for (const card of html.split('<div class="listado-item">').slice(1)) {
    const link = card.match(/<div class="item-content">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
    const place = clean(card.match(/<div class="item-fechas">[\s\S]*?<\/div>([\s\S]*?)<\/div>/)?.[1] ?? "");
    const span = parseDateSpan(clean(card.match(/<div class="item-fechas">([\s\S]*?)<\/div>/)?.[1] ?? ""), today);
    if (!link || !span || (span.end ?? span.start) < today) continue;
    if (place && !/Valencia/i.test(place)) continue;
    const img = card.match(/<img[^>]+src="([^"]+)"/)?.[1];
    events.push({
      source_event_id: new URL(link[1]).pathname,
      title: clean(link[2]),
      description: clean(card.match(/<div class="post-excerpt">([\s\S]*?)<\/div>/)?.[1] ?? "") || null,
      date: span.start,
      end_date: span.end,
      detail_url: absolute(BASE, link[1]),
      image_url: img ? absolute(BASE, img) : null,
      labels: [EXHIBITION_LABEL],
      lat: 39.4736,
      lon: -0.3792,
      ...VALENCIA,
    });
  }
  return { source_slug: "fundacion-bancaja", display_name: "Fundación Bancaja", events };
}
