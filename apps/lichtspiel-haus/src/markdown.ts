import {
  cityHost,
  renderDayMarkdown as coreRenderDay,
  renderVenueMarkdown as coreRenderVenue,
  dateLocale,
  wantsMarkdown,
} from "@museumsufer/core";
import type { CinemaConfig } from "./cinema-config";
import type { DayScreening } from "./db";
import type { Locale } from "./i18n";

export { wantsMarkdown };

const MARKDOWN_COPY: Record<
  Locale,
  { emptyDay: string; emptyCinema: string; nounSingular: string; nounPlural: string }
> = {
  de: {
    emptyDay: "Heute keine Vorstellungen gemeldet.",
    emptyCinema: "Noch kein angekündigtes Programm.",
    nounSingular: "Vorstellung",
    nounPlural: "Vorstellungen",
  },
  en: {
    emptyDay: "No screenings announced today.",
    emptyCinema: "No programme announced yet.",
    nounSingular: "screening",
    nounPlural: "screenings",
  },
  es: {
    emptyDay: "Hoy no hay sesiones anunciadas.",
    emptyCinema: "Todavía no hay programación anunciada.",
    nounSingular: "sesión",
    nounPlural: "sesiones",
  },
};

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

export function renderDayMarkdown(date: string, screenings: DayScreening[], locale: Locale, city: string): string {
  const host = cityHost("lichtspiel.haus", city);
  const copy = MARKDOWN_COPY[locale];
  return coreRenderDay({
    date,
    events: screenings.map(toMarkdownEvent),
    brand: "lichtspiel.haus",
    localeTag: dateLocale(locale),
    emptyCopy: copy.emptyDay,
    nounSingular: copy.nounSingular,
    nounPlural: copy.nounPlural,
    apiUrl: `https://${host}/api/screenings?date=${date}`,
    utmSource: host,
  });
}

export function renderCinemaMarkdown(
  cinema: CinemaConfig,
  screenings: DayScreening[],
  locale: Locale,
  city: string,
): string {
  const host = cityHost("lichtspiel.haus", city);
  return coreRenderVenue({
    events: screenings.map(toMarkdownEvent),
    venueName: cinema.name,
    venueAddress: cinema.address ?? null,
    venueWebsite: cinema.website_url ?? null,
    localeTag: dateLocale(locale),
    emptyCopy: MARKDOWN_COPY[locale].emptyCinema,
    apiUrl: `https://${host}/api/screenings?cinema=${cinema.slug}`,
    utmSource: host,
  });
}
