import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Lutherkirche Wiesbaden — major church in Wiesbaden hosting the Orgelsommer
 * and other sacred music. Tickets are sold via a dedicated Reservix subdomain.
 */
export async function scrapeLutherkircheWiesbaden(): Promise<VenueScrapeResult> {
  const result = await scrapeReservixVenue({
    sourceSlug: "lutherkirche-wiesbaden",
    displayName: "Lutherkirche Wiesbaden",
    host: "lutherkirche-wiesbaden.reservix.de",
    defaultVenueRoom: "Lutherkirche",
    defaultLabel: "music:classical",
  });

  return {
    ...result,
    events: result.events.map((e) => {
      const isOrgan = e.title.toLowerCase().includes("orgel");
      const isSacred =
        e.title.toLowerCase().includes("messe") ||
        e.title.toLowerCase().includes("motette") ||
        e.title.toLowerCase().includes("kirchenmusik");
      const labels = [...e.labels];
      if (isOrgan) labels.push({ label: "music:organ", confidence: 0.8, classifier: "scraper-hardcoded" });
      if (isSacred) labels.push({ label: "music:sacred", confidence: 0.8, classifier: "scraper-hardcoded" });
      return { ...e, labels };
    }),
  };
}
