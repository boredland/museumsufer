/**
 * Small grab-bag of view helpers + escape utilities. The bigger shared
 * primitives (date math, hash, html stripping) live in @museumsufer/core.
 */
import { escapeHtml } from "@museumsufer/core";

export const APP_URL = "https://landau.today";
export const USER_AGENT = "landau.today/1.0 (+https://landau.today)";

export const escHtml = escapeHtml;

const WEEKDAYS_DE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WEEKDAYS_DE_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS_DE = [
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
const MONTHS_DE_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

export function formatDateLong(iso: string): string {
  const d = parseIso(iso);
  return `${WEEKDAYS_DE[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTHS_DE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDateShort(iso: string): string {
  const d = parseIso(iso);
  return `${d.getUTCDate()}. ${MONTHS_DE_SHORT[d.getUTCMonth()]}`;
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS_DE_SHORT[parseIso(iso).getUTCDay()];
}

export function dayOfMonth(iso: string): string {
  return String(parseIso(iso).getUTCDate());
}

export function monthShort(iso: string): string {
  return MONTHS_DE_SHORT[parseIso(iso).getUTCMonth()];
}

/** German time format: 19.45 instead of 19:45 — typesetter's convention. */
export function formatTime(time?: string): string | null {
  if (!time) return null;
  return time.replace(":", ".");
}

export function formatDateRange(start: string, end?: string): string {
  if (!end || end === start) return formatDateLong(start);
  return `${formatDateShort(start)} – ${formatDateShort(end)} ${parseIso(end).getUTCFullYear()}`;
}

export function relativeDayLabel(iso: string, today: string): string | null {
  if (iso === today) return "Heute";
  const d1 = parseIso(today);
  const d2 = parseIso(iso);
  const diffDays = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  if (diffDays === 1) return "Morgen";
  if (diffDays === 2) return "Übermorgen";
  return null;
}
