/**
 * Client for the self-hosted DeepL proxy (translate.jonas-strassel.de),
 * which fronts real DeepL behind a bearer token. Scrape-time only — the
 * translations it returns are cached in committed bundles, so reruns on
 * unchanged text never call it.
 *
 * `POST /translate` takes a single string; an array body 400s, so callers
 * translate one text per request.
 */
import { retryFetch } from "./retry-fetch";

export interface DeeplConfig {
  url: string;
  token: string;
}

/** The proxy is small and shared with other projects; a burst rate-limits
 *  every consumer, so requests are spaced process-wide. */
const MIN_SPACING_MS = 250;
let nextSlot = 0;

async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const wait = nextSlot - now;
  nextSlot = Math.max(now, nextSlot) + MIN_SPACING_MS;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

/** Translate German `text` into `targetLang` (uppercase DeepL code: EN, FR, …). */
export async function translateText(config: DeeplConfig, text: string, targetLang: string): Promise<string> {
  await waitForSlot();
  const res = await retryFetch(
    `${config.url.replace(/\/+$/, "")}/translate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ text, source_lang: "DE", target_lang: targetLang }),
    },
    { label: "deepl" },
  );
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { data?: unknown };
  if (typeof body.data !== "string" || !body.data) throw new Error("DeepL returned no translation");
  return body.data;
}
