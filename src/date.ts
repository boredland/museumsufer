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

export function berlinHourMinute(): { hour: number; minute: number } {
  const now = berlinNow();
  return { hour: now.hour(), minute: now.minute() };
}
