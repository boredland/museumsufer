import {
  renderDayMarkdown as coreRenderDay,
  renderVenueMarkdown as coreRenderVenue,
  wantsMarkdown,
} from "@museumsufer/core";
import type { CinemaConfig } from "./cinema-config";
import type { DayScreening } from "./db";

export { wantsMarkdown };

const UTM_SOURCE = "frankfurt.lichtspiel.haus";
const LOCALE_TAG = "de-DE";

function toMarkdownEvent(s: DayScreening) {
  return {
    date: s.date,
    time: s.time ?? null,
    title: s.title,
    subtitle: s.subtitle ?? null,
    venueLabel: s.cinema.name,
    venueRoom: s.venue_room ?? null,
    priceMin: s.price_min ?? null,
    priceMax: s.price_max ?? null,
    ticketUrl: s.ticket_url ?? null,
    detailUrl: s.detail_url ?? null,
  };
}

export function renderDayMarkdown(date: string, screenings: DayScreening[]): string {
  return coreRenderDay({
    date,
    events: screenings.map(toMarkdownEvent),
    brand: "lichtspiel.haus",
    localeTag: LOCALE_TAG,
    emptyCopy: "Heute keine Vorstellungen gemeldet.",
    nounSingular: "Vorstellung",
    nounPlural: "Vorstellungen",
    apiUrl: `https://${UTM_SOURCE}/api/screenings?date=${date}`,
    utmSource: UTM_SOURCE,
  });
}

export function renderCinemaMarkdown(cinema: CinemaConfig, screenings: DayScreening[]): string {
  return coreRenderVenue({
    events: screenings.map(toMarkdownEvent),
    venueName: cinema.name,
    venueAddress: cinema.address ?? null,
    venueWebsite: cinema.website_url ?? null,
    localeTag: LOCALE_TAG,
    emptyCopy: "Noch kein angekündigtes Programm.",
    apiUrl: `https://${UTM_SOURCE}/api/screenings?cinema=${cinema.slug}`,
    utmSource: UTM_SOURCE,
  });
}
