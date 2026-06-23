import type { VenueScrapeResult } from "../types";
import { scrapeZtixVenue } from "./_ztix";

/**
 * Centralstation Darmstadt — major concert + event hall in a renovated
 * historic power station (Im Carree). Sells through ztix; its WordPress site
 * embeds `ztix.de/centralstation/events/<slug>` booking links on the home and
 * programme pages, which the shared ztix adapter turns into dated events.
 */
const LISTING_URLS = [
  "https://www.centralstation-darmstadt.de/",
  "https://www.centralstation-darmstadt.de/programm/specials/lesungen-und-literatur-in-der-centralstation/",
  "https://www.centralstation-darmstadt.de/programm/specials/kinderprogramm/",
];

export function scrapeCentralstationDarmstadt(): Promise<VenueScrapeResult> {
  return scrapeZtixVenue({
    org: "centralstation",
    listingUrls: LISTING_URLS,
    source_slug: "centralstation-darmstadt",
    display_name: "Centralstation Darmstadt",
    city: "darmstadt",
    lat: 49.8728,
    lon: 8.6519,
    defaultLabel: "music:classical",
  });
}
