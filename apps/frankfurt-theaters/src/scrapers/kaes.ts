import type { ScrapeResult } from "../types";
import { scrapeReservixHost } from "./reservix";

/**
 * Die Käs ships its programme via Reservix at `diekaes.reservix.de`.
 * Their main WordPress site has no inline event listing; the /abfrage/
 * page links visitors to the Reservix subdomain, which exposes every
 * dated performance with title, time, image, and minimum price.
 */
export async function scrapeKaes(): Promise<ScrapeResult> {
  return scrapeReservixHost({
    theaterSlug: "die-kaes",
    host: "diekaes.reservix.de",
  });
}
