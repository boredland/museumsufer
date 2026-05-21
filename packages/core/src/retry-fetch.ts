/**
 * `fetch` wrapped in p-retry: retries on network errors and on transient
 * HTTP responses (5xx, 408, 429). Non-retryable non-ok responses (4xx
 * other than the two above) are returned as-is so callers keep control
 * of their own error semantics — DeepL's per-key 403/456 fallthrough,
 * for example, must not be eaten by the retry layer.
 *
 * Retryable status codes:
 *   - 5xx — origin / gateway failure (incl. Cloudflare 520-526)
 *   - 408 — request timeout
 *   - 429 — rate limited
 */
import pRetry from "p-retry";

export interface RetryFetchOptions {
  /** p-retry settings — defaults: 3 retries, 1s→9s exponential with jitter. */
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  factor?: number;
  /** Used in retry-attempt error messages. Defaults to the URL. */
  label?: string;
}

const RETRYABLE_STATUS = new Set([408, 429]);

export async function retryFetch(
  input: string | URL | Request,
  init?: RequestInit,
  options: RetryFetchOptions = {},
): Promise<Response> {
  const { retries = 3, minTimeout = 1000, maxTimeout = 10_000, factor = 3, label } = options;
  return pRetry(
    async () => {
      const res = await fetch(input, init);
      if (res.ok) return res;
      const transient = res.status >= 500 || RETRYABLE_STATUS.has(res.status);
      if (!transient) return res;
      await res.body?.cancel();
      throw new Error(`${label ?? String(input)}: ${res.status}`);
    },
    { retries, factor, minTimeout, maxTimeout, randomize: true },
  );
}
