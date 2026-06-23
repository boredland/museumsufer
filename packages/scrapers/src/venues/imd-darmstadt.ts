import type { VenueScrapeResult } from "../types";
import { scrapeZtixVenue } from "./_ztix";

/**
 * Internationales Musikinstitut Darmstadt (IMD) / Darmstädter Ferienkurse.
 * The Ferienkurse are biennial; between editions no ticketed events are
 * published on ztix. The festival programme pages are the venue-owned,
 * server-rendered pages that will embed ztix booking links once the next
 * edition goes on sale. The organizer slug is inferred as "imd" from the
 * ztix naming convention used by the other Darmstadt venues.
 */
const LISTING_URLS = [
  "https://internationales-musikinstitut.de/de/ferienkurse/festival/programm/",
  "https://internationales-musikinstitut.de/en/ferienkurse/festival/programm/",
];

export function scrapeImdDarmstadt(): Promise<VenueScrapeResult> {
  return scrapeZtixVenue({
    org: "imd",
    listingUrls: LISTING_URLS,
    source_slug: "imd-darmstadt",
    display_name: "Internationales Musikinstitut Darmstadt",
    city: "darmstadt",
    lat: 49.8667,
    lon: 8.65,
    defaultLabel: "music:experimental",
  });
}
