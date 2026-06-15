import type { VenueScrapeResult } from "../types";
import { scrapeComfortTicketVenue } from "./_comfortticket";

/**
 * Harburger Theater is a part of the Stäitsch group and sells tickets
 * via staeitsch-shop.comfortticket.de under its own location name.
 */
export async function scrapeHarburgerTheater(): Promise<VenueScrapeResult> {
  return scrapeComfortTicketVenue({
    sourceSlug: "harburger-theater",
    displayName: "Harburger Theater",
    host: "staeitsch-shop.comfortticket.de",
    venueFilter: "Harburger Theater",
    defaultLabel: "stage:theater",
  });
}
