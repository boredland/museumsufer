/**
 * Pure-function exhibition scraper. For museums whose exhibitions weren't
 * picked up by the museumsufer.de directory in `scrape()`, fall back to
 * the per-museum exhibitionApi configured in museum-config.ts. No D1.
 */
import PQueue from "p-queue";
import { type ApiExhibition, fetchExhibitionsFromApi } from "./api-scrapers";
import { todayIso } from "./date";
import { MUSEUMS } from "./museum-config";
import { logFail, logOk } from "./scrape-log";
import type { ParsedExhibition, ParsedMuseum } from "./scraper";

interface ProxyConfig {
  url?: string;
  token?: string;
}

const CONCURRENCY = 5;

export async function scrapeMuseumExhibitions(
  museums: Map<string, ParsedMuseum>,
  existing: ParsedExhibition[],
  opts: { proxy?: ProxyConfig } = {},
): Promise<ParsedExhibition[]> {
  const today = todayIso();
  const haveActiveBySlug = new Set<string>();
  for (const ex of existing) {
    if (!ex.end_date || ex.end_date >= today) haveActiveBySlug.add(ex.museum_slug);
  }

  const out: ParsedExhibition[] = [];
  const queue = new PQueue({ concurrency: CONCURRENCY });

  for (const museum of museums.values()) {
    if (haveActiveBySlug.has(museum.slug)) continue;
    const config = MUSEUMS[museum.slug];
    if (!config?.exhibitionApi) continue;
    const proxyArg = config.proxy && opts.proxy?.url ? { url: opts.proxy.url, token: opts.proxy.token } : undefined;

    queue.add(async () => {
      try {
        const items = await fetchExhibitionsFromApi(config.exhibitionApi!, proxyArg);
        const mapped = mapApiExhibitions(museum.slug, items, today);
        for (const it of mapped) out.push(it);
        logOk("exhibitions", museum.slug, `${mapped.length} exhibitions`);
      } catch (e) {
        logFail("exhibitions", museum.slug, e instanceof Error ? e.message : String(e));
      }
    });
  }
  await queue.onIdle();

  return out;
}

function mapApiExhibitions(museumSlug: string, items: ApiExhibition[], today: string): ParsedExhibition[] {
  const seen = new Set<string>();
  const out: ParsedExhibition[] = [];

  for (const it of items) {
    const title = it.title?.trim();
    if (!title) continue;
    if (it.end_date && /^\d{4}-\d{2}-\d{2}$/.test(it.end_date) && it.end_date < today) continue;

    const targetSlug = it.museum_slug_override || museumSlug;
    const key = `${targetSlug}::${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      museum_slug: targetSlug,
      title,
      start_date: it.start_date && /^\d{4}-\d{2}-\d{2}$/.test(it.start_date) ? it.start_date : null,
      end_date: it.end_date && /^\d{4}-\d{2}-\d{2}$/.test(it.end_date) ? it.end_date : null,
      description: it.description ?? null,
      image_url: it.image_url ?? null,
      detail_url: it.detail_url ?? "",
    });
  }

  return out;
}
