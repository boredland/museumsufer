import type { ScrapeResult } from "../types";
import { scrapeReservixHost } from "./reservix";

/**
 * Die Schmiere is built on Duda — the Wordpress-shaped events listings
 * are a JS widget that doesn't render in static HTML, but the Reservix
 * subdomain `die-schmiere.reservix.de` carries every dated performance
 * with the same shape Mousonturm and Tigerpalast use.
 */
export async function scrapeSchmiere(): Promise<ScrapeResult> {
  return scrapeReservixHost({
    theaterSlug: "die-schmiere",
    host: "die-schmiere.reservix.de",
  });
}
