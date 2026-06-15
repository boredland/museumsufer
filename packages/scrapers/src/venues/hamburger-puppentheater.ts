import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Hamburger Puppentheater in Winterhude sells tickets via Reservix.
 */
export async function scrapeHamburgerPuppentheater(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "hamburger-puppentheater",
    displayName: "Hamburger Puppentheater",
    host: "hamburger-puppentheater.reservix.de",
    defaultVenueRoom: null,
    defaultLabel: "stage:theater",
  });
}
