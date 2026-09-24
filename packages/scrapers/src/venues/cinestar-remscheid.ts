import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * CineStar Remscheid — the city's only cinema. The CineStar site's own JSON
 * API (`/api/cinema/<id>/show/`) returns every film with its showtimes, each
 * tagged with Vista attributes: language (`OV`, `OMU`, `LANG_xx`) and event
 * type (`ET_SONDERVORSTELLUNG`, `ET_EVENT`, `ET_PREVIEW`, `ET_SNEAK`).
 *
 * The regular programme is mainstream first-run, which the cinema app
 * doesn't carry; we keep original-language and special screenings (Met
 * opera and ballet broadcasts, concert films, OmU releases, film clubs).
 */
const API_URL = "https://www.cinestar.de/api/cinema/55/show/";
const SITE = "https://www.cinestar.de";
/** Vista web-ticketing; `cinemaId` is the cinema's number, not its API id. */
const TICKET_URL = "https://webticketing3.cinestar.de/?cinemaId=70000&movieSessionId=";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const KEEP_ATTRIBUTES = new Set(["OV", "OMU", "ET_SONDERVORSTELLUNG", "ET_EVENT", "ET_PREVIEW", "ET_SNEAK"]);

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

export async function scrapeCinestarRemscheid(): Promise<VenueScrapeResult> {
  const res = await fetch(API_URL, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`cinestar-remscheid fetch failed: ${res.status}`);
  const movies = (await res.json()) as CinestarMovie[];

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
        detail_url: movie.detailLink ? `${SITE}${movie.detailLink}` : `${SITE}/kino-remscheid`,
        ticket_url: `${TICKET_URL}${show.systemId}`,
        image_url: movie.poster,
        language: language === "de" ? null : language,
        labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
      });
    }
  }
  return { source_slug: "cinestar-remscheid", display_name: "CineStar Remscheid", events };
}
