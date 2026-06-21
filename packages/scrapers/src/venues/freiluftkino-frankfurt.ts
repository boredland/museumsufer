import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Freiluftkino Frankfurt — the summer open-air cinema (films in their original
 * version). Its Jimdo site is an image gallery, but it sells through cinetixx,
 * whose frontend proxy API exposes the full programme as JSON:
 *   GET /api/cinemas/events/cinema/<cinemaId>
 * returns one entry per film with a `shows` array of screenings (each carrying
 * `displayDateTime`, a booking URL, language, image and description).
 */
const CINEMA_ID = 2087180112;
const PROGRAM_URL = `https://booking.cinetixx.de/api/cinemas/events/cinema/${CINEMA_ID}`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

interface CinetixxShow {
  id: number;
  displayDateTime?: string;
  _UrlBooking?: string;
}
interface CinetixxEvent {
  title?: string;
  language?: string;
  shortDescription?: string;
  imageUrlArtworkBig?: string;
  imageUrlArtwork?: string;
  shows?: CinetixxShow[];
}

export async function scrapeFreiluftkinoFrankfurt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(PROGRAM_URL, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`freiluftkino-frankfurt fetch failed: ${res.status}`);
  const films = (await res.json()) as CinetixxEvent[];

  const events: CanonicalScrapedEvent[] = [];
  for (const film of films) {
    const title = film.title ? stripHtml(decodeEntities(film.title)).replace(/\s+/g, " ").trim() : "";
    if (!title) continue;
    const image = film.imageUrlArtworkBig || film.imageUrlArtwork || null;
    const description = film.shortDescription ? stripHtml(decodeEntities(film.shortDescription)).trim() || null : null;

    for (const show of film.shows ?? []) {
      if (!show.displayDateTime) continue;
      const date = show.displayDateTime.slice(0, 10);
      if (date < today) continue;
      const time = show.displayDateTime.length >= 16 ? show.displayDateTime.slice(11, 16) : null;
      const url = show._UrlBooking ?? PROGRAM_URL;

      events.push({
        source_event_id: String(show.id),
        title,
        description,
        date,
        time,
        detail_url: url,
        ticket_url: url,
        image_url: image,
        labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
      });
    }
  }

  return { source_slug: "freiluftkino-frankfurt", display_name: "Freiluftkino Frankfurt", events };
}
