export interface ProxyConfig {
  url: string;
  token?: string;
}

/**
 * Optional fetch-proxy passthrough — bypasses datacenter-IP blocks and
 * broken TLS chains for hosts that reject direct CI fetches. Pass `null`
 * to fetch directly. Kept Node-types-free so it can run in Worker bundles.
 */
export function proxyFetch(targetUrl: string, proxy: ProxyConfig | null, init?: RequestInit): Promise<Response> {
  if (!proxy) return fetch(targetUrl, init);
  const proxyUrl = `${proxy.url}?url=${encodeURIComponent(targetUrl)}`;
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
  if (proxy.token) headers.Authorization = `Bearer ${proxy.token}`;
  return fetch(proxyUrl, { ...init, headers });
}
