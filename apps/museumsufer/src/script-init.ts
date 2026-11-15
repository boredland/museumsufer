import { todayIso } from "./date";
import { dateLocale, getTranslations, type Locale, localizeTranslations, SUPPORTED_LOCALES } from "./i18n";
import { getMuseumLocations } from "./museum-config";

/** Options for script initialization on pages that use CLIENT_SCRIPT */
interface ScriptInitOptions {
  locale: Locale;
  city: string;
  initialDate?: string | null;
}

/**
 * Coordinates keyed by museum slug, for the shared transit popover. Emitted
 * once (~2 KB) in place of the per-card popover markup it replaces; the venue
 * name rides on the trigger button, so only lat/lng belong here.
 */
const MUSEUM_GEO_JSON = JSON.stringify(
  Object.fromEntries(Object.entries(getMuseumLocations()).map(([slug, m]) => [slug, [m.lat, m.lng]])),
);

/**
 * Emits the per-request globals (T, DATE_LOCALE, etc.) that the deferred
 * `/client-<hash>.js` bundle reads. `var` so they land on globalThis and
 * the bundle picks them up as bare references.
 */
export function generateScriptInit(options: ScriptInitOptions): string {
  const { locale, city, initialDate = null } = options;
  const tr = localizeTranslations(getTranslations(locale), city, locale);
  const trJson = JSON.stringify(tr);
  const dlJson = JSON.stringify(dateLocale(locale));
  const localesJson = JSON.stringify(SUPPORTED_LOCALES);

  return `var T = ${trJson};
var DATE_LOCALE = ${dlJson};
var LOCALES = ${localesJson};
var CURRENT_LANG = '${locale}';
var BERLIN_TODAY = '${todayIso()}';
var MUSEUM_GEO = ${MUSEUM_GEO_JSON};
var __INITIAL_DATE__ = ${initialDate ? JSON.stringify(initialDate) : "null"};`;
}
