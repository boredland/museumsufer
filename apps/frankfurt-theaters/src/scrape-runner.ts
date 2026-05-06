import { dateOffset, todayIso } from "./date";
import { getAvailabilityCandidates, persistScrapeResult, updateAvailability, upsertTheater } from "./db";
import { fetchEventimAvailability } from "./enrich/eventim-availability";
import { scrapeSchauspielFrankfurt } from "./scrapers/schauspiel";
import { THEATERS, type TheaterConfig } from "./theater-config";
import type { Env, ScrapeResult } from "./types";

export interface RunSummary {
  theater_slug: string;
  ok: boolean;
  shows: number;
  performances: number;
  enriched: number;
  error?: string;
}

const ENRICH_DAYS_AHEAD = 14;
const ENRICH_MAX_PER_RUN = 80;

export async function runAll(env: Env): Promise<RunSummary[]> {
  const out: RunSummary[] = [];
  for (const t of THEATERS) {
    out.push(await runOne(env, t.slug));
  }
  return out;
}

export async function runOne(env: Env, slug: string): Promise<RunSummary> {
  const config = THEATERS.find((t) => t.slug === slug);
  if (!config) {
    return { theater_slug: slug, ok: false, shows: 0, performances: 0, enriched: 0, error: "unknown theater" };
  }
  try {
    const theaterId = await upsertTheater(env.DB, config);
    const result = await runScraper(config.scraper);
    const { shows, performances } = await persistScrapeResult(env.DB, theaterId, result);
    const enriched = await enrichAvailability(env, theaterId, config);
    return { theater_slug: slug, ok: true, shows, performances, enriched };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Scrape failed for ${slug}:`, err);
    return { theater_slug: slug, ok: false, shows: 0, performances: 0, enriched: 0, error: message };
  }
}

async function runScraper(name: "schauspiel"): Promise<ScrapeResult> {
  switch (name) {
    case "schauspiel":
      return scrapeSchauspielFrankfurt();
  }
}

async function enrichAvailability(env: Env, theaterId: number, config: TheaterConfig): Promise<number> {
  if (config.ticketing_provider !== "eventim_inhouse" || !config.eventim_inhouse_host) return 0;

  const candidates = await getAvailabilityCandidates(env.DB, theaterId, todayIso(), dateOffset(ENRICH_DAYS_AHEAD));
  let enriched = 0;
  for (const c of candidates.slice(0, ENRICH_MAX_PER_RUN)) {
    const avail = await fetchEventimAvailability(config.eventim_inhouse_host, c.provider_event_id);
    if (!avail) continue;
    await updateAvailability(env.DB, c.performance_id, avail.available_seats, avail.total_seats, avail.status);
    enriched++;
  }
  return enriched;
}
