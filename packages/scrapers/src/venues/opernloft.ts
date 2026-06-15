import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Opernloft stages condensed, modern opera productions and sells tickets
 * via Reservix at opernloft.reservix.de.
 */
export async function scrapeOpernloft(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "opernloft",
    displayName: "Opernloft",
    host: "opernloft.reservix.de",
    defaultLabel: "stage:opera",
  });
}
