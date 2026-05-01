import type { ProxyConfig } from "./museum-config";
import { USER_AGENT } from "./shared";
import type { Env } from "./types";

export function proxyFetch(url: string, proxy: ProxyConfig): Promise<Response> {
  const proxyUrl = `${proxy.url}?url=${encodeURIComponent(url)}`;
  const headers: Record<string, string> = {};
  if (proxy.token) headers.Authorization = `Bearer ${proxy.token}`;
  return fetch(proxyUrl, { headers });
}

export async function fetchViaProxy(env: Env, url: string): Promise<string> {
  const proxyUrl = `${env.FETCH_PROXY_URL}?url=${encodeURIComponent(url)}`;
  const headers: Record<string, string> = {};
  if (env.FETCH_PROXY_TOKEN) headers.Authorization = `Bearer ${env.FETCH_PROXY_TOKEN}`;
  const res = await fetch(proxyUrl, { headers });
  if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
  return res.text();
}

export async function fetchWithBrowser(env: Env, url: string): Promise<string> {
  const puppeteer = await import("@cloudflare/puppeteer");
  const browser = await puppeteer.default.launch(env.BROWSER!);
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 15000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

export async function fetchPage(env: Env, url: string, opts?: { spa?: true; proxy?: true }): Promise<string | null> {
  try {
    if (opts?.spa && env.BROWSER) {
      return await fetchWithBrowser(env, url);
    }
    if (opts?.proxy && env.FETCH_PROXY_URL) {
      return await fetchViaProxy(env, url);
    }
    if (opts?.spa || opts?.proxy) {
      return null;
    }
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
