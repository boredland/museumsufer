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
  /** Per-attempt request timeout (ms). `fetch` has no default timeout, so a
   *  server that accepts the connection but never responds would hang the
   *  attempt forever — and p-retry can't even count it as a failure. Each
   *  attempt aborts after this so it becomes a retryable error. Ignored when
   *  the caller passes its own `signal`. Defaults to 20s. */
  requestTimeout?: number;
}

const RETRYABLE_STATUS = new Set([408, 429]);

export async function retryFetch(
  input: string | URL | Request,
  init?: RequestInit,
  options: RetryFetchOptions = {},
): Promise<Response> {
  const { retries = 3, minTimeout = 1000, maxTimeout = 10_000, factor = 3, label, requestTimeout = 20_000 } = options;
  return pRetry(
    async () => {
      // Fresh timeout per attempt; respect a caller-supplied signal if present.
      const signal = init?.signal ?? AbortSignal.timeout(requestTimeout);
      const res = await fetch(input, { ...init, signal });
      if (res.ok) return res;
      const transient = res.status >= 500 || RETRYABLE_STATUS.has(res.status);
      if (!transient) return res;
      await res.body?.cancel();
      throw new Error(`${label ?? String(input)}: ${res.status}`);
    },
    { retries, factor, minTimeout, maxTimeout, randomize: true },
  );
}
