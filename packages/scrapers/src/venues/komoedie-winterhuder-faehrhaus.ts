import type { VenueScrapeResult } from "../types";
import { scrapeComfortTicketVenue } from "./_comfortticket";

/**
 * Komödie Winterhuder Fährhaus has its own dedicated ComfortTicket webshop
 * at shop-komoedie.comfortticket.de.
 */
export async function scrapeKomoedieWinterhuderFaehrhaus(): Promise<VenueScrapeResult> {
  return scrapeComfortTicketVenue({
    sourceSlug: "komoedie-winterhuder-faehrhaus",
    displayName: "Komödie Winterhuder Fährhaus",
    host: "shop-komoedie.comfortticket.de",
    defaultLabel: "stage:theater",
  });
}
