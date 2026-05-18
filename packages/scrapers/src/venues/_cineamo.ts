import { todayIso } from "@museumsufer/core/date";
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
    const [date, timeFull] = show.startDatetime.split("T");
    if (!date || date < today) continue;
    if (show.state && show.state !== "scheduled") continue;
    const time = timeFull ? timeFull.slice(0, 5) : null;
    const endTime = show.endDatetime?.includes("T") ? show.endDatetime.split("T")[1].slice(0, 5) : null;

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
