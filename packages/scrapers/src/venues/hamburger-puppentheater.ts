import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Hamburger Puppentheater is a puppetry and figure theater venue
 * and sells tickets via Reservix at hamburgerpuppentheater.reservix.de.
 */
export async function scrapeHamburgerPuppentheater(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "hamburger-puppentheater",
    displayName: "Hamburger Puppentheater",
    host: "hamburgerpuppentheater.reservix.de",
    defaultLabel: "stage:theater",
  });
}
