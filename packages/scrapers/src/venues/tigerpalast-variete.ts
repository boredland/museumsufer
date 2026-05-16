import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Tigerpalast Varieté ships its programme via Reservix at
 * `tigerpalast-variete.reservix.de`. Their main site is a WordPress
 * marketing site without a structured listing. The Reservix subdomain
 * has every dated performance with title, time, venue, image, and a
 * minimum price.
 */
export async function scrapeTigerpalastVariete(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "tigerpalast-variete",
    host: "tigerpalast-variete.reservix.de",
  });
}
