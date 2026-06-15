import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Ohnsorg-Theater ships its programme via Reservix at `ohnsorgtheater.reservix.de`.
 */
export async function scrapeOhnsorgTheater(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "ohnsorg-theater",
    displayName: "Ohnsorg-Theater",
    host: "ohnsorgtheater.reservix.de",
    defaultLabel: "stage:theater",
  });
}
