/**
 * Small grab-bag of view helpers + escape utilities. The bigger shared
 * primitives (date math, hash, html stripping) live in @museumsufer/core.
 */
import { escapeHtml } from "@museumsufer/core";
import type { Locale } from "./i18n";

export const APP_URL = "https://landau.today";
export const USER_AGENT = "landau.today/1.0 (+https://landau.today)";

export const escHtml = escapeHtml;
export { jsonLdSafe } from "@museumsufer/core";

const LOCALE_TAGS: Record<Locale, string> = { de: "de-DE", fr: "fr-FR" };

function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function tagFor(locale: Locale): string {
  return LOCALE_TAGS[locale];
}

export function formatDateLong(iso: string, locale: Locale = "de"): string {
  return parseIso(iso).toLocaleDateString(tagFor(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateShort(iso: string, locale: Locale = "de"): string {
  return parseIso(iso).toLocaleDateString(tagFor(locale), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function weekdayShort(iso: string, locale: Locale = "de"): string {
  return parseIso(iso).toLocaleDateString(tagFor(locale), { weekday: "short", timeZone: "UTC" });
}

export function dayOfMonth(iso: string): string {
  return String(parseIso(iso).getUTCDate());
}

export function monthShort(iso: string, locale: Locale = "de"): string {
  return parseIso(iso).toLocaleDateString(tagFor(locale), { month: "short", timeZone: "UTC" });
}

/** German typesetter convention: 19.45. FR uses a colon. */
export function formatTime(time: string | undefined, locale: Locale = "de"): string | null {
  if (!time) return null;
  return locale === "de" ? time.replace(":", ".") : time;
}

export function formatDateRange(start: string, end: string | undefined, locale: Locale = "de"): string {
  if (!end || end === start) return formatDateLong(start, locale);
  const endYear = parseIso(end).toLocaleDateString(tagFor(locale), { year: "numeric", timeZone: "UTC" });
  return `${formatDateShort(start, locale)} – ${formatDateShort(end, locale)} ${endYear}`;
}

const RELATIVE_DAY_LABELS: Record<Locale, [string, string, string]> = {
  de: ["Heute", "Morgen", "Übermorgen"],
  fr: ["aujourd'hui", "demain", "après-demain"],
};

export function relativeDayLabel(iso: string, today: string, locale: Locale = "de"): string | null {
  const labels = RELATIVE_DAY_LABELS[locale];
  if (iso === today) return labels[0];
  const d1 = parseIso(today);
  const d2 = parseIso(iso);
  const diffDays = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  if (diffDays === 1) return labels[1];
  if (diffDays === 2) return labels[2];
  return null;
}

/** Compose a destination string for trip-planner URLs. We rarely have a
 *  full street address — venue name + city is fuzzy-searchable enough for
 *  both VRN and Google Maps. */
function destinationString(venue?: string, city?: string): string | null {
  const parts = [venue, city].filter((s): s is string => !!s && s.trim().length > 0);
  if (parts.length === 0) return null;
  return parts.join(", ");
}

/** VRN (Verkehrsverbund Rhein-Neckar) trip planner deep-link. Landau and
 *  the Südliche Weinstraße are inside VRN territory, so this is the
 *  region-correct equivalent of museumsufer's RMV link. */
export function buildVrnUrl(venue?: string, city?: string): string | null {
  const dest = destinationString(venue, city);
  if (!dest) return null;
  return `https://www.vrn.de/mng/#/XSLT_TRIP_REQUEST2?restriction=0&dest=${encodeURIComponent(dest)}&isDeparture=true`;
}

/** Google Maps directions deep-link. Falls back to a query-string
 *  destination when we don't have lat/lng — Google's geocoder handles
 *  "Venue, City" reasonably well. */
export function buildGoogleMapsUrl(venue?: string, city?: string): string | null {
  const dest = destinationString(venue, city);
  if (!dest) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
