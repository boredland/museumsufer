import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Literaturhaus Hamburg uses Reservix for their ticketing.
 * We can pull their full calendar from `literaturhaus-hamburg.reservix.de`.
 */
export async function scrapeLiteraturhausHamburg(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "literaturhaus-hamburg",
    displayName: "Literaturhaus Hamburg",
    host: "literaturhaus-hamburg.reservix.de",
    defaultLabel: "talk:reading", // Most events at Literaturhaus are readings/talks
  });
}
