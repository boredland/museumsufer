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

/**
 * Render the "07 · 17 · So 09" digest schedule strip with the correct
 * abbreviated weekday for the target locale. The morning + afternoon
 * digests fire at 07:00 and 17:00 every day; the weekly digest fires
 * Sunday at 09:00. The literal numerals stay the same across locales.
 */
export function digestScheduleLabel(locale: Locale): string {
  const sundayShort = new Intl.DateTimeFormat(LOCALE_DATE_FORMATS[locale], {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2024, 0, 7)));
  return `07 · 17 · ${sundayShort} 09`;
}

/**
 * Strip an existing `lang=` query param from `currentPath` so we can
 * cleanly re-stamp it. Preserves every other query param.
 */
export function stripLangParam(currentPath: string): string {
  const i = currentPath.indexOf("?");
  if (i < 0) return currentPath;
  const path = currentPath.slice(0, i);
  const params = new URLSearchParams(currentPath.slice(i + 1));
  params.delete("lang");
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

/**
 * Build the `lang=`-swapped path for a single locale. The default locale
 * emits the bare path (no `?lang=`); other locales append `?lang=xx` or
 * `&lang=xx` depending on existing query.
 */
export function localisedPath(currentPath: string, locale: Locale, fallback: Locale): string {
  const stripped = stripLangParam(currentPath);
  if (locale === fallback) return stripped || "/";
  const sep = stripped.includes("?") ? "&" : "?";
  return `${stripped}${sep}lang=${locale}`;
}

/**
 * Build absolute hreflang alternate hrefs for the supported locales of
 * an app. The fallback locale itself is *not* emitted as an explicit
 * `hreflang` link — `x-default` covers the same URL, and emitting both
 * trips Lighthouse's overly-strict "canonical must not equal an hreflang
 * URL" check. Google's hreflang guidance allows omitting the default;
 * x-default is the canonical pointer for the default locale.
 *
 *   buildHreflangAlternates({
 *     currentPath: "/event/123?date=2026-05-12",
 *     appUrl: "https://landau.today",
 *     supported: ["de", "fr"],
 *     fallback: "de",
 *   })
 *   // → [
 *   //     { hreflang: "fr",        href: "https://landau.today/event/123?date=2026-05-12&lang=fr" },
 *   //     { hreflang: "x-default", href: "https://landau.today/event/123?date=2026-05-12" },
 *   //   ]
 */
export interface HreflangAlternate {
  hreflang: string;
  href: string;
}
export function buildHreflangAlternates<L extends Locale>(opts: {
  currentPath: string;
  appUrl: string;
  supported: readonly L[];
  fallback: L;
}): HreflangAlternate[] {
  const { currentPath, appUrl, supported, fallback } = opts;
  const out: HreflangAlternate[] = supported
    .filter((l) => l !== fallback)
    .map((l) => ({
      hreflang: l,
      href: `${appUrl}${localisedPath(currentPath, l, fallback)}`,
    }));
  out.push({ hreflang: "x-default", href: `${appUrl}${stripLangParam(currentPath) || "/"}` });
  return out;
}

/**
 * Inert HTML string of <link rel="alternate" hreflang="..." href="..." />
 * lines. Useful for apps still using string-template head rendering.
 * Each href is HTML-attr-escaped.
 */
export function renderHreflangLinks<L extends Locale>(opts: {
  currentPath: string;
  appUrl: string;
  supported: readonly L[];
  fallback: L;
}): string {
  return buildHreflangAlternates(opts)
    .map(({ hreflang, href }) => `<link rel="alternate" hreflang="${hreflang}" href="${attrEsc(href)}" />`)
    .join("\n");
}

function attrEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Inert HTML for a lang-switch nav. The wrapping <nav> is left to the
 * caller (CSS varies per app). This returns just the <a> chips.
 * Each `lang` link is `?lang=…` for non-fallback locales.
 *
 * For JSX-rendered apps, see `langSwitchItems()` which returns plain
 * data instead of HTML.
 */
export function renderLangSwitchLinks<L extends Locale>(opts: {
  locale: L;
  currentPath: string;
  supported: readonly L[];
  fallback: L;
  className?: string;
  activeClassName?: string;
}): string {
  const {
    locale,
    currentPath,
    supported,
    fallback,
    className = "langswitch__a",
    activeClassName = "langswitch__a--active",
  } = opts;
  return langSwitchItems({ locale, currentPath, supported, fallback })
    .map(
      ({ locale: l, href, active }) =>
        `<a href="${attrEsc(href)}" class="${active ? `${className} ${activeClassName}` : className}" hreflang="${l}"${active ? ' aria-current="page"' : ""}>${l.toUpperCase()}</a>`,
    )
    .join("");
}

/**
 * Pure data for a lang switcher: one entry per supported locale, with
 * the href to swap to and an `active` flag. JSX renderers iterate this;
 * string renderers use `renderLangSwitchLinks` instead.
 *
 * Unlike `localisedPath` (which omits `?lang=` for the fallback locale
 * because hreflang prefers the clean canonical URL), this builder
 * ALWAYS pins `?lang=…` on the switcher hrefs. The user's browser may
 * be sending `Accept-Language: en-*`, so a clean `/` URL would be
 * detected as EN; the explicit `?lang=de` lets the user override.
 */
export interface LangSwitchItem<L extends Locale = Locale> {
  locale: L;
  href: string;
  active: boolean;
}
export function langSwitchItems<L extends Locale>(opts: {
  locale: L;
  currentPath: string;
  supported: readonly L[];
  fallback: L;
}): LangSwitchItem<L>[] {
  const { locale, currentPath, supported } = opts;
  return supported.map((l) => {
    const stripped = stripLangParam(currentPath);
    const path = stripped || "/";
    const sep = path.includes("?") ? "&" : "?";
    return {
      locale: l,
      href: `${path}${sep}lang=${l}`,
      active: l === locale,
    };
  });
}
