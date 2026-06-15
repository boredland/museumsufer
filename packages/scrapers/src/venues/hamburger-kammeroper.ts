import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Hamburger Kammeroper is hosted at Allee Theater and sells tickets via Reservix.
 */
export async function scrapeHamburgerKammeroper(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "hamburger-kammeroper",
    displayName: "Hamburger Kammeroper",
    host: "hamburger-kammeroper.reservix.de",
    defaultVenueRoom: null,
    defaultLabel: "stage:opera",
  });
}
