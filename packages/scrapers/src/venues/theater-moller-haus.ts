import type { VenueScrapeResult } from "../types";
import { scrapeZtixVenue } from "./_ztix";

/**
 * Theater Moller Haus — independent theatre in Darmstadt's "Freie Szene".
 * Its WordPress site embeds ztix booking links under the shared organizer
 * "freie-szene-da". The home page and the Spielplan page together cover the
 * current programme; every linked event is held at Theater Moller Haus
 * (Sandstr. 10, Darmstadt).
 */
const LISTING_URLS = ["https://theatermollerhaus.de/", "https://theatermollerhaus.de/spielplan-tickets/spielplan/"];

export function scrapeTheaterMollerHaus(): Promise<VenueScrapeResult> {
  return scrapeZtixVenue({
    org: "freie-szene-da",
    listingUrls: LISTING_URLS,
    source_slug: "theater-moller-haus",
    display_name: "Theater Moller Haus",
    city: "darmstadt",
    lat: 49.873,
    lon: 8.647,
    defaultLabel: "stage:theater",
  });
}
