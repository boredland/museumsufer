/**
 * Optional fetch-proxy passthrough — mirrors apps/frankfurt-museums/src/
 * fetch-utils.ts. Used to bypass datacenter-IP blocks and broken TLS chains
 * for hosts that reject direct CI fetches.
 *
 * Pattern: keep this module Node-types-free (Worker-tsconfig friendly). The
 * scrape script reads `process.env.FETCH_PROXY_*` and passes a ProxyConfig
 * to scrapers that need it.
 */

export interface ProxyConfig {
  url: string;
  token?: string;
}

export function proxyFetch(targetUrl: string, proxy: ProxyConfig | null, init?: RequestInit): Promise<Response> {
  if (!proxy) return fetch(targetUrl, init);
  const proxyUrl = `${proxy.url}?url=${encodeURIComponent(targetUrl)}`;
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
  if (proxy.token) headers.Authorization = `Bearer ${proxy.token}`;
  return fetch(proxyUrl, { ...init, headers });
}
