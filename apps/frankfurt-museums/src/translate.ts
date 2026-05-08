/**
 * Two-faced translation module:
 *
 * - `translateFields()` runs at request time inside the worker. It reads
 *   pre-computed translations from the bundled SCRAPE_DATA via the
 *   queries module — no DeepL call, no DB hit.
 *
 * - `translateEvents()` runs in the GitHub Action (scripts/scrape.ts).
 *   It collects untranslated strings from the freshly-scraped data,
 *   batch-calls DeepL for misses, and returns the merged translation
 *   array to bundle into scrape-data.ts.
 */
import { fnv1a } from "@museumsufer/core";
import { getTranslation } from "./queries";
import type { Env, Translation } from "./types";

const DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate";
const BATCH_SIZE = 50;

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

interface TranslatableItem {
  title?: string | null;
  description?: string | null;
}

export async function translateEvents(opts: {
  events: TranslatableItem[];
  exhibitions: TranslatableItem[];
  museums: TranslatableItem[];
  existing: Translation[];
  apiKeys?: string;
}): Promise<Translation[]> {
  const targets = ["EN", "FR"] as const;
  const merged = new Map<string, Translation>(opts.existing.map((t) => [`${t.source_hash}|${t.target_lang}`, t]));
  if (!opts.apiKeys) return [...merged.values()];

  // Collect every distinct source string from the current scrape.
  const sourceTexts = new Map<string, string>();
  const collect = (text: string | null | undefined) => {
    if (!text) return;
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    sourceTexts.set(fnv1a(trimmed), trimmed);
  };
  for (const e of opts.events) {
    collect(e.title);
    collect(e.description);
  }
  for (const ex of opts.exhibitions) collect(ex.title);
  for (const m of opts.museums) collect(m.description);

  for (const lang of targets) {
    const langLower = lang.toLowerCase();
    const missing: { hash: string; text: string }[] = [];
    for (const [hash, text] of sourceTexts) {
      if (merged.has(`${hash}|${langLower}`)) continue;
      missing.push({ hash, text });
    }
    if (missing.length === 0) continue;

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      try {
        const translations = await callDeepL(
          opts.apiKeys,
          batch.map((b) => b.text),
          lang,
        );
        if (translations.length !== batch.length) continue;
        for (let j = 0; j < batch.length; j++) {
          const b = batch[j];
          merged.set(`${b.hash}|${langLower}`, {
            source_hash: b.hash,
            target_lang: langLower,
            source_text: b.text,
            translated_text: translations[j],
          });
        }
      } catch (e) {
        console.error(`DeepL translation failed for ${lang}:`, e);
        break;
      }
    }
  }

  return [...merged.values()];
}

async function callDeepL(apiKeys: string, texts: string[], targetLang: string): Promise<string[]> {
  const keys = apiKeys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  // Random shuffle so transient quota errors hit a different key first.
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }

  const params = new URLSearchParams();
  for (const text of texts) params.append("text", text);
  params.append("source_lang", "DE");
  params.append("target_lang", targetLang);
  const body = params.toString();

  for (const key of keys) {
    const res = await fetch(DEEPL_FREE_URL, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (res.ok) {
      const data = (await res.json()) as { translations: Array<{ text: string }> };
      return data.translations.map((t) => t.text);
    }
    console.warn(`DeepL key ${key.slice(0, 8)}… failed with ${res.status}`);
    if (res.status === 456 || res.status === 403) continue;
    const errorBody = await res.text();
    throw new Error(`DeepL API error ${res.status}: ${errorBody}`);
  }

  throw new Error("All DeepL API keys exhausted");
}
