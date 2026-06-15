import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Theater für Kinder is hosted at Allee Theater and sells tickets via Reservix.
 */
export async function scrapeTheaterFuerKinder(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "theater-fuer-kinder",
    displayName: "Theater für Kinder",
    host: "theater-fuer-kinder.reservix.de",
    defaultVenueRoom: null,
    defaultLabel: "stage:theater",
  });
}
