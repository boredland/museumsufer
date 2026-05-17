import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Die Schmiere is built on Duda — the events listing is a JS widget that
 * doesn't render in static HTML, but the Reservix subdomain
 * `die-schmiere.reservix.de` carries every dated performance with the same
 * shape Mousonturm and Tigerpalast use.
 */
export async function scrapeDieSchmiere(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "die-schmiere",
    displayName: "Die Schmiere",
    host: "die-schmiere.reservix.de",
  });
}
