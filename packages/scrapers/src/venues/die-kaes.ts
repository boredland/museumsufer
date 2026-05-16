import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Die Käs ships its programme via Reservix at `diekaes.reservix.de`.
 * Their main WordPress site has no inline event listing; the /abfrage/
 * page links visitors to the Reservix subdomain.
 */
export async function scrapeDieKaes(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "die-kaes",
    host: "diekaes.reservix.de",
  });
}
