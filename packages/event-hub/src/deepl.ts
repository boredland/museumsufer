/**
 * DeepL DE→EN batch translation, used as a last-resort fallback in the
 * TMDb enrichment pass when TMDb has a German overview but no English
 * one (typical for European arthouse and older catalogue titles).
 *
 * Mirrors the apps/frankfurt-museums/src/translate.ts call shape — same
 * comma-separated multi-key failover (free tier hits 500K-char/month
 * limits faster than we'd like) and same 50-string batch size.
 */

const DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate";
const BATCH_SIZE = 50;

export interface DeeplOptions {
  apiKeys: string;
  log?: (msg: string) => void;
}

export async function translateBatch(
  texts: string[],
  opts: DeeplOptions,
): Promise<Array<string | undefined>> {
  const log = opts.log ?? (() => undefined);
  const out: Array<string | undefined> = new Array(texts.length).fill(undefined);
  if (texts.length === 0) return out;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    try {
      const translations = await callDeepL(opts.apiKeys, batch);
      if (translations.length !== batch.length) {
        log(`deepl: batch length mismatch (${translations.length} vs ${batch.length}) — skipping batch`);
        continue;
      }
      for (let j = 0; j < batch.length; j++) {
        out[i + j] = translations[j];
      }
    } catch (e) {
      log(`deepl: batch failed — ${e instanceof Error ? e.message : String(e)}`);
      break;
    }
  }
  return out;
}

async function callDeepL(apiKeys: string, texts: string[]): Promise<string[]> {
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
  params.append("target_lang", "EN-US");
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
    // 456 = quota exhausted, 403 = invalid key — try the next one.
    if (res.status === 456 || res.status === 403) continue;
    const errorBody = await res.text();
    throw new Error(`DeepL API error ${res.status}: ${errorBody}`);
  }

  throw new Error("All DeepL API keys exhausted");
}
