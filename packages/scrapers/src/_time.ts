/** Add `minutes` to a literal `"HH:MM"` clock time, wrapping within a 24h day.
 *
 *  Pure arithmetic on the literal local time — deliberately avoids
 *  `new Date(start).getHours()`, whose hour/minute readout depends on the
 *  runtime's timezone. go~mus/SHMH starts arrive as `"…T14:00:00+02:00"` and
 *  the start is kept as the literal `"14:00"`; deriving the end via `Date`
 *  desynced it to the runner's zone (UTC in CI → `"14:00–12:00"`) and made the
 *  scrape path non-deterministic. Returns `null` when `clock` isn't `"HH:MM"`. */
export function addClockMinutes(clock: string, minutes: number): string | null {
  if (!/^\d{2}:\d{2}$/.test(clock)) return null;
  const start = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
  const wrapped = (((start + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}
