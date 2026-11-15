import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { absolute, clean, EXHIBITION_LABEL, eventLabels, expectFound, fetchText, parseDateSpan, VALENCIA } from "./_valencia";

/**
 * Jardí Botànic de la Universitat de València. The home page lists the upcoming
 * agenda as `<div class="event">` blocks: `<h3><strong><b>CATEGORY</b></strong>TITLE</h3>`
 * and a "DIES:/DIA:" line in Valencian ("21 OCTUBRE - 22 NOVEMBRE 2026"). Blocks
 * whose line is only a month range ("JULIOL 2026 - DESEMBRE 2027", the standing
 * guided tours) name no day and are skipped. "EXPOSICIONS" blocks are exhibitions.
 */
const BASE = "https://jardibotanic.org";

export async function scrapeJardiBotanic(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const html = await fetchText(`${BASE}/`);
  const events: CanonicalScrapedEvent[] = [];
  for (const block of expectFound(html.split('<div class="event ').slice(1), "jardibotanic.org agenda")) {
    const head = block.match(/<h3><strong><b>([\s\S]*?)<\/b><\/strong>([\s\S]*?)<\/h3>/);
    const link = block.match(/<a href="(\/\?apid=agenda-33&(?:amp;)?id=\d+)">/)?.[1];
    const dates = block.match(/<p><strong>DIE?S?:?\s*<\/strong>([\s\S]*?)<\/p>|<p><strong>DIA\s*:\s*<\/strong>([\s\S]*?)<\/p>|<p><strong>DATES?:<\/strong>([\s\S]*?)<\/p>/);
    if (!head || !link || !dates) continue;
    const span = parseDateSpan(clean(dates[1] ?? dates[2] ?? dates[3] ?? ""), today);
    if (!span || (span.end ?? span.start) < today) continue;
    const category = clean(head[1]);
    const title = clean(head[2]);
    const img = block.match(/<img src="([^"]+)"/)?.[1];
    const isExhibition = /^EXPOSICIONS/i.test(category);
    events.push({
      source_event_id: link.match(/id=(\d+)/)![1],
      title,
      description: clean(block.match(/<\/p>\s*<p>([\s\S]*?)<\/p>/)?.[1] ?? "") || null,
      date: span.start,
      end_date: span.end,
      detail_url: absolute(BASE, link.replace("&amp;", "&")),
      image_url: img ? absolute(BASE, img.replace("mini", "")) : null,
      raw_category: category,
      labels: isExhibition ? [EXHIBITION_LABEL] : eventLabels(category, title),
      lat: 39.4769,
      lon: -0.3867,
      ...VALENCIA,
    });
  }
  return { source_slug: "jardi-botanic-valencia", display_name: "Jardí Botànic de la Universitat de València", events };
}
