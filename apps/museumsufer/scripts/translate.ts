import { fnv1a, logFail, logOk } from "@museumsufer/core";
import { type DeeplConfig, translateText } from "@museumsufer/core/deepl";
import { type SourceLang, sourceLangForCity } from "../src/source-lang";
import type { ScrapeData, Translation } from "../src/types";

/** Every UI language except the text's own. The page for the source language
 *  itself shows the original, so a text is never translated into its source. */
const TARGETS: Record<SourceLang, readonly string[]> = {
  de: ["EN", "FR", "ES"],
  es: ["DE", "EN", "FR"],
};

/** Translations bought per run. The shared proxy answers 429 after ~80-100 requests
 *  and `retryFetch` absorbs those with backoff, so an unbounded loop does not stop at
 *  the quota, it crawls: one run spent 19 minutes here and hit the CI job's timeout,
 *  skipping every other derive and the commit. A count (never a time budget) keeps the
 *  output deterministic; the shortest-first order means titles land first and the
 *  backlog drains over successive runs. */
const MAX_TRANSLATIONS_PER_RUN = 60;

type Translate = (config: DeeplConfig, text: string, targetLang: string, sourceLang: string) => Promise<string>;

/** Every text that reaches the bundle, mapped to the language it is written
 *  in (taken from the museum's city). Translations for anything else would be
 *  pruned afterwards and re-bought on every run. */
export function collectLivingTexts(data: ScrapeData): Map<string, SourceLang> {
  const langByMuseumId = new Map<number, SourceLang>(data.museums.map((m) => [m.id, sourceLangForCity(m.city)]));
  const texts = new Map<string, SourceLang>();
  const add = (text: string | undefined, lang: SourceLang | undefined) => {
    if (text && lang && !texts.has(text)) texts.set(text, lang);
  };
  for (const m of data.museums) add(m.description, langByMuseumId.get(m.id));
  for (const ex of data.exhibitions) {
    const lang = langByMuseumId.get(ex.museum_id);
    add(ex.title, lang);
    add(ex.description, lang);
  }
  for (const ev of data.events) {
    const lang = langByMuseumId.get(ev.museum_id);
    add(ev.title, lang);
    add(ev.description, lang);
  }
  return texts;
}

/**
 * Fill translations for `texts` that the previous bundle doesn't already
 * carry: German texts go to EN/FR/ES, Spanish texts to DE/EN/FR. Callers pass
 * only the texts that reach the bundle (see {@link collectLivingTexts}).
 *
 * The cache key is `source_hash|target_lang`: the hash is of the source text,
 * so a German and a Spanish text only share a key when they are the same
 * string, in which case the first one collected wins. Entries that predate
 * `source_lang` are German.
 */
export async function translateTexts(opts: {
  texts: ReadonlyMap<string, SourceLang>;
  existing: Translation[];
  deepl: DeeplConfig | null;
  /** Injectable so the ordering can be exercised without the network. */
  translate?: Translate;
}): Promise<Translation[]> {
  const merged = new Map<string, Translation>(opts.existing.map((t) => [`${t.source_hash}|${t.target_lang}`, t]));
  if (!opts.deepl) return [...merged.values()];
  const translate = opts.translate ?? translateText;

  const sources = new Map<string, { text: string; source: SourceLang }>();
  for (const [text, source] of opts.texts) {
    const trimmed = text.trim();
    if (trimmed.length < 3) continue;
    const hash = fnv1a(trimmed);
    if (!sources.has(hash)) sources.set(hash, { text: trimmed, source });
  }

  const jobs: Array<{ hash: string; text: string; source: SourceLang; target: string }> = [];
  for (const [hash, { text, source }] of sources) {
    for (const target of TARGETS[source]) {
      if (!merged.has(`${hash}|${target.toLowerCase()}`)) jobs.push({ hash, text, source, target });
    }
  }
  // The proxy's quota runs out mid-run and the rest waits for the next one, so the
  // order decides what readers see first. Spanish-source text goes ahead of German:
  // Valencia is the new city and its texts are unreadable to every other locale until
  // translated, while the German backlog (mostly DE->ES for a locale just added) only
  // fills in a language that already has a fallback. Within each group, shortest first
  // across every target at once: titles are what the page shows, and one description
  // costs as much as dozens of them. A per-target loop would let one target eat the budget.
  const sourceRank = (s: SourceLang): number => (s === "es" ? 0 : 1);
  jobs.sort(
    (a, b) =>
      sourceRank(a.source) - sourceRank(b.source) ||
      a.text.length - b.text.length ||
      a.hash.localeCompare(b.hash) ||
      a.target.localeCompare(b.target),
  );
  const deferred = Math.max(0, jobs.length - MAX_TRANSLATIONS_PER_RUN);
  jobs.length = Math.min(jobs.length, MAX_TRANSLATIONS_PER_RUN);
  if (deferred > 0)
    logOk("deepl", "-", `${deferred} translations deferred to later runs (cap ${MAX_TRANSLATIONS_PER_RUN}/run)`);

  const total = new Map<string, number>();
  const done = new Map<string, number>();
  for (const { target } of jobs) total.set(target, (total.get(target) ?? 0) + 1);

  for (const { hash, text, source, target } of jobs) {
    try {
      const translated = await translate(opts.deepl, text, target, source.toUpperCase());
      merged.set(`${hash}|${target.toLowerCase()}`, {
        source_hash: hash,
        target_lang: target.toLowerCase(),
        source_text: text,
        translated_text: translated,
        // Omitted for German so existing bundle entries stay byte-identical.
        ...(source === "es" ? { source_lang: "es" } : {}),
      });
      done.set(target, (done.get(target) ?? 0) + 1);
    } catch (e) {
      // retryFetch already absorbed transient errors; what's left means the
      // proxy or its upstream is down, so stop instead of hammering it.
      logFail("deepl", target.toLowerCase(), e instanceof Error ? e.message : String(e));
      break;
    }
  }

  for (const target of new Set(Object.values(TARGETS).flat())) {
    const n = total.get(target) ?? 0;
    logOk(
      "deepl",
      target.toLowerCase(),
      n === 0 ? "0 new strings (cache hit)" : `${done.get(target) ?? 0}/${n} new strings translated`,
    );
  }

  return [...merged.values()];
}
