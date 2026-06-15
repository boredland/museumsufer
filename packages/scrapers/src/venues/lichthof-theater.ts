import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * LICHTHOF Theater ships its programme via Reservix at `lichthof-theater.reservix.de`.
 */
export async function scrapeLichthofTheater(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "lichthof-theater",
    displayName: "LICHTHOF Theater",
    host: "lichthof-theater.reservix.de",
    defaultLabel: "stage:theater",
  });
}
