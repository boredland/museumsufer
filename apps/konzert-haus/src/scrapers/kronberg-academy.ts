import type { ScrapeResult } from "../types";

export async function scrapeKronbergAcademy(): Promise<ScrapeResult> {
  return { venue_slug: "kronberg-academy", events: [] };
}
