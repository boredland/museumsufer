import type { ProxyConfig } from "./museum-config";

/** Forward a fetch through the configured FETCH_PROXY (apps/fetch-proxy).
 *  Used when a museum's API blocks direct edge fetches by region or UA. */
export function proxyFetch(url: string, proxy: ProxyConfig): Promise<Response> {
  const proxyUrl = `${proxy.url}?url=${encodeURIComponent(url)}`;
  const headers: Record<string, string> = {};
  if (proxy.token) headers.Authorization = `Bearer ${proxy.token}`;
  return fetch(proxyUrl, { headers });
}
