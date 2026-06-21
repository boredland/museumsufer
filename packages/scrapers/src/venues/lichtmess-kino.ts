import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Lichtmeß Kino — a small volunteer-run arthouse/repertory cinema in Altona.
 * Its WP `film` post type carries no showtimes via REST (ACF isn't exposed),
 * so we parse the rendered /programm page: each screening is a `program-list`
 * row with a `program-list__date` block ("03.06.<br>19.30 Uhr"), a
 * `program-list__title`, and a link to the film's /film/<slug> page. The date
 * has no year (inferred against today); posters are left to the hub's TMDb
 * enrichment.
 */
const PROGRAMM_URL = "https://lichtmess-kino.de/programm/";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

// date (+ optional time) → … → /film/<slug> → title. The `__date` block always
// precedes the film link + title within the same list element.
const ROW_RE =
  /program-list__date">\s*(\d{1,2})\.(\d{1,2})\.\s*(?:<br[^>]*>\s*(\d{1,2})[.:](\d{2})\s*Uhr)?[\s\S]{0,500}?\/film\/([a-z0-9-]+)\/?"[\s\S]{0,200}?program-list__title[^"]*">([^<]+)</gi;

export async function scrapeLichtmessKino(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(PROGRAMM_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`lichtmess-kino fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ROW_RE)) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const time = m[3] ? `${m[3].padStart(2, "0")}:${m[4]}` : null;
    const slug = m[5];
    const title = stripHtml(decodeEntities(m[6])).replace(/\s+/g, " ").trim();
    if (!title) continue;

    const curYear = parseInt(today.slice(0, 4), 10);
    const monthsBehind = Number(today.slice(5, 7)) - Number(mm);
    const date = `${monthsBehind > 6 ? curYear + 1 : curYear}-${mm}-${dd}`;
    if (date < today) continue;

    const key = `${slug}|${date}|${time ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const url = `https://lichtmess-kino.de/film/${slug}/`;
    events.push({
      source_event_id: key,
      title,
      description: null,
      date,
      time,
      detail_url: url,
      ticket_url: url,
      image_url: null, // hub TMDb enrichment supplies posters for film:cinema
      labels: [{ label: "film:cinema", confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "lichtmess-kino", display_name: "Lichtmeß Kino", events };
}
