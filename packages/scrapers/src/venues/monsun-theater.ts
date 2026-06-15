import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Monsun Theater ships its programme via Reservix at `monsun.reservix.de`.
 */
export async function scrapeMonsunTheater(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "monsun-theater",
    displayName: "Monsun Theater",
    host: "monsuntheater.reservix.de",
    defaultLabel: "stage:theater",
  });
}
