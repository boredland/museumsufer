import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Velvets Theater Wiesbaden — black light, puppet, pantomime, family, revue.
 *
 * The venue's own /programm/ page sits behind Cloudflare, which 403s both
 * datacenter egress (so CI never saw it) and any browser-like User-Agent (so
 * routing through fetch-proxy, which rewrites the UA to Chrome, 403s too).
 * Velvets sells every performance through Reservix, so we read the listing
 * there instead: same dated performances, plus ticket URLs and prices the
 * Jimdo page never carried.
 */
export async function scrapeVelvetsTheater(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "velvets-theater",
    displayName: "Velvets Theater",
    host: "velvets.reservix.de",
    defaultLabel: "stage:theater",
  });
}
