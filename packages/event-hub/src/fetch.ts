import type { ProxyConfig } from "@museumsufer/scrapers";

/**
 * The `fetch` every venue scraper runs on: direct first, the fetch proxy as
 * the escalation — the order intensive-dance's LLM scraper measured into
 * (`llm_scrape/discover.py`, `fetch_source`).
 *
 * Direct-first because the proxy is the worse default. It always swaps in a
 * Chrome user agent, which some hosts refuse, and there a scraper's own UA
 * works; its Hetzner egress is refused by hosts that serve GitHub's runners;
 * and it adds a round trip to the 90%+ of requests that never needed it.
 * The proxy keeps what it is good at — a datacenter-IP block, a Cloudflare
 * challenge, a broken TLS chain — reached through `auto=1`, which walks
 * plain → FlareSolverr → stealth render and returns the first tier that isn't
 * blocked.
 *
 * Scrapers that call `proxyFetch` still go proxy-first: each one names in its
 * docstring the host that needs it, and that is the persisted form of the
 * per-host memo below. Their requests target the proxy itself and pass
 * through untouched.
 */

/** Refusals a different egress or a real browser can clear. 404/410 never
 *  escalate — a tier changes how we ask, not whether the page exists — and
 *  500/501 are the origin's own errors. 454 is a JS interstitial (Simply.com
 *  hosting); 52x/530 are Cloudflare edge failures in front of the origin. */
const ESCALATE_STATUS = new Set([401, 403, 429, 451, 454, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530]);

interface State {
  deadlineMs: number;
  proxy: ProxyConfig | null;
  /** Escalation is scoped to the scraper phase; the enrichment passes (TMDb,
   *  OMDb, DeepL) have their own retry and quota semantics. */
  escalate: boolean;
  /** host → the proxy was needed; its next request goes there first. Per
   *  process, never persisted: a block that lifts should cost one request. */
  gated: Set<string>;
  /** host → neither route answered; later requests go direct only, so a dead
   *  origin costs one deadline per request, not two. */
  dead: Set<string>;
  /** host → requests the proxy rescued, for the run log. */
  rescued: Map<string, number>;
}

let state: State | null = null;

/**
 * Install once per process. The runner abandons a slow scraper without
 * stopping it, so a straggler can still be fetching after the scraper phase
 * ends; restoring the original `fetch` then would hand it an unguarded one.
 * Every `fetch` gets `deadlineMs` unless the caller passed its own `signal`.
 */
export function installScrapeFetch(deadlineMs: number): void {
  if (state) return;
  const original = globalThis.fetch;
  const s: State = { deadlineMs, proxy: null, escalate: false, gated: new Set(), dead: new Set(), rescued: new Map() };
  state = s;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    ladder(original, s, input, init)) as typeof fetch;
}

/** Open the scraper phase: escalate through `proxy` (when set) until the
 *  returned function closes it, which yields the per-host rescue counts. */
export function openEscalation(proxy: ProxyConfig | null): () => Map<string, number> {
  if (!state) throw new Error("installScrapeFetch() must run first");
  const s = state;
  s.proxy = proxy;
  s.escalate = proxy !== null;
  s.rescued = new Map();
  return () => {
    s.escalate = false;
    return s.rescued;
  };
}

async function ladder(
  original: typeof fetch,
  s: State,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<Response> {
  const direct = () => original(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(s.deadlineMs) });
  const proxy = s.escalate ? s.proxy : null;
  const target = proxy ? escalatable(input, init, proxy) : null;
  if (!proxy || !target || s.dead.has(target.host)) return direct();

  const viaProxy = () =>
    original(`${proxy.url}?auto=1&url=${encodeURIComponent(target.href)}`, {
      ...init,
      headers: proxyHeaders(init?.headers, proxy.token),
      signal: init?.signal ?? AbortSignal.timeout(s.deadlineMs),
    });

  if (s.gated.has(target.host)) return viaProxy();

  let refused: Response | null = null;
  let failure: unknown = null;
  try {
    const res = await direct();
    if (!ESCALATE_STATUS.has(res.status)) return res;
    refused = res;
  } catch (err) {
    // The caller's own deadline is theirs to spend; only our default one, a
    // reset connection or a TLS failure is a reason to try another route.
    if (init?.signal?.aborted) throw err;
    failure = err;
  }

  try {
    const res = await viaProxy();
    if (!res.ok && !refused) s.dead.add(target.host);
    if (res.ok || !refused) {
      if (res.ok) {
        s.gated.add(target.host);
        s.rescued.set(target.host, (s.rescued.get(target.host) ?? 0) + 1);
        await refused?.body?.cancel();
      }
      return res;
    }
    // Both refused: the origin's own answer is the truer one to report.
    s.dead.add(target.host);
    await res.body?.cancel();
    return refused;
  } catch (err) {
    s.dead.add(target.host);
    if (refused) return refused;
    throw failure ?? err;
  }
}

/** The target URL when this request may go through the proxy, else null. */
function escalatable(input: RequestInfo | URL, init: RequestInit | undefined, proxy: ProxyConfig): URL | null {
  // A Request carries a one-shot body the direct attempt would consume.
  if (typeof input !== "string" && !(input instanceof URL)) return null;
  const url = new URL(input);
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  // Already addressed to the proxy (`proxyFetch`).
  if (url.href.startsWith(proxy.url)) return null;
  // The proxy authenticates with `Authorization`, so a request that carries
  // its own (an API token) cannot be forwarded without losing it.
  if (new Headers(init?.headers).has("authorization")) return null;
  // A stream is read once, by the direct attempt.
  if (init?.body instanceof ReadableStream) return null;
  return url;
}

function proxyHeaders(headers: HeadersInit | undefined, token: string | undefined): Headers {
  const out = new Headers(headers);
  if (token) out.set("Authorization", `Bearer ${token}`);
  return out;
}
