import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Zimmertheater Heidelberg — intimate chamber theatre on Hauptstraße 118.
 * Sells through Reservix under the branded subdomain
 * `zimmertheaterheidelberg.reservix.de`.
 */
export async function scrapeZimmertheaterHeidelberg(): Promise<VenueScrapeResult> {
  const result = await scrapeReservixVenue({
    sourceSlug: "zimmertheater-heidelberg",
    displayName: "Zimmertheater Heidelberg",
    host: "zimmertheaterheidelberg.reservix.de",
    defaultLabel: "stage:theater",
  });

  return {
    ...result,
    events: result.events.map((e) => ({
      ...e,
      city: "heidelberg",
      lat: 49.4119,
      lon: 8.709,
    })),
  };
}
