import { renderDayMarkdown as coreRenderDay, wantsMarkdown } from "@museumsufer/core";
import type { Event } from "./types";

export { wantsMarkdown };

const UTM_SOURCE = "landau.today";
const LOCALE_TAG = "de-DE";

function toMarkdownEvent(e: Event) {
  return {
    date: e.date,
    time: e.time ?? null,
    title: e.title,
    subtitle: null,
    venueLabel: e.venue ?? undefined,
    venueRoom: null,
    priceMin: null,
    priceMax: null,
    ticketUrl: null,
    detailUrl: e.detail_url ?? null,
    statusSuffix: e.price ? ` · ${e.price}` : null,
  };
}

export function renderDayMarkdown(date: string, events: Event[]): string {
  return coreRenderDay({
    date,
    events: events.map(toMarkdownEvent),
    brand: "landau.today",
    localeTag: LOCALE_TAG,
    emptyCopy: "Heute keine Veranstaltungen gemeldet.",
    nounSingular: "Veranstaltung",
    nounPlural: "Veranstaltungen",
    apiUrl: `https://${UTM_SOURCE}/api/day?date=${date}`,
    utmSource: UTM_SOURCE,
  });
}
