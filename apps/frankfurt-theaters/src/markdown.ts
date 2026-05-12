import {
  renderDayMarkdown as coreRenderDay,
  renderVenueMarkdown as coreRenderVenue,
  type MarkdownEvent,
  wantsMarkdown,
} from "@museumsufer/core";
import type { DayPerformance } from "./db";
import type { TheaterConfig } from "./theater-config";

export { wantsMarkdown };

const UTM_SOURCE = "frankfurt.ins.theater";
const LOCALE_TAG = "de-DE";

function toMarkdownEvent(p: DayPerformance): MarkdownEvent {
  const sameVenue = !!p.venue_room && p.venue_room.trim().toLowerCase() === p.theater.name.trim().toLowerCase();
  const subtitle = p.show.subtitle?.replace(/<br\s*\/?>/gi, " · ");
  const cancelled = p.status === "cancelled" || p.status === "sold_out";
  return {
    date: p.date,
    time: p.time ?? null,
    title: p.show.title,
    subtitle: subtitle ?? null,
    venueLabel: p.theater.name,
    venueRoom: sameVenue ? null : (p.venue_room ?? null),
    // Cancelled / sold-out shows still surface the title + suffix; drop the price.
    priceMin: cancelled ? null : (p.price_min ?? null),
    priceMax: cancelled ? null : (p.price_max ?? null),
    ticketUrl: p.ticket_url ?? null,
    detailUrl: p.show.detail_url ?? null,
    statusSuffix: p.status === "sold_out" ? " **(Ausverkauft)**" : p.status === "cancelled" ? " **(Entfällt)**" : null,
  };
}

export function renderDayMarkdown(date: string, performances: DayPerformance[]): string {
  return coreRenderDay({
    date,
    events: performances.map(toMarkdownEvent),
    brand: "Frankfurt Theater",
    localeTag: LOCALE_TAG,
    emptyCopy: "Heute kein Programm.",
    nounSingular: "Vorstellung",
    nounPlural: "Vorstellungen",
    apiUrl: `https://${UTM_SOURCE}/api/day?date=${date}`,
    utmSource: UTM_SOURCE,
  });
}

export function renderTheaterMarkdown(config: TheaterConfig, performances: DayPerformance[]): string {
  return coreRenderVenue({
    events: performances.map(toMarkdownEvent),
    venueName: config.name,
    venueAddress: config.address ?? null,
    venueWebsite: config.website_url ?? null,
    localeTag: LOCALE_TAG,
    emptyCopy: "Noch kein angekündigtes Programm.",
    apiUrl: `https://${UTM_SOURCE}/api/theater/${config.slug}`,
    utmSource: UTM_SOURCE,
  });
}
