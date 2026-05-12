import {
  renderDayMarkdown as coreRenderDay,
  renderVenueMarkdown as coreRenderVenue,
  wantsMarkdown,
} from "@museumsufer/core";
import type { VenueConfig } from "./concert-config";
import type { DayEvent } from "./db";

export { wantsMarkdown };

const UTM_SOURCE = "frankfurt.konzert.haus";
const LOCALE_TAG = "de-DE";

function toMarkdownEvent(e: DayEvent) {
  return {
    date: e.date,
    time: e.time ?? null,
    title: e.title,
    subtitle: e.subtitle ?? null,
    venueLabel: e.venue.name,
    venueRoom: e.venue_room ?? null,
    priceMin: e.price_min ?? null,
    priceMax: e.price_max ?? null,
    ticketUrl: e.ticket_url ?? null,
    detailUrl: e.detail_url ?? null,
  };
}

export function renderDayMarkdown(date: string, events: DayEvent[]): string {
  return coreRenderDay({
    date,
    events: events.map(toMarkdownEvent),
    brand: "konzert.haus",
    localeTag: LOCALE_TAG,
    emptyCopy: "Heute keine Konzerte gemeldet.",
    nounSingular: "Konzert",
    nounPlural: "Konzerte",
    apiUrl: `https://${UTM_SOURCE}/api/events?date=${date}`,
    utmSource: UTM_SOURCE,
  });
}

export function renderVenueMarkdown(venue: VenueConfig, events: DayEvent[]): string {
  return coreRenderVenue({
    events: events.map(toMarkdownEvent),
    venueName: venue.name,
    venueAddress: venue.address ?? null,
    venueWebsite: venue.website_url ?? null,
    localeTag: LOCALE_TAG,
    emptyCopy: "Noch kein angekündigtes Programm.",
    apiUrl: `https://${UTM_SOURCE}/api/events?venue=${venue.slug}`,
    utmSource: UTM_SOURCE,
  });
}
