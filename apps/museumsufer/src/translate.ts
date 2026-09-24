/**
 * Request-time translation lookup. Reads the DE→EN/FR translations that
 * `scripts/scrape.ts` pre-computed into the bundled SCRAPE_DATA — no
 * network call, no DB hit.
 */
import { fnv1a } from "@museumsufer/core";
import { getTranslation } from "./queries";
import type { Env } from "./types";

export async function translateFields<T>(_env: Env, items: T[], fields: string[], targetLang: string): Promise<T[]> {
  if (targetLang === "de") return items;

  return items.map((item) => {
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
