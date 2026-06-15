import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * FUNDUS THEATER ships its programme via Reservix at `fundustheater.reservix.de`.
 */
export async function scrapeFundusTheater(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "fundus-theater",
    displayName: "FUNDUS THEATER",
    host: "fundustheater.reservix.de",
    defaultLabel: "stage:theater",
  });
}
