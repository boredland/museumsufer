import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Hamburger Puppentheater in Winterhude sells tickets via Reservix. The shop
 * moved from `hamburger-puppentheater.` to `hamburgerpuppentheater.reservix.de`
 * for the 2026/27 season; the old host now redirects to reservix.de's home.
 */
export async function scrapeHamburgerPuppentheater(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "hamburger-puppentheater",
    displayName: "Hamburger Puppentheater",
    host: "hamburgerpuppentheater.reservix.de",
    defaultVenueRoom: null,
    defaultLabel: "stage:theater",
  });
}
