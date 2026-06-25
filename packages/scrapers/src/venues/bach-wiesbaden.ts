import type { VenueScrapeResult } from "../types";
import { scrapeReservixVenue } from "./_reservix";

/**
 * Wiesbadener Bachwochen — annual church music festival in Wiesbaden.
 * Tickets are sold via a dedicated Reservix subdomain.
 */
export async function scrapeBachWiesbaden(): Promise<VenueScrapeResult> {
  const result = await scrapeReservixVenue({
    sourceSlug: "bach-wiesbaden",
    displayName: "Wiesbadener Bachwochen",
    host: "bach-wiesbaden.reservix.de",
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
