import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const API_BASE = "https://api.cineamo.com";

interface CineamoCinema {
  /** Numeric cinema ID in Cineamo's catalogue. */
  id: number;
  /** Our canonical source slug for the hub. */
  source_slug: string;
  /** Display name. */
  name: string;
  /** Public-facing site for fallback detail URLs. */
  websiteBase: string;
}

const CINEMAS: CineamoCinema[] = [
  {
    id: 562,
    source_slug: "3001-kino",
    name: "3001 Kino",
    websiteBase: "https://www.3001-kino.de",
  },
  {
    id: 563,
    source_slug: "abaton-kino",
    name: "Abaton",
    websiteBase: "https://www.abaton.de",
  },
  {
    id: 566,
    source_slug: "passage-kino-hamburg",
    name: "Passage Kino Hamburg",
    websiteBase: "https://www.passagekino.de",
  },
  {
    id: 567,
    source_slug: "magazin-filmkunsttheater",
    name: "Magazin Filmkunsttheater",
    websiteBase: "https://www.magazinfilmkunsttheater.de",
  },
  {
    id: 568,
    source_slug: "metropolis-kino",
    name: "Metropolis Kino",
    websiteBase: "https://www.metropoliskino.de",
  },
  {
    id: 569,
    source_slug: "elbe-filmtheater",
    name: "Elbe Filmtheater",
    websiteBase: "https://www.elbe-filmtheater.de",
  },
  {
    id: 570,
    source_slug: "studio-kino",
    name: "Studio Kino",
    websiteBase: "https://www.studio-kino.de",
  },
  {
    id: 571,
    source_slug: "hansa-filmstudio",
    name: "Hansa-Filmstudio",
    websiteBase: "https://www.kino-bergedorf.de",
  },
  {
    id: 572,
    source_slug: "blankeneser-kino",
    name: "Blankeneser Kino",
    websiteBase: "https://www.blankeneser-kino.de",
  },
  {
    id: 573,
    source_slug: "zeise-kinos",
    name: "Zeise Kinos",
    websiteBase: "https://www.zeise.de",
  },
  {
    id: 967,
    source_slug: "koralle-lichtspiele",
    name: "Koralle Lichtspiele",
    websiteBase: "https://www.koralle-volksdorf.de",
  },
  {
    id: 1082,
    source_slug: "filmpalast-hofheim",
    name: "Filmpalast Hofheim",
    websiteBase: "https://www.filmpalast-hofheim.de",
  },
  {
    id: 1191,
    source_slug: "filmraum",
    name: "Filmraum",
    websiteBase: "https://www.filmraum.com",
  },
  {
    id: 1211,
    source_slug: "schanzenkino-73",
    name: "SchanzenKino 73",
    websiteBase: "https://schanzenkino73.de",
  },
  {
    id: 1243,
    source_slug: "astor-hafencity",
    name: "Astor Film Lounge HafenCity",
    websiteBase: "https://hafencity.premiumkino.de",
  },
  {
    id: 1288,
    source_slug: "savoy-filmtheater",
    name: "Savoy Filmtheater",
    websiteBase: "https://www.savoy-filmtheater.de",
  },
];

interface CineamoShowing {
  id: number;
  name: string;
  startDatetime: string;
  endDatetime: string | null;
  state: string;
  language: string | null;
  originalLanguage: string | null;
  isOriginalLanguage: boolean | null;
  isSubtitled: boolean | null;
  isThreeDimensional: boolean | null;
  cineamoMovieId: string | null;
  movieId: number | null;
  onlineTicketUrl: string | null;
  imageUrl: string | null;
}

interface CineamoResponse {
  _total_items?: number;
  _embedded?: { showings?: CineamoShowing[] | null } | null;
}

/**
 * Cineamo is a SaaS platform smaller German cinemas use for booking +
 * site rendering. /cinemas/{id}/showings-future returns every future
 * screening for a cinema; we just normalise.
 */
export async function scrapeCineamo(): Promise<VenueScrapeResult[]> {
  const today = todayIso();
  return Promise.all(CINEMAS.map((cinema) => scrapeCinema(cinema, today)));
}

async function scrapeCinema(cinema: CineamoCinema, today: string): Promise<VenueScrapeResult> {
  const res = await fetch(`${API_BASE}/cinemas/${cinema.id}/showings-future`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`cineamo fetch failed: ${res.status} for ${cinema.source_slug}`);
  const data = (await res.json()) as CineamoResponse;
  const showings = data._embedded?.showings ?? [];

  const events: CanonicalScrapedEvent[] = [];
  for (const show of showings) {
    if (!show.startDatetime || !show.name) continue;
    // Cineamo serialises startDatetime in UTC ("…Z"); convert to Berlin
    // local so 17:00 CEST stops landing as 15:00 in the feed.
    const start = new Date(show.startDatetime);
    if (Number.isNaN(start.getTime())) continue;
    const date = toBerlinDate(start);
    if (date < today) continue;
    if (show.state && show.state !== "scheduled") continue;
    const time = toBerlinTime(start);
    const endParsed = show.endDatetime ? new Date(show.endDatetime) : null;
    const endTime = endParsed && !Number.isNaN(endParsed.getTime()) ? toBerlinTime(endParsed) : null;

    const dub: string[] = [];
    if (show.isOriginalLanguage) dub.push("OV");
    if (show.isSubtitled) dub.push("OmU");
    if (show.isThreeDimensional) dub.push("3D");
    const subtitle = dub.length ? dub.join(" · ") : null;

    events.push({
      source_event_id: String(show.id),
      title: show.name,
      subtitle,
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      detail_url: `${cinema.websiteBase}/de/film/${show.cineamoMovieId ?? show.movieId ?? ""}`,
      ticket_url: show.onlineTicketUrl,
      image_url: show.imageUrl,
      labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: cinema.source_slug, display_name: cinema.name, events };
}
