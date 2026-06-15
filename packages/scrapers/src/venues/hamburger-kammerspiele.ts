import type { VenueScrapeResult } from "../types";
import { scrapeComfortTicketVenue } from "./_comfortticket";

/**
 * Hamburger Kammerspiele is a part of the Stäitsch group and sells tickets
 * via staeitsch-shop.comfortticket.de under its own location name.
 */
export async function scrapeHamburgerKammerspiele(): Promise<VenueScrapeResult> {
  return scrapeComfortTicketVenue({
    sourceSlug: "hamburger-kammerspiele",
    displayName: "Hamburger Kammerspiele",
    host: "staeitsch-shop.comfortticket.de",
    venueFilter: "Hamburger Kammerspiele",
    defaultLabel: "stage:theater",
  });
}
