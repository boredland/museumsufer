import { CLIENT_SCRIPT } from "./client-script";
import { todayIso } from "./date";
import { dateLocale, getTranslations, type Locale, SUPPORTED_LOCALES } from "./i18n";

/** Options for script initialization on pages that use CLIENT_SCRIPT */
interface ScriptInitOptions {
  locale: Locale;
  initialDate?: string | null;
}

/** Generates the global variables and CLIENT_SCRIPT as a unified string for inline <script> tags */
export function generateScriptInit(options: ScriptInitOptions): string {
  const { locale, initialDate = null } = options;
  const tr = getTranslations(locale);
  const trJson = JSON.stringify(tr);
  const dlJson = JSON.stringify(dateLocale(locale));
  const localesJson = JSON.stringify(SUPPORTED_LOCALES);

  return `const T = ${trJson};
const DATE_LOCALE = ${dlJson};
const LOCALES = ${localesJson};
const CURRENT_LANG = '${locale}';
const BERLIN_TODAY = '${todayIso()}';
const __INITIAL_DATE__ = ${initialDate ? JSON.stringify(initialDate) : "null"};
${CLIENT_SCRIPT}`;
}
