/**
 * Request-time translation lookup. Reads the translations that
 * `scripts/scrape.ts` pre-computed into the bundled SCRAPE_DATA — no
 * network call, no DB hit. German museums carry DE→EN/FR/ES entries, Spanish
 * ones ES→DE/EN/FR; a page in a text's own language shows the original.
 */
import { fnv1a } from "@museumsufer/core";
import { getMuseumById, getTranslation } from "./queries";
import { sourceLangForCity } from "./source-lang";
import type { Env } from "./types";

/** Source language of one row: events/exhibitions inherit it from their
 *  museum, museum rows carry their own `city`. */
function sourceLangOf(item: Record<string, unknown>): string {
  const museumId = item.museum_id;
  const city = typeof museumId === "number" ? getMuseumById(museumId)?.city : (item.city as string | undefined);
  return sourceLangForCity(city);
}

export async function translateFields<T>(_env: Env, items: T[], fields: string[], targetLang: string): Promise<T[]> {
  return items.map((item) => {
    if (targetLang === sourceLangOf(item as Record<string, unknown>)) return item;
    const translated = { ...item } as Record<string, unknown>;
    for (const field of fields) {
      const text = (item as Record<string, unknown>)[field] as string | null;
      if (!text) continue;
      const hit = getTranslation(fnv1a(text), targetLang);
      if (hit !== undefined) translated[field] = hit;
    }
    return translated as T;
  });
}
