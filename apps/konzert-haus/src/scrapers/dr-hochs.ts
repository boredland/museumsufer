import type { ScrapeResult } from "../types";

export async function scrapeDrHochs(): Promise<ScrapeResult> {
  return { venue_slug: "dr-hochs-konservatorium", events: [] };
}
