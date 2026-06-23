import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Karlstorbahnhof Heidelberg — socio-cultural centre at Marlene-Dietrich-Platz 3
 * (Südstadt). Programme spans theatre, concerts and lectures; sold via the
 * branded Reservix subdomain `karlstorbahnhof.reservix.de`.
 */
export async function scrapeKarlstorbahnhof(): Promise<VenueScrapeResult> {
  const result = await scrapeReservixVenue({
    sourceSlug: "karlstorbahnhof",
    displayName: "Karlstorbahnhof Heidelberg",
    host: "karlstorbahnhof.reservix.de",
    defaultLabel: "stage:theater",
  });

  return {
    ...result,
    events: result.events.map((e) => ({
      ...e,
      city: "heidelberg",
      lat: 49.3958,
      lon: 8.6918,
    })),
  };
}
