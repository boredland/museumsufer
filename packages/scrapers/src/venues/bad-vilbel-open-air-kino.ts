import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Open-Air-Kino im Bad Vilbeler Freibad — the long-running summer open-air
 * cinema (since 1993) in the town's outdoor pool. Distinct from the indoor
 * `kino-alte-muehle-bad-vilbel` already covered via kinoheld, so it gets its
 * own source slug.
 *
 * The site is Gatsby + Storyblok: the /open-air-kino/ landing page links to one
 * detail page per film (`/open-air-kino/programm/<season>/<slug>`), and Gatsby
 * mirrors every page's data at `/page-data<path>/page-data.json`. The film
 * entry's Storyblok `content` (a JSON string) carries `title`, a `dates[]`
 * array of `event_date` objects (`datetime` "YYYY-MM-DD HH:MM" + a cinetixx
 * booking link), a `cover` poster asset and a `description`.
 */
const BASE = "https://www.kultur-bad-vilbel.de";
const LISTING_URL = `${BASE}/open-air-kino/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

// Film detail paths: /open-air-kino/programm/<season>/<slug> (4 segments).
const FILM_PATH_RE = /\/open-air-kino\/programm\/[a-z0-9-]+\/[a-z0-9-]+/g;

interface StoryblokAsset {
  filename?: string;
}
interface EventDate {
  datetime?: string;
  ticket_link?: string;
  cinetixx_link?: string;
}
interface FilmContent {
  title?: string;
  dates?: EventDate[];
  cover?: StoryblokAsset;
  image?: StoryblokAsset;
  description?: string;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function scrapeBadVilbelOpenAirKino(): Promise<VenueScrapeResult> {
  const today = todayIso();

  const listRes = await fetch(LISTING_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!listRes.ok) throw new Error(`bad-vilbel-open-air-kino fetch failed: ${listRes.status}`);
  const html = await listRes.text();

  const paths = [...new Set([...html.matchAll(FILM_PATH_RE)].map((m) => m[0]))];

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  const films = await Promise.all(
    paths.map(async (path) => {
      const data = (await fetchJson(`${BASE}/page-data${path}/page-data.json`)) as {
        result?: { data?: { entry?: { content?: string } } };
      } | null;
      const raw = data?.result?.data?.entry?.content;
      if (!raw) return null;
      try {
        return { path, content: JSON.parse(raw) as FilmContent };
      } catch {
        return null;
      }
    }),
  );

  for (const film of films) {
    if (!film) continue;
    const { path, content } = film;
    const title = content.title ? stripHtml(decodeEntities(content.title)).replace(/\s+/g, " ").trim() : "";
    if (!title || !content.dates?.length) continue;

    const image = content.cover?.filename || content.image?.filename || null;
    const description = content.description
      ? stripHtml(decodeEntities(content.description)).replace(/\s+/g, " ").trim() || null
      : null;
    const detailUrl = `${BASE}${path}`;

    for (const d of content.dates) {
      if (!d.datetime) continue;
      const date = d.datetime.slice(0, 10);
      if (date < today) continue;
      const time = d.datetime.length >= 16 ? d.datetime.slice(11, 16) : null;

      const key = `${path}|${date}|${time ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const ticket = d.cinetixx_link || d.ticket_link || detailUrl;
      events.push({
        source_event_id: key,
        title,
        description,
        date,
        time,
        detail_url: detailUrl,
        ticket_url: ticket,
        image_url: image,
        labels: [{ label: "film:cinema", confidence: 0.9, classifier: "scraper-hardcoded" }],
      });
    }
  }

  return { source_slug: "bad-vilbel-open-air-kino", display_name: "Open-Air-Kino Bad Vilbel", events };
}
