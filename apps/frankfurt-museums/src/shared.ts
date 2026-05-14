import {
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  buildYahooCalendarUrl,
  type CalendarEvent as CoreCalendarEvent,
  decodeEntities as coreDecodeEntities,
  escapeHtml as coreEscapeHtml,
  normalizeUrl as coreNormalizeUrl,
  nullIfMidnight as coreNullIfMidnight,
  stripHtml as coreStripHtml,
  truncate as coreTruncate,
} from "@museumsufer/core";

export const MUSEUMSUFER_DE = "https://www.museumsufer.de";
export const APP_URL = "https://museumsufer.app";
export const USER_AGENT = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

// Museums uses zero-padded month STRINGS (concatenated into ISO date strings),
// while core/german uses NUMBERS. Different shape, so we keep them local.
export const GERMAN_MONTHS_SHORT: Record<string, string> = {
  jan: "01",
  feb: "02",
  mär: "03",
  mar: "03",
  apr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  okt: "10",
  nov: "11",
  dez: "12",
};

export const GERMAN_MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

// Re-export from @museumsufer/core. Existing call sites keep working.
// `escHtml` keeps its old name; the new core version also escapes apostrophes,
// which is a strict superset of what museums was doing.
export const escHtml = coreEscapeHtml;
export const nullIfMidnight = coreNullIfMidnight;
export const normalizeUrl = coreNormalizeUrl;
export const decodeEntities = coreDecodeEntities;

/**
 * Strip HTML and decode entities. Core's implementation now preserves German
 * named entities (`&auml;` → `ä`, `&szlig;` → `ß`, `&shy;`, …) where the
 * previous local version silently dropped them. This is a strict
 * UX improvement for scraped content.
 */
export const stripHtml = coreStripHtml;

/** Backwards-compatible wrapper around `core.truncate`, keeping the 500-char default. */
export function truncateHtml(text: string, maxLen = 500): string | null {
  return coreTruncate(text, maxLen);
}

export function formatDateFull(iso: string, dateLocaleStr: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  const weekday = d.toLocaleDateString(dateLocaleStr, { weekday: "long" });
  const rest = d.toLocaleDateString(dateLocaleStr, { day: "numeric", month: "long", year: "numeric" });
  return `${weekday}, ${rest}`;
}

export function formatDateShort(iso: string, dateLocaleStr: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(dateLocaleStr, { day: "numeric", month: "short" });
}

export interface CalendarEvent {
  date: string;
  time: string | null;
  end_time: string | null;
  end_date: string | null;
  title: string;
  museum_name?: string;
  description: string | null;
  detail_url: string | null;
}

function toCore(ev: CalendarEvent): CoreCalendarEvent {
  return { ...ev, location: ev.museum_name };
}

export function buildCalendarUrl(ev: CalendarEvent): string {
  return buildGoogleCalendarUrl(toCore(ev));
}

export function buildOutlookUrl(ev: CalendarEvent): string {
  return buildOutlookCalendarUrl(toCore(ev));
}

export function buildYahooUrl(ev: CalendarEvent): string {
  return buildYahooCalendarUrl(toCore(ev));
}

export function classifyEvent(title: string, description?: string | null): string | null {
  const t = title.toLowerCase();
  const d = (description || "").toLowerCase();
  const haystack = `${t} ${d}`;

  if (
    haystack.includes("führung") ||
    haystack.includes("fuehrung") ||
    haystack.includes("rundgang") ||
    haystack.includes("spaziergang") ||
    haystack.includes("tour")
  )
    return "Führung";
  if (
    haystack.includes("workshop") ||
    haystack.includes("kurs") ||
    haystack.includes("atelier") ||
    haystack.includes("werkstatt")
  )
    return "Workshop";
  if (
    haystack.includes("vortrag") ||
    haystack.includes("lecture") ||
    haystack.includes("gespräch") ||
    haystack.includes("talk") ||
    haystack.includes("buchpräsentation") ||
    haystack.includes("diskussion")
  )
    return "Vortrag";
  if (haystack.includes("konzert") || haystack.includes("musik")) return "Konzert";
  if (haystack.includes("vernissage") || haystack.includes("eröffnung") || haystack.includes("eröffnungsfeier"))
    return "Vernissage";
  if (
    haystack.includes("familie") ||
    haystack.includes("kinder") ||
    haystack.includes(" für kids") ||
    haystack.includes("baby")
  )
    return "Familie";
  if (haystack.includes("film") || haystack.includes("kino") || haystack.includes("cinema")) return "Film";

  return null;
}
