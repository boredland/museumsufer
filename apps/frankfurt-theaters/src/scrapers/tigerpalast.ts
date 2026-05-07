import type { ScrapeResult } from "../types";
import { scrapeReservixHost } from "./reservix";

/**
 * Tigerpalast Varieté ships its programme via Reservix at
 * `tigerpalast-variete.reservix.de`. Their main site is a Wordpress
 * marketing site without a structured listing. The Reservix subdomain
 * has every dated performance with title, time, venue, image, and a
 * minimum price.
 */
export async function scrapeTigerpalast(): Promise<ScrapeResult> {
  return scrapeReservixHost({
    theaterSlug: "tigerpalast-variete",
    host: "tigerpalast-variete.reservix.de",
  });
}
