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
