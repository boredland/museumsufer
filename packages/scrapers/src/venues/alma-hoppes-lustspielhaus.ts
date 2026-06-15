import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Alma Hoppes Lustspielhaus — long-standing political cabaret and satire stage
 * in Hamburg-Eppendorf (~280 seats). Their ticket shop is powered by Reservix
 * at `almahoppe.reservix.de`.
 */
export async function scrapeAlmaHoppesLustspielhaus(): Promise<VenueScrapeResult> {
  return scrapeReservixVenue({
    sourceSlug: "alma-hoppes-lustspielhaus",
    displayName: "Alma Hoppes Lustspielhaus",
    host: "almahoppe.reservix.de",
    defaultLabel: "stage:theater",
  });
}
