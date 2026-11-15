import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * CineStar cinemas. The CineStar site's own JSON API
 * (`/api/cinema/<id>/show/`) returns every film with its showtimes, each
 * tagged with Vista attributes: language (`OV`, `OMU`, `LANG_xx`) and event
 * type (`ET_SONDERVORSTELLUNG`, `ET_EVENT`, `ET_PREVIEW`, `ET_SNEAK`).
 * `/api/cinema/` lists every house with its API id and Vista cinema number.
 *
 * The regular programme is mainstream first-run, which the cinema app
 * doesn't carry; we keep original-language and special screenings (Met
 * opera and ballet broadcasts, concert films, OmU releases, film clubs).
 */
const API_BASE = "https://www.cinestar.de/api/cinema";
const SITE = "https://www.cinestar.de";
/** Vista web-ticketing. */
const TICKET_BASE = "https://webticketing3.cinestar.de/";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const KEEP_ATTRIBUTES = new Set(["OV", "OMU", "ET_SONDERVORSTELLUNG", "ET_EVENT", "ET_PREVIEW", "ET_SNEAK"]);

interface CinestarCinema {
  /** Id in CineStar's own API (`/api/cinema/<apiId>/show/`). */
  apiId: number;
  /** Vista's cinema number, used by web-ticketing; not the API id. */
  cinemaNumber: number;
  /** Path of the cinema's page on cinestar.de, also the prefix of its film links. */
  sitePath: string;
  source_slug: string;
  name: string;
}

const REMSCHEID: CinestarCinema = {
  apiId: 55,
  cinemaNumber: 70000,
  sitePath: "kino-remscheid",
  source_slug: "cinestar-remscheid",
  name: "CineStar Remscheid",
};

/** Closed after a fire on 7/8 Oct 2026; CineStar expects to reopen end of Jan 2027 at the earliest.
 *  Until then the API lists only the few already-scheduled 2027 broadcasts. */
const METROPOLIS: CinestarCinema = {
  apiId: 20,
  cinemaNumber: 43377,
  sitePath: "kino-frankfurt-main-metropolis",
  source_slug: "cinestar-metropolis",
  name: "CineStar Metropolis Frankfurt",
};

interface CinestarShowtime {
  id: number;
  /** "2026-09-26 16:45 CEST" — local time with a zone suffix. */
  datetime: string;
  systemId: string;
  attributes: string[];
}

interface CinestarMovie {
  id: number;
  title: string;
  detailLink: string | null;
  poster: string | null;
  showtimes: CinestarShowtime[];
}

async function scrapeCinestar(cinema: CinestarCinema): Promise<VenueScrapeResult> {
  const res = await fetch(`${API_BASE}/${cinema.apiId}/show/`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${cinema.source_slug} fetch failed: ${res.status}`);
  const movies = (await res.json()) as CinestarMovie[];
  const ticketUrl = `${TICKET_BASE}?cinemaId=${cinema.cinemaNumber}&movieSessionId=`;

  const events: CanonicalScrapedEvent[] = [];
  for (const movie of movies) {
    for (const show of movie.showtimes) {
      if (!show.attributes.some((a) => KEEP_ATTRIBUTES.has(a))) continue;
      const [date, time] = show.datetime.split(" ");
      if (!date || !time) continue;
      const attrs = new Set(show.attributes);
      const version = attrs.has("OMU") ? "OmU" : attrs.has("OV") ? "OV" : null;
      // Vista tags the audio track; with several (`LANG_ALL`) or German
      // audio there is no single original language to report.
      const langs = show.attributes.filter((a) => a.startsWith("LANG_") && a !== "LANG_ALL");
      const language = version && langs.length === 1 ? langs[0].slice(5).toLowerCase() : null;

      events.push({
        source_event_id: String(show.id),
        title: movie.title.trim(),
        subtitle: version,
        date,
        time,
        detail_url: movie.detailLink ? `${SITE}${movie.detailLink}` : `${SITE}/${cinema.sitePath}`,
        ticket_url: `${ticketUrl}${show.systemId}`,
        image_url: movie.poster,
        language: language === "de" ? null : language,
        labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
      });
    }
  }
  return { source_slug: cinema.source_slug, display_name: cinema.name, events };
}

export const scrapeCinestarRemscheid = () => scrapeCinestar(REMSCHEID);
export const scrapeCinestarMetropolis = () => scrapeCinestar(METROPOLIS);
