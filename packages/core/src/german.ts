/**
 * German month-name → number maps for date parsing in scrapers.
 * Both full and abbreviated forms; lowercase keys.
 */

export const GERMAN_MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

export const GERMAN_MONTHS_SHORT: Record<string, number> = {
  jan: 1,
  feb: 2,
  mär: 3,
  mar: 3,
  märz: 3,
  apr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  okt: 10,
  nov: 11,
  dez: 12,
};

export const GERMAN_WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export const GERMAN_WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export const GERMAN_MONTHS_LONG = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export const GERMAN_MONTHS_SHORT_DISPLAY = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

import { dateParts } from "./date";

function parseIsoUtc(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** "Donnerstag, 12. Mai 2026" — long German typesetter form. */
export function formatGermanDateLong(iso: string): string {
  const p = dateParts(iso);
  return `${GERMAN_WEEKDAYS[p.weekday]}, ${p.day}. ${GERMAN_MONTHS_LONG[p.month]} ${p.year}`;
}

/** "12. Mai" — short German date without year or weekday. */
export function formatGermanDateShort(iso: string): string {
  const p = dateParts(iso);
  return `${p.day}. ${GERMAN_MONTHS_SHORT_DISPLAY[p.month]}`;
}

/** "Mo" — German short weekday. */
export function germanWeekdayShort(iso: string): string {
  return GERMAN_WEEKDAYS_SHORT[parseIsoUtc(iso).getUTCDay()];
}

/** "Jan" — German short month name. */
export function germanMonthShort(iso: string): string {
  return GERMAN_MONTHS_SHORT_DISPLAY[parseIsoUtc(iso).getUTCMonth()];
}

/**
 * Locale-aware long date. Uses Intl for en/fr; the German path matches
 * the hand-tuned `formatGermanDateLong()` output exactly. Pass an
 * Intl-compatible locale tag (e.g. "fr-FR").
 */
export function formatLocalisedDateLong(iso: string, localeTag: string): string {
  if (localeTag.startsWith("de")) return formatGermanDateLong(iso);
  return parseIsoUtc(iso).toLocaleDateString(localeTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
