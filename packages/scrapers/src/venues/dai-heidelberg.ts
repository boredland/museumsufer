import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Deutsch-Amerikanisches Institut (DAI) Heidelberg — lecture and discussion
 * programme at Sofienstraße 12. Tickets are handled by Reservix on the branded
 * subdomain `dai-heidelberg.reservix.de`.
 */
export async function scrapeDaiHeidelberg(): Promise<VenueScrapeResult> {
  const result = await scrapeReservixVenue({
    sourceSlug: "dai-heidelberg",
    displayName: "DAI Heidelberg",
    host: "dai-heidelberg.reservix.de",
    defaultLabel: "talk:vortrag",
  });

  return {
    ...result,
    events: result.events.map((e) => ({
      ...e,
      city: "heidelberg",
      lat: 49.409,
      lon: 8.689,
    })),
  };
}
