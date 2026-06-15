import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * First Stage Theater in Altona sells tickets via Reservix.
 */
export async function scrapeFirstStageTheater(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "first-stage-theater",
    displayName: "First Stage Theater",
    host: "firststage.reservix.de",
    defaultVenueRoom: null,
    defaultLabel: "stage:musical",
  });
}
