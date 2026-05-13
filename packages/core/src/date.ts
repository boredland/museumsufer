import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Europe/Berlin";

export function berlinNow(): dayjs.Dayjs {
  return dayjs().tz(TZ);
}

export function toBerlinDate(d: Date | number): string {
  return dayjs(d).tz(TZ).format("YYYY-MM-DD");
}

export function toBerlinTime(d: Date | number): string {
  return dayjs(d).tz(TZ).format("HH:mm");
}

export function todayIso(): string {
  return berlinNow().format("YYYY-MM-DD");
}

export function dateOffset(days: number): string {
  return berlinNow().add(days, "day").format("YYYY-MM-DD");
}

export function berlinHourMinute(): { hour: number; minute: number } {
  const now = berlinNow();
  return { hour: now.hour(), minute: now.minute() };
}

const BERLIN_HOUR_FMT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "numeric",
  hour12: false,
});
const BERLIN_WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  weekday: "short",
});
const WEEKDAY_INDEX = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Berlin local hour (0-23) for the given instant. */
export function berlinHour(d: Date): number {
  const h = BERLIN_HOUR_FMT.formatToParts(d).find((p) => p.type === "hour")?.value;
  return h ? parseInt(h, 10) : -1;
}

/** Berlin local weekday (0=Sun … 6=Sat) for the given instant. */
export function berlinWeekday(d: Date): number {
  const w = BERLIN_WEEKDAY_FMT.formatToParts(d).find((p) => p.type === "weekday")?.value;
  return WEEKDAY_INDEX.indexOf(w ?? "");
}

export interface DateParts {
  weekday: number;
  day: number;
  month: number;
  year: number;
}

/** Split an ISO `YYYY-MM-DD` into UTC weekday/day/month/year. */
export function dateParts(iso: string): DateParts {
  const d = new Date(`${iso}T12:00:00Z`);
  return {
    weekday: d.getUTCDay(),
    day: d.getUTCDate(),
    month: d.getUTCMonth(),
    year: d.getUTCFullYear(),
  };
}

const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

/**
 * Cached `Intl.DateTimeFormat` factory. The constructor is expensive (per
 * V8 docs, ~ms range) and our hot paths build the same formatter for every
 * row in a date strip. Keying by locale + serialised options makes repeat
 * lookups effectively free.
 */
export function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = FORMATTER_CACHE.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    FORMATTER_CACHE.set(key, f);
  }
  return f;
}

/**
 * Given a German date (month/day) without a year, infer which year is
 * meant relative to today, assuming the date is upcoming. Used by
 * scrapers that surface dates like "12. März" with no year.
 */
export function inferYear(month: string, day: string): number {
  const now = berlinNow();
  const currentYear = now.year();
  const currentMonth = now.month() + 1;
  const m = parseInt(month, 10);
  if (currentMonth >= 11 && m <= 2) return currentYear + 1;
  const candidate = `${currentYear}-${month}-${day.padStart(2, "0")}`;
  if (candidate < todayIso()) {
    const nextYear = `${currentYear + 1}-${month}-${day.padStart(2, "0")}`;
    if (nextYear >= todayIso()) return currentYear + 1;
  }
  return currentYear;
}
