import { todayIso } from "./date";
import { dateLocale, getTranslations, type Locale, SUPPORTED_LOCALES } from "./i18n";

/** Options for script initialization on pages that use CLIENT_SCRIPT */
interface ScriptInitOptions {
  locale: Locale;
  initialDate?: string | null;
}

/**
 * Emits the per-request globals (T, DATE_LOCALE, etc.) that the deferred
 * `/client-<hash>.js` bundle reads. `var` so they land on globalThis and
 * the bundle picks them up as bare references.
 */
export function generateScriptInit(options: ScriptInitOptions): string {
  const { locale, initialDate = null } = options;
  const tr = getTranslations(locale);
  const trJson = JSON.stringify(tr);
  const dlJson = JSON.stringify(dateLocale(locale));
  const localesJson = JSON.stringify(SUPPORTED_LOCALES);

  return `var T = ${trJson};
var DATE_LOCALE = ${dlJson};
var LOCALES = ${localesJson};
var CURRENT_LANG = '${locale}';
var BERLIN_TODAY = '${todayIso()}';
var __INITIAL_DATE__ = ${initialDate ? JSON.stringify(initialDate) : "null"};`;
}
