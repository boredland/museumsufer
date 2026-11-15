import {
  cityHost,
  renderDayMarkdown as coreRenderDay,
  renderVenueMarkdown as coreRenderVenue,
  dateLocale,
  wantsMarkdown,
} from "@museumsufer/core";
import type { VenueConfig } from "./concert-config";
import type { DayEvent } from "./db";
import { cityContentLocale } from "./i18n";

export { wantsMarkdown };

const APEX = "konzert.haus";

// Markdown has no UI-locale switch, so copy follows the city's country.
const COPY = {
  de: {
    dayEmpty: "Heute keine Konzerte gemeldet.",
    venueEmpty: "Noch kein angekündigtes Programm.",
    one: "Konzert",
    many: "Konzerte",
  },
  es: {
    dayEmpty: "Hoy no hay conciertos anunciados.",
    venueEmpty: "Todavía no hay programa anunciado.",
    one: "concierto",
    many: "conciertos",
  },
} as const;

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

export function renderDayMarkdown(date: string, events: DayEvent[], city: string): string {
  const locale = cityContentLocale(city);
  const copy = locale === "es" ? COPY.es : COPY.de;
  const host = cityHost(APEX, city);
  return coreRenderDay({
    date,
    events: events.map(toMarkdownEvent),
    brand: "konzert.haus",
    localeTag: dateLocale(locale),
    emptyCopy: copy.dayEmpty,
    nounSingular: copy.one,
    nounPlural: copy.many,
    apiUrl: `https://${host}/api/events?date=${date}`,
    utmSource: host,
  });
}

export function renderVenueMarkdown(venue: VenueConfig, events: DayEvent[]): string {
  const locale = cityContentLocale(venue.city);
  const host = cityHost(APEX, venue.city);
  return coreRenderVenue({
    events: events.map(toMarkdownEvent),
    venueName: venue.name,
    venueAddress: venue.address ?? null,
    venueWebsite: venue.website_url ?? null,
    localeTag: dateLocale(locale),
    emptyCopy: (locale === "es" ? COPY.es : COPY.de).venueEmpty,
    apiUrl: `https://${host}/api/events?venue=${venue.slug}`,
    utmSource: host,
  });
}
