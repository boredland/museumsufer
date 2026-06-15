import type { VenueScrapeResult } from "../types";
import { scrapeComfortTicketVenue } from "./_comfortticket";

/**
 * Altonaer Theater is a part of the Stäitsch group and sells tickets
 * via staeitsch-shop.comfortticket.de under its own location name.
 */
export async function scrapeAltonaerTheater(): Promise<VenueScrapeResult> {
  return scrapeComfortTicketVenue({
    sourceSlug: "altonaer-theater",
    displayName: "Altonaer Theater",
    host: "staeitsch-shop.comfortticket.de",
    venueFilter: "Altonaer Theater",
    defaultLabel: "stage:theater",
  });
}
