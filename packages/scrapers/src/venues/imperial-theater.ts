import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Imperial Theater (Hamburgs Krimi-Theater) stages crime thrillers and
 * detective plays exclusively at St. Pauli. Their ticket shop is powered
 * by Reservix at `imperial-theater.reservix.de`.
 */
export async function scrapeImperialTheater(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "imperial-theater",
    displayName: "Imperial Theater",
    host: "imperial-theater.reservix.de",
    defaultLabel: "stage:theater",
  });
}
