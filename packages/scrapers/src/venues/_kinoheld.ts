import { dateOffset } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const GRAPHQL_URL = "https://next-live.kinoheld.de/graphql";
const WIDGET_BASE = "https://www.kinoheld.de";

interface KinoheldCinema {
  /** Numeric cinema ID inside kinoheld's backend. */
  id: string;
  /** URL slug for the city as kinoheld uses it (e.g. "moerfelden-walldorf"). */
  citySlug: string;
  /** Cinema's URL slug (e.g. "lichtblick"). */
  urlSlug: string;
  /** Our canonical source slug for the hub. */
  source_slug: string;
  /** Display name. */
  name: string;
}

const CINEMAS: KinoheldCinema[] = [
  {
    id: "903",
    citySlug: "moerfelden-walldorf",
    urlSlug: "lichtblick",
    source_slug: "lichtblick-moerfelden",
    name: "Lichtblick Kinotreff Mörfelden-Walldorf",
  },
  {
    id: "1323",
    citySlug: "bad-vilbel",
    urlSlug: "kino-alte-muehle",
    source_slug: "kino-alte-muehle-bad-vilbel",
    name: "Kino Alte Mühle Bad Vilbel",
  },
  {
    id: "874",
    citySlug: "kronberg-im-taunus",
    urlSlug: "kronberger-lichtspiele",
    source_slug: "kronberger-lichtspiele",
    name: "Kronberger Lichtspiele",
  },
  {
    id: "818",
    citySlug: "kelkheim-taunus",
    urlSlug: "kino-kelkheim",
    source_slug: "kino-kelkheim",
    name: "Kino Kelkheim",
  },
  {
    id: "14",
    citySlug: "hamburg",
    urlSlug: "hansa-filmstudio-bergedorf-hamburg",
    source_slug: "hansa-filmstudio-bergedorf",
    name: "Hansa-Filmstudio Bergedorf",
  },
  {
    id: "597",
    citySlug: "heidelberg",
    urlSlug: "gloria-gloriette",
    source_slug: "gloria-gloriette-heidelberg",
    name: "Gloria & Gloriette Heidelberg",
  },
  {
    id: "640",
    citySlug: "heidelberg",
    urlSlug: "kamera",
    source_slug: "kamera-heidelberg",
    name: "Die Kamera Heidelberg",
  },
  // Filmpalast Hofheim is also on kinoheld (id 3809) but doesn't publish
  // showtimes there — they use Cineamo for booking. Keep in mind for a
  // future Cineamo scraper.
  // Wuppertaler Kinos — Rex + Cinema im Atelier (Lichtblick Cinema GmbH)
  {
    id: "1629",
    citySlug: "wuppertal",
    urlSlug: "rex-filmtheater-wuppertal",
    source_slug: "rex-filmtheater-wuppertal",
    name: "Rex Filmtheater Wuppertal",
  },
  {
    id: "213",
    citySlug: "wuppertal",
    urlSlug: "cinema-wuppertal",
    source_slug: "cinema-wuppertal",
    name: "Cinema Wuppertal",
  },
  // Das Lumen — Solingen arthouse/OV series
  {
    id: "224",
    citySlug: "solingen",
    urlSlug: "das-lumen-filmtheater-solingen",
    source_slug: "das-lumen-filmtheater-solingen",
    name: "Das Lumen Filmtheater Solingen",
  },
  // City Kinos Saarbrücken — UT-Kino + Passage-Kinos
  {
    id: "1266",
    citySlug: "saarbruecken",
    urlSlug: "ut-kinos-saarbruecken",
    source_slug: "city-kinos-saarbruecken",
    name: "UT-Kinos Saarbrücken",
  },
  {
    id: "1058",
    citySlug: "saarbruecken",
    urlSlug: "passage-kinos-saarbruecken",
    source_slug: "city-kinos-saarbruecken",
    name: "Passage-Kinos Saarbrücken",
  },
];

const SHOWS_QUERY = `query Shows($cinemaId: ID!, $dates: [Date!]) {
  shows(cinemaId: $cinemaId, dates: $dates) {
    data {
      id
      beginning
      urlSlug
      isBookable
      deeplink
      movie {
        id
        title
        urlSlug
        duration
      }
      flags { name }
    }
  }
}`;

interface ShowFlag {
  name: string | null;
}

interface ShowMovie {
  id: string;
  title: string;
  urlSlug: string | null;
  duration: number | null;
}

interface KinoheldShow {
  id: string;
  beginning: string;
  urlSlug: string | null;
  isBookable: boolean | null;
  deeplink: string | null;
  movie: ShowMovie | null;
  flags: ShowFlag[] | null;
}

const HORIZON_DAYS = 28;

/** Upstream rejects `shows(dates:)` with more than three entries, so the
 *  horizon is requested in chunks of this size rather than one batch. */
const MAX_DATES_PER_QUERY = 3;

/**
 * Generic kinoheld.de GraphQL scraper. The `shows(cinemaId, dates)` query
 * returns one entry per screening; we batch the next ~4 weeks into a single
 * request per cinema. Covers the small Frankfurt-region, Hamburg, and
 * Heidelberg (Gloria & Gloriette, Die Kamera) cinemas that publish through
 * the kinoheld widget.
 */
export async function scrapeKinoheld(): Promise<VenueScrapeResult[]> {
  const dates = Array.from({ length: HORIZON_DAYS }, (_, i) => dateOffset(i));
  // One cinema's outage (or a slug kinoheld dropped) must not take the whole
  // aggregator down with it: settle per cinema and keep the rest.
  const settled = await Promise.allSettled(CINEMAS.map((cinema) => scrapeCinema(cinema, dates)));
  const results: VenueScrapeResult[] = [];
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
      continue;
    }
    const cinema = CINEMAS[i];
    console.warn(`kinoheld ${cinema.source_slug}: ${outcome.reason}`);
    results.push({ source_slug: cinema.source_slug, display_name: cinema.name, events: [] });
  }
  return results;
}

async function scrapeCinema(cinema: KinoheldCinema, dates: string[]): Promise<VenueScrapeResult> {
  const events: CanonicalScrapedEvent[] = [];
  for (let i = 0; i < dates.length; i += MAX_DATES_PER_QUERY) {
    events.push(...(await fetchShows(cinema, dates.slice(i, i + MAX_DATES_PER_QUERY))));
  }
  return { source_slug: cinema.source_slug, display_name: cinema.name, events };
}

async function fetchShows(cinema: KinoheldCinema, dates: string[]): Promise<CanonicalScrapedEvent[]> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: SHOWS_QUERY, variables: { cinemaId: cinema.id, dates } }),
  });
  if (!res.ok) throw new Error(`kinoheld fetch failed: ${res.status} for ${cinema.source_slug}`);
  const json = (await res.json()) as {
    data?: { shows?: { data?: KinoheldShow[] | null } | null } | null;
    errors?: unknown;
  };
  if (json.errors) throw new Error(`kinoheld graphql errors for ${cinema.source_slug}: ${JSON.stringify(json.errors)}`);
  const shows = json.data?.shows?.data ?? [];

  const events: CanonicalScrapedEvent[] = [];
  for (const show of shows) {
    if (!show.movie || !show.beginning) continue;
    const [date, timeFull] = show.beginning.split("T");
    if (!date) continue;
    const time = timeFull ? timeFull.slice(0, 5) : null;

    const flagNames = (show.flags ?? []).map((f) => f.name).filter((n): n is string => !!n);
    const dub = flagNames.find((n) => /OmU|OV|Originalversion|Untertitel/i.test(n));
    const subtitleParts: string[] = [];
    if (dub) subtitleParts.push(dub);
    if (show.movie.duration) subtitleParts.push(`${show.movie.duration} min`);
    const subtitle = subtitleParts.length ? subtitleParts.join(" · ") : null;

    const movieSlug = show.movie.urlSlug ?? "";
    const detail_url = `${WIDGET_BASE}/kino/${cinema.citySlug}/${cinema.urlSlug}/film/${movieSlug}`;
    const ticket_url =
      show.deeplink ?? `${WIDGET_BASE}/kino/${cinema.citySlug}/${cinema.urlSlug}/vorstellung/${show.id}`;

    events.push({
      source_event_id: show.id,
      title: show.movie.title,
      subtitle,
      date,
      time,
      detail_url,
      ticket_url,
      labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return events;
}
