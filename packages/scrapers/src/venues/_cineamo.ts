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
    id: 1082,
    source_slug: "filmpalast-hofheim",
    name: "Filmpalast Hofheim",
    websiteBase: "https://www.filmpalast-hofheim.de",
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
