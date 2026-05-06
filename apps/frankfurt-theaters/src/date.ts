import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Europe/Berlin";

export function berlinNow(): dayjs.Dayjs {
  return dayjs().tz(TZ);
}

export function todayIso(): string {
  return berlinNow().format("YYYY-MM-DD");
}

export function dateOffset(days: number): string {
  return berlinNow().add(days, "day").format("YYYY-MM-DD");
}
