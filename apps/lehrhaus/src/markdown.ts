import {
  renderDayMarkdown as coreRenderDay,
  renderVenueMarkdown as coreRenderVenue,
  wantsMarkdown,
} from "@museumsufer/core";
import type { DayEvent } from "./db";
import type { LehrhausSource } from "./types";

export { wantsMarkdown };

const UTM_SOURCE = "frankfurt.lehrhaus.app";
const LOCALE_TAG = "de-DE";

function toMarkdownEvent(e: DayEvent) {
  return {
    date: e.date,
    time: e.time ?? null,
    title: e.title,
    subtitle: e.description ?? null,
    venueLabel: e.source.name,
    venueRoom: null,
    priceMin: null,
    priceMax: null,
    ticketUrl: e.ticket_url ?? null,
    detailUrl: e.detail_url ?? null,
    statusSuffix: ` _[${e.category}]_`,
  };
}

export function renderDayMarkdown(date: string, events: DayEvent[]): string {
  return coreRenderDay({
    date,
    events: events.map(toMarkdownEvent),
    brand: "lehrhaus",
    localeTag: LOCALE_TAG,
    emptyCopy: "Heute kein Eintrag gemeldet.",
    nounSingular: "Vortrag",
    nounPlural: "Vorträge & Diskussionen",
    apiUrl: `https://${UTM_SOURCE}/api/events?date=${date}`,
    utmSource: UTM_SOURCE,
  });
}

export function renderSourceMarkdown(source: LehrhausSource, events: DayEvent[]): string {
  return coreRenderVenue({
    events: events.map(toMarkdownEvent),
    venueName: source.name,
    venueAddress: null,
    venueWebsite: source.url ?? null,
    localeTag: LOCALE_TAG,
    emptyCopy: "Noch kein angekündigtes Programm.",
    apiUrl: `https://${UTM_SOURCE}/api/events?source=${source.slug}`,
    utmSource: UTM_SOURCE,
  });
}
