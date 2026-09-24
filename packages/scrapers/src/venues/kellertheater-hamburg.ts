import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const SPIELPLAN_URL = "https://kellertheater.de/spielplan/";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const ARTICLE_SPLIT = '<article class="mec-event-article';
const LINK_RE = /<h4\s+class="mec-event-title">\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
const OCCURRENCE_RE = /[?&]occurrence=(\d{4}-\d{2}-\d{2})/;
const TIME_RE = /<span\s+class="mec-start-time">(\d{1,2}):(\d{2})<\/span>/;
const ORGANIZER_RE = /<li\s+class="mec-organizer-item"><span>([\s\S]*?)<\/span><\/li>/g;

/**
 * Kellertheater Hamburg — amateur stage under the Musikhalle at
 * Johannes-Brahms-Platz. WooCommerce + Modern Events Calendar; `/spielplan/`
 * server-renders every occurrence of the season as a MEC list article with
 * the date in the detail link's `?occurrence=YYYY-MM-DD` and the local start
 * time in `.mec-start-time`. The organizer list carries author and director
 * ("von Agatha Christie", "Regie: …"), used as the subtitle.
 *
 * The page also embeds schema.org Event JSON-LD, but its `startDate` hour is
 * off by two (20:00 shows as 22:00+02:00), so the HTML list is the source.
 * Distinct from `kellertheater-frankfurt`.
 */
export async function scrapeKellertheaterHamburg(): Promise<VenueScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`kellertheater-hamburg fetch failed: ${res.status}`);
  const html = await res.text();
  const today = todayIso();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const article of html.split(ARTICLE_SPLIT).slice(1)) {
    const link = article.match(LINK_RE);
    if (!link) continue;
    const href = decodeEntities(link[1]);
    const date = href.match(OCCURRENCE_RE)?.[1];
    const title = clean(link[2]);
    if (!date || !title || date < today) continue;

    const t = article.match(TIME_RE);
    const time = t ? `${t[1].padStart(2, "0")}:${t[2]}` : null;
    const sourceEventId = `${href.split("?")[0]}|${date}|${time ?? ""}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const credits = [...article.matchAll(ORGANIZER_RE)].map((m) => clean(m[1])).filter(Boolean);
    const subtitle = credits.join(" · ") || null;

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle,
      description: null,
      date,
      time,
      detail_url: href,
      ticket_url: href,
      image_url: null,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: null,
      raw_category: null,
      labels: resolveStageLabels({ title, subtitle, defaultLabel: "stage:theater", confidence: 0.85 }),
    });
  }

  return { source_slug: "kellertheater-hamburg", display_name: "Kellertheater Hamburg", events };
}

function clean(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
