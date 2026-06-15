import type { VenueScrapeResult } from "../types";
import { scrapeComfortTicketVenue } from "./_comfortticket";

/**
 * LichtwarkTheater sells tickets via staeitsch-shop.comfortticket.de.
 */
export async function scrapeLichtwarkTheater(): Promise<VenueScrapeResult> {
  return scrapeComfortTicketVenue({
    sourceSlug: "lichtwark-theater",
    displayName: "LichtwarkTheater",
    host: "staeitsch-shop.comfortticket.de",
    venueFilter: "LichtwarkTheater",
    defaultLabel: "stage:theater",
  });
}
