import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Lichtmeß Kino — a small volunteer-run arthouse/repertory cinema in Altona.
 * Its WP `film` post type carries no showtimes via REST (ACF isn't exposed),
 * so we parse the rendered /programm page: each screening is a `program-list`
 * row whose `program-list__date` block carries `<time datetime="YYYY-MM-DD
 * HH:MM">`, then a link to the film's /film/<slug> page and its
 * `program-list__title`. Posters are left to the hub's TMDb enrichment.
 *
 * The page shows one month; `?month=<M>-<YYYY>` selects another. We read the
 * current and the next month, since the current one runs out by its end.
 */
const PROGRAMM_URL = "https://lichtmess-kino.de/programm/";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const ROW_RE = /<li class="program-list__el[\s\S]*?<\/li>/g;
const DATETIME_RE = /<time datetime="(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?"/;
const FILM_RE = /\/film\/([a-z0-9-]+)\/?"/;
const TITLE_RE = /program-list__title[^"]*">([^<]+)</;

export async function scrapeLichtmessKino(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const next = m === 12 ? `1-${y + 1}` : `${m + 1}-${y}`;
  const pages = await Promise.all([PROGRAMM_URL, `${PROGRAMM_URL}?month=${next}`].map(fetchPage));
  const html = pages.join("\n");

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const [row] of html.matchAll(ROW_RE)) {
    const when = row.match(DATETIME_RE);
    const slug = row.match(FILM_RE)?.[1];
    const title = stripHtml(decodeEntities(row.match(TITLE_RE)?.[1] ?? ""))
      .replace(/\s+/g, " ")
      .trim();
    if (!when || !slug || !title) continue;
    const [, date, time = null] = when;
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

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`lichtmess-kino fetch failed: ${res.status} ${url}`);
  return res.text();
}
