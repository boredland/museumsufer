import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Die 2te Heimat — Theatersalon im Phoenixhof (Bahrenfeld). Dinner-theatre,
 * boulevard and musical-comedy evenings; tickets run through their own
 * Reservix shop at 2teheimat.reservix.de.
 */
export async function scrapeDie2teHeimat(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "die-2te-heimat",
    displayName: "Die 2te Heimat",
    host: "2teheimat.reservix.de",
    defaultLabel: "stage:theater",
  });
}
