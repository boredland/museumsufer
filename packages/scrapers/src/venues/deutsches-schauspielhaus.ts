import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Deutsches Schauspielhaus Hamburg now exposes its ticketed programme via
 * Reservix; the older schauspielhaus.de HTML parser audited in issue #79 was
 * keyed to stale site markup and under-delivered to zero events.
 */
export async function scrapeDeutschesSchauspielhaus(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "deutsches-schauspielhaus",
    displayName: "Deutsches Schauspielhaus",
    host: "deutsches-schauspielhaus-hamburg.reservix.de",
    defaultLabel: "stage:theater",
  });
}
