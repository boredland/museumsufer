import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { absolute, clean, EXHIBITION_LABEL, eventLabels, fetchText, parseDateSpan, VALENCIA } from "./_valencia";

/**
 * IVAM (Institut Valencià d'Art Modern). Its WordPress theme renders the
 * `/es/exposiciones/` and `/es/actividades/` archives as server-side
 * `ivam-post-card` blocks grouped by `data-timeline` (present / future / past);
 * the past group is skipped. Card dates are "28 oct. 2026 – 11 abr. 2027".
 */
const BASE = "https://ivam.es";
const SLUG = "ivam";

export async function scrapeIvam(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const [exhibitions, activities] = await Promise.all([
    fetchText(`${BASE}/es/exposiciones/`),
    fetchText(`${BASE}/es/actividades/`),
  ]);
  return {
    source_slug: SLUG,
    display_name: "IVAM",
    events: [...parseCards(exhibitions, today, true), ...parseCards(activities, today, false)],
  };
}

function parseCards(html: string, today: string, exhibition: boolean): CanonicalScrapedEvent[] {
  const out: CanonicalScrapedEvent[] = [];
  for (const group of html.split('data-timeline="').slice(1)) {
    const timeline = group.slice(0, group.indexOf('"'));
    if (timeline === "past") continue;
    for (const card of group.split('<div class="ivam-post-card ').slice(1)) {
      const link = card.match(/<a href="([^"]+)" title="[^"]*">\s*<h3 class="ivam-post-card__title">([\s\S]*?)<\/h3>/);
      const span = parseDateSpan(clean(card.match(/<p class="date">([\s\S]*?)<\/p>/)?.[1] ?? ""), today);
      if (!link || !span || (span.end ?? span.start) < today) continue;
      const title = clean(link[2]);
      const categories = [...card.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => clean(m[1]));
      const img = card.match(/<img class="ivam-post-card__img" src="([^"]+)"/)?.[1];
      out.push({
        source_event_id: `${exhibition ? "exposicion" : "actividad"}|${new URL(link[1]).pathname}`,
        title,
        date: span.start,
        end_date: span.end,
        detail_url: absolute(BASE, link[1]),
        image_url: img ? absolute(BASE, img) : null,
        raw_category: categories.join(", ") || null,
        venue_room: categories.find((c) => /^IVAM /.test(c)) ?? null,
        labels: exhibition ? [EXHIBITION_LABEL] : eventLabels(categories.join(" "), title),
        lat: 39.4796,
        lon: -0.3829,
        ...VALENCIA,
      });
    }
  }
  return out;
}
