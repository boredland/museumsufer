import type { VenueScrapeResult } from "../types";
import { scrapeComfortTicketVenue } from "./_comfortticket";

/**
 * Ernst Deutsch Theater uses ComfortTicket at their own webshop endpoint.
 */
export async function scrapeErnstDeutschTheater(): Promise<VenueScrapeResult> {
  return scrapeComfortTicketVenue({
    sourceSlug: "ernst-deutsch-theater",
    displayName: "Ernst Deutsch Theater",
    host: "ernst-deutsch-theater-webshop.tkt-datacenter.net",
    venueFilter: null,
    defaultLabel: "stage:theater",
  });
}
