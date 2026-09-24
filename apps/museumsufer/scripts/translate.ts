import { fnv1a, logFail, logOk } from "@museumsufer/core";
import { type DeeplConfig, translateText } from "@museumsufer/core/deepl";
import type { Translation } from "../src/types";

const TARGETS = ["EN", "FR"] as const;

/**
 * Fill DE→EN/FR translations for `texts` that the previous bundle doesn't
 * already carry. Callers pass only the texts that reach the bundle: anything
 * translated but then dropped is pruned from the cache and would be paid for
 * again on every run.
 */
export async function translateTexts(opts: {
  texts: Iterable<string>;
  existing: Translation[];
  deepl: DeeplConfig | null;
}): Promise<Translation[]> {
  const merged = new Map<string, Translation>(opts.existing.map((t) => [`${t.source_hash}|${t.target_lang}`, t]));
  if (!opts.deepl) return [...merged.values()];

  const sourceTexts = new Map<string, string>();
  for (const text of opts.texts) {
    const trimmed = text.trim();
    if (trimmed.length >= 3) sourceTexts.set(fnv1a(trimmed), trimmed);
  }

  for (const lang of TARGETS) {
    const langLower = lang.toLowerCase();
    const missing = [...sourceTexts].filter(([hash]) => !merged.has(`${hash}|${langLower}`));
    if (missing.length === 0) {
      logOk("deepl", langLower, "0 new strings (cache hit)");
      continue;
    }

    let translatedCount = 0;
    for (const [hash, text] of missing) {
      try {
        merged.set(`${hash}|${langLower}`, {
          source_hash: hash,
          target_lang: langLower,
          source_text: text,
          translated_text: await translateText(opts.deepl, text, lang),
        });
        translatedCount++;
      } catch (e) {
        // retryFetch already absorbed transient errors; what's left means the
        // proxy or its upstream is down, so stop instead of hammering it.
        logFail("deepl", langLower, e instanceof Error ? e.message : String(e));
        break;
      }
    }
    logOk("deepl", langLower, `${translatedCount}/${missing.length} new strings translated`);
  }

  return [...merged.values()];
}
