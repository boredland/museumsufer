import type { VenueScrapeResult } from "../types";
import { scrapeComfortTicketVenue } from "./_comfortticket";
import { resolveStageLabels } from "./_stage-labels";

// The shop suffixes matinee performances "Deathtrap - Matinee"; the shared music
// probe reads "matinee" as a matinée concert, which mislabels a play.
const MATINEE_SUFFIX_RE = /\s*[-–]\s*mat[ie]n[ée]e\b/i;

/**
 * The English Theatre of Hamburg has its own ComfortTicket webshop
 * at englishtheatre-shop.comfortticket.de.
 */
export async function scrapeEnglishTheatreHamburg(): Promise<VenueScrapeResult> {
  const result = await scrapeComfortTicketVenue({
    sourceSlug: "english-theatre-hamburg",
    displayName: "English Theatre of Hamburg",
    host: "englishtheatre-shop.comfortticket.de",
    defaultLabel: "stage:theater",
  });
  for (const e of result.events) {
    if (!MATINEE_SUFFIX_RE.test(e.title)) continue;
    e.labels = resolveStageLabels({
      title: e.title.replace(MATINEE_SUFFIX_RE, ""),
      subtitle: e.description,
      defaultLabel: "stage:theater",
      confidence: 0.85,
    });
  }
  return result;
}
