import { Env } from "./types";

const DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate";
const BATCH_SIZE = 50;

export async function translateEvents(env: Env): Promise<{ translated: number }> {
  if (!env.DEEPL_API_KEY) return { translated: 0 };

  const targets = ["EN", "FR"] as const;
  let translated = 0;

  for (const targetLang of targets) {
    const count = await translateUntranslated(env, targetLang);
    translated += count;
  }

  return { translated };
}

async function translateUntranslated(env: Env, targetLang: string): Promise<number> {
  const texts = await getUntranslatedTexts(env, targetLang);
  if (texts.length === 0) return 0;

  let count = 0;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const sourceTexts = batch.map((t) => t.text);

    try {
      const translations = await callDeepL(env.DEEPL_API_KEY!, sourceTexts, targetLang);
      if (translations.length !== batch.length) continue;

      const stmts = batch.map((t, j) =>
        env.DB.prepare(
          `INSERT INTO translations (source_hash, target_lang, source_text, translated_text)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(source_hash, target_lang) DO UPDATE SET
             translated_text = excluded.translated_text`
        ).bind(t.hash, targetLang.toLowerCase(), t.text, translations[j])
      );

      await env.DB.batch(stmts);
      count += batch.length;
    } catch (e) {
      console.error(`DeepL translation failed for ${targetLang}:`, e);
      break;
    }
  }

  return count;
}

async function getUntranslatedTexts(
  env: Env,
  targetLang: string
): Promise<Array<{ hash: string; text: string }>> {
  const { results: eventTexts } = await env.DB.prepare(
    "SELECT DISTINCT title as text FROM events WHERE title != '' UNION SELECT DISTINCT description as text FROM events WHERE description IS NOT NULL AND description != ''"
  ).all<{ text: string }>();

  const { results: exhibTexts } = await env.DB.prepare(
    "SELECT DISTINCT title as text FROM exhibitions WHERE title != ''"
  ).all<{ text: string }>();

  const allTexts = [...eventTexts, ...exhibTexts];
  const seen = new Set<string>();
  const candidates: Array<{ hash: string; text: string }> = [];

  for (const row of allTexts) {
    if (!row.text || row.text.length < 3 || seen.has(row.text)) continue;
    seen.add(row.text);
    const hash = await sha256(row.text);
    candidates.push({ hash, text: row.text });
  }

  if (candidates.length === 0) return [];

  const existing = new Set<string>();
  for (let i = 0; i < candidates.length; i += 50) {
    const batch = candidates.slice(i, i + 50);
    const placeholders = batch.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT source_hash FROM translations WHERE source_hash IN (${placeholders}) AND target_lang = ?`
    ).bind(...batch.map((c) => c.hash), targetLang.toLowerCase()).all<{ source_hash: string }>();
    for (const r of results) existing.add(r.source_hash);
  }

  return candidates.filter((c) => !existing.has(c.hash)).slice(0, 200);
}

async function callDeepL(
  apiKey: string,
  texts: string[],
  targetLang: string
): Promise<string[]> {
  const params = new URLSearchParams();
  for (const text of texts) {
    params.append("text", text);
  }
  params.append("source_lang", "DE");
  params.append("target_lang", targetLang);

  const res = await fetch(DEEPL_FREE_URL, {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DeepL API error ${res.status}: ${body}`);
  }

  const data = await res.json() as { translations: Array<{ text: string }> };
  return data.translations.map((t) => t.text);
}

export async function getTranslation(
  env: Env,
  text: string | null,
  targetLang: string
): Promise<string | null> {
  if (!text) return null;
  if (targetLang === "de") return text;

  const hash = await sha256(text);
  const row = await env.DB.prepare(
    "SELECT translated_text FROM translations WHERE source_hash = ? AND target_lang = ?"
  )
    .bind(hash, targetLang)
    .first<{ translated_text: string }>();

  return row?.translated_text ?? text;
}

export async function translateFields<T>(
  env: Env,
  items: T[],
  fields: string[],
  targetLang: string
): Promise<T[]> {
  if (targetLang === "de") return items;

  const hashes = new Map<string, string>();
  const toFetch = new Set<string>();
  const rec = items as Record<string, unknown>[];

  for (let idx = 0; idx < rec.length; idx++) {
    for (const field of fields) {
      const text = rec[idx][field] as string | null;
      if (!text) continue;
      const hash = await sha256(text);
      hashes.set(`${field}-${idx}`, hash);
      toFetch.add(hash);
    }
  }

  if (toFetch.size === 0) return items;

  const hashList = [...toFetch];
  const translations = new Map<string, string>();

  for (let i = 0; i < hashList.length; i += 50) {
    const batch = hashList.slice(i, i + 50);
    const placeholders = batch.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT source_hash, translated_text FROM translations
       WHERE source_hash IN (${placeholders}) AND target_lang = ?`
    )
      .bind(...batch, targetLang)
      .all<{ source_hash: string; translated_text: string }>();

    for (const row of results) {
      translations.set(row.source_hash, row.translated_text);
    }
  }

  return items.map((item, idx) => {
    const translated = { ...item } as Record<string, unknown>;
    for (const field of fields) {
      const text = (item as Record<string, unknown>)[field] as string | null;
      if (!text) continue;
      const hash = hashes.get(`${field}-${idx}`);
      if (hash && translations.has(hash)) {
        translated[field] = translations.get(hash);
      }
    }
    return translated as T;
  });
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
