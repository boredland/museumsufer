/**
 * User-Agent strings used by scrapers.
 *
 * - BROWSER_UA: a desktop Chrome string. Required for hosts behind
 *   CloudFront/Akamai (Reservix subdomains, Eventim) which 403 plain
 *   bot UAs.
 * - BOT_UA: an honest aggregator UA for hosts that don't gate.
 */

export const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export const BOT_UA = "Mozilla/5.0 (compatible; Museumsufer/1.0; +https://museumsufer.app)";

/** Headers a German-speaking real browser would send — required by Reservix CloudFront edge. */
export function germanBrowserHeaders(): Record<string, string> {
  return {
    "User-Agent": BROWSER_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
    "Accept-Language": "de-DE,de;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
  };
}
