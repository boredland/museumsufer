import type { VenueScrapeResult } from "../types";
import { scrapeComfortTicketVenue } from "./_comfortticket";

/**
 * The English Theatre of Hamburg has its own ComfortTicket webshop
 * at englishtheatre-shop.comfortticket.de.
 */
export async function scrapeEnglishTheatreHamburg(): Promise<VenueScrapeResult> {
  return scrapeComfortTicketVenue({
    sourceSlug: "english-theatre-hamburg",
    displayName: "English Theatre of Hamburg",
    host: "englishtheatre-shop.comfortticket.de",
    defaultLabel: "stage:theater",
  });
}
