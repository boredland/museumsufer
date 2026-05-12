/**
 * Locale detection and date-format mapping shared by every app that exposes
 * `?lang=…` URL switching. The per-app translation tables stay in each
 * app's own i18n.ts — this module owns only the routing layer.
 *
 * Detection order: ?lang URL param → Accept-Language header → fallback.
 * The default locale is always `de` across the monorepo.
 */
export const SUPPORTED_LOCALE_VALUES = ["de", "en", "fr"] as const;

/** Union of every locale any app supports. Per-app subsets narrow at parse time. */
export type Locale = (typeof SUPPORTED_LOCALE_VALUES)[number];

const LOCALE_DATE_FORMATS: Record<Locale, string> = {
  de: "de-DE",
  en: "en-GB",
  fr: "fr-FR",
};

export function dateLocale(locale: Locale): string {
  return LOCALE_DATE_FORMATS[locale];
}

/**
 * Generic locale detector. Pass the locales this app actually supports
 * — anything outside the set falls back to `fallback`. Apps that only
 * support `["de"]` get a static `"de"` returned with no inference.
 */
export function detectLocale<L extends Locale>(request: Request, supported: readonly L[], fallback: L): L {
  const url = new URL(request.url);
  const param = url.searchParams.get("lang");
  if (param && (supported as readonly string[]).includes(param)) return param as L;

  const accept = request.headers.get("Accept-Language") || "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if ((supported as readonly string[]).includes(tag)) return tag as L;
  }

  return fallback;
}

/** Append `?lang=<locale>` (or `&lang=…`) to a URL, omitting it for the fallback. */
export function buildLangParam(locale: Locale, fallback: Locale, separator: "?" | "&" = "?"): string {
  return locale === fallback ? "" : `${separator}lang=${locale}`;
}
