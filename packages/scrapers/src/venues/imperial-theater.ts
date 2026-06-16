import type { VenueScrapeResult } from "../types";
import { scrapeComfortTicketVenue } from "./_comfortticket";

/**
 * Imperial Theater (Hamburgs Krimi-Theater) stages crime thrillers and
 * detective plays exclusively at St. Pauli. They migrated from Reservix
 * to their own ComfortTicket shop at imperialtheater-webshop.comfortticket.de.
 */
export async function scrapeImperialTheater(): Promise<VenueScrapeResult> {
  return scrapeComfortTicketVenue({
    sourceSlug: "imperial-theater",
    displayName: "Imperial Theater",
    host: "imperialtheater-webshop.comfortticket.de",
    defaultLabel: "stage:theater",
  });
}
