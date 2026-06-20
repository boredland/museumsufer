import type { ScrapedLabel } from "../types";

/**
 * Hamburg's Hauptkirche calendars list everything in one feed — concerts
 * alongside services, devotions, guided tours and pilgrim meet-ups. Hardcoding
 * `music:sacred` on every row floods konzert.haus with non-concerts ("Mittags-
 * andacht", "Evangelische Messe", "Orgelführung", even an "Evakuierungsübung").
 *
 * This classifier keeps only genuine concerts/recitals. The order matters:
 * an unambiguous service/tour marker wins even when the title also mentions an
 * instrument (e.g. "Arp-Schnitger-Orgelführung" is a tour, not an organ
 * recital). Titles with no musical signal default to skipped — a curated
 * concerts vertical favours precision over recall on a service-heavy feed.
 */

// Service, devotion, tour and gathering markers — never a concert.
const NON_CONCERT =
  /andacht|messe|gottesdienst|f[üu]hrung|pilger|vamos|schweigend|praytime|mittagspause|[üu]bung|gebet|taufe|kirchenkunst|herrensaal|für die seele|pilgermahl|krippe|passion|evakuierung/i;

// Positive musical signals — organ music, choral music, cantatas, recitals.
const CONCERT =
  /konzert|orgelmusik|orgelpunkt|orgelkonzert|kirchenmusik|kantate|motette|oratorium|\bchor\b|musik|evensong|vesper|stunde der kirchenmusik|back to bach|\bbach\b|recital|abendmusik/i;

/**
 * Returns the labels for a church-calendar entry, or `null` when the entry is
 * not a concert and should be dropped from the scrape.
 */
export function classifyChurchEvent(title: string): ScrapedLabel[] | null {
  if (NON_CONCERT.test(title)) return null;
  if (!CONCERT.test(title)) return null;
  return [{ label: "music:sacred", confidence: 0.9, classifier: "keyword:music" }];
}
