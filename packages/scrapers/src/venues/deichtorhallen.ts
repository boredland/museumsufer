import type { ScraperContext, VenueScrapeResult } from "../types";
import { scrapeGomusMuseum } from "./_gomus-generic";

export async function scrapeDeichtorhallen(ctx: ScraperContext): Promise<VenueScrapeResult[]> {
  return scrapeGomusMuseum(
    {
      slug: "deichtorhallen",
      name: "Deichtorhallen Hamburg",
      apiBase: "https://deichtorhallen.gomus.de/api/v4",
      ticketBase: "https://tickets.deichtorhallen.de/de",
      locationMapping: {
        1: { slug: "deichtorhallen-phoxxi", name: "Deichtorhallen Hamburg / PHOXXI" },
        2: { slug: "deichtorhallen-halle-aktuelle-kunst", name: "Deichtorhallen Hamburg / Halle für aktuelle Kunst" },
        3: { slug: "deichtorhallen-sammlung-falckenberg", name: "Deichtorhallen Hamburg / Sammlung Falckenberg" },
      },
    },
    ctx,
  );
}
