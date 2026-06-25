import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

export async function scrapeDrpSaarbruecken(): Promise<VenueScrapeResult> {
  const result = await scrapeReservixVenue({
    sourceSlug: "drp-saarbruecken",
    displayName: "Deutsche Radio Philharmonie",
    host: "drp-orchester.reservix.de",
    defaultLabel: "music:classical",
  });

  return {
    ...result,
    events: result.events.map((e) => ({
      ...e,
      city: "saarbruecken",
      lat: 49.241,
      lon: 7.024,
    })),
  };
}
