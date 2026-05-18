import { berlinHour, berlinWeekday, dateOffset, sendPush, todayIso, type VapidKeys } from "@museumsufer/core";
import { getScreeningsForDate, getScreeningsInRange } from "./db";
import type { Env } from "./types";

export type Schedule = "morning" | "afternoon" | "weekly";

const APP_URL = "https://frankfurt.lichtspiel.haus";

interface SubRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  schedule: Schedule;
  filters_json: string | null;
}

interface PushFilters {
  cinemas?: string[];
}

function parseFilters(json: string | null): PushFilters | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    if (!v || typeof v !== "object") return null;
    if (!Array.isArray((v as { cinemas?: unknown }).cinemas)) return null;
    const cinemas = ((v as { cinemas: unknown[] }).cinemas as unknown[]).filter(
      (c): c is string => typeof c === "string" && c.length > 0,
    );
    return cinemas.length === 0 ? null : { cinemas };
  } catch {
    return null;
  }
}

export function scheduleForNow(now: Date): Schedule | null {
  const h = berlinHour(now);
  const wd = berlinWeekday(now);
  if (wd === 0 && h === 9) return "weekly";
  if (h === 7) return "morning";
  if (h === 16) return "afternoon";
  return null;
}

interface NotificationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

function formatTime(t?: string | null): string {
  return t ? t.slice(0, 5) : "";
}

interface ScreeningLike {
  date: string;
  time?: string | null;
  title: string;
  cinema_slug: string;
}

function screeningsMatchingFilters(screenings: ScreeningLike[], filters: PushFilters | null): ScreeningLike[] {
  if (!filters?.cinemas || filters.cinemas.length === 0) return screenings;
  const allowed = new Set(filters.cinemas);
  return screenings.filter((s) => allowed.has(s.cinema_slug));
}

function buildMorningPayload(filters: PushFilters | null): NotificationPayload | null {
  const date = todayIso();
  const screenings = screeningsMatchingFilters(getScreeningsForDate(date) as ScreeningLike[], filters);
  if (screenings.length === 0) return null;
  const sample = screenings.slice(0, 3).map((s) => {
    const time = formatTime(s.time);
    return time ? `${time} ${s.title}` : s.title;
  });
  const body =
    screenings.length <= 3 ? sample.join(" · ") : `${sample.join(" · ")} und ${screenings.length - 3} weitere`;
  return {
    title: `Heute: ${screenings.length} Vorstellung${screenings.length === 1 ? "" : "en"}`,
    body,
    url: `${APP_URL}/tag/${date}`,
    tag: `morning-${date}`,
  };
}

function buildAfternoonPayload(filters: PushFilters | null): NotificationPayload | null {
  const date = todayIso();
  const all = screeningsMatchingFilters(getScreeningsForDate(date) as ScreeningLike[], filters);
  const evening = all.filter((s) => s.time && s.time >= "16:30");
  if (evening.length === 0) return null;
  const sample = evening.slice(0, 3).map((s) => `${formatTime(s.time)} ${s.title}`);
  const body = evening.length <= 3 ? sample.join(" · ") : `${sample.join(" · ")} und ${evening.length - 3} weitere`;
  return {
    title: `Heute Abend: ${evening.length} Vorstellung${evening.length === 1 ? "" : "en"}`,
    body,
    url: `${APP_URL}/tag/${date}`,
    tag: `afternoon-${date}`,
  };
}

function buildWeeklyPayload(filters: PushFilters | null): NotificationPayload | null {
  const from = todayIso();
  const to = dateOffset(6);
  const screenings = screeningsMatchingFilters(getScreeningsInRange(from, to) as ScreeningLike[], filters);
  if (screenings.length === 0) return null;
  const byDate = new Map<string, number>();
  for (const s of screenings) byDate.set(s.date, (byDate.get(s.date) ?? 0) + 1);
  const peak = [...byDate.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    title: `Diese Woche: ${screenings.length} Vorstellungen`,
    body: peak ? `Höhepunkt ${peak[0]}: ${peak[1]} Filme` : "Wochenüberblick verfügbar",
    url: `${APP_URL}/tag/${from}`,
    tag: `weekly-${from}`,
  };
}

function buildPayload(schedule: Schedule, filters: PushFilters | null): NotificationPayload | null {
  if (schedule === "morning") return buildMorningPayload(filters);
  if (schedule === "afternoon") return buildAfternoonPayload(filters);
  return buildWeeklyPayload(filters);
}

function vapidFromEnv(env: Env): VapidKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT ?? "mailto:feedback@lichtspiel.haus",
  };
}

export async function dispatchDigest(env: Env, schedule: Schedule): Promise<void> {
  const vapid = vapidFromEnv(env);
  if (!vapid) {
    console.warn("VAPID keys missing — skipping dispatch");
    return;
  }

  const rows = await env.DB.prepare(
    `SELECT id, endpoint, p256dh, auth, schedule, filters_json FROM push_subscriptions
     WHERE schedule = ?1 AND failed_at IS NULL`,
  )
    .bind(schedule)
    .all<SubRow>();

  const subs = rows.results ?? [];
  if (subs.length === 0) {
    console.log(`No subscribers for ${schedule}`);
    return;
  }

  const goneIds: number[] = [];
  const sentIds: number[] = [];
  let skipped = 0;

  await Promise.all(
    subs.map(async (sub) => {
      const filters = parseFilters(sub.filters_json);
      const payload = buildPayload(schedule, filters);
      if (!payload) {
        skipped++;
        return;
      }
      try {
        const res = await sendPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          vapid,
          { urgency: "normal", topic: schedule, ttl: 60 * 60 * 12 },
        );
        if (res.gone) goneIds.push(sub.id);
        else if (res.ok) sentIds.push(sub.id);
        else console.warn(`push ${sub.endpoint} → ${res.status} ${res.body ?? ""}`);
      } catch (err) {
        console.error(`push ${sub.endpoint} threw`, err);
      }
    }),
  );

  if (goneIds.length > 0) {
    await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id IN (${goneIds.map(() => "?").join(",")})`)
      .bind(...goneIds)
      .run();
  }
  if (sentIds.length > 0) {
    await env.DB.prepare(
      `UPDATE push_subscriptions SET last_sent_at = datetime('now')
       WHERE id IN (${sentIds.map(() => "?").join(",")})`,
    )
      .bind(...sentIds)
      .run();
  }
  console.log(
    `${schedule}: sent ${sentIds.length}, skipped ${skipped} (no matching screenings), pruned ${goneIds.length}`,
  );
}
