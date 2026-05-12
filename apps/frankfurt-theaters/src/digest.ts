import { dateOffset, sendPush, todayIso, type VapidKeys } from "@museumsufer/core";
import { type DayPerformance, getPerformancesForDate, getPerformancesInRange } from "./db";
import { THEATERS } from "./theater-config";
import type { Env } from "./types";

export type Schedule = "morning" | "afternoon" | "weekly";

const APP_URL = "https://frankfurt.ins.theater";
const THEATER_SLUGS = new Set(THEATERS.map((t) => t.slug));

interface SubRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  schedule: Schedule;
  filters_json: string | null;
}

interface TheatersFilters {
  theaters?: string[];
}

function parseFilters(json: string | null): TheatersFilters | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    if (!v || typeof v !== "object") return null;
    if (!Array.isArray((v as { theaters?: unknown }).theaters)) return null;
    const slugs = ((v as { theaters: unknown[] }).theaters as unknown[]).filter(
      (t): t is string => typeof t === "string" && THEATER_SLUGS.has(t),
    );
    return slugs.length === 0 ? null : { theaters: slugs };
  } catch {
    return null;
  }
}

function perfsMatching(perfs: DayPerformance[], filters: TheatersFilters | null): DayPerformance[] {
  if (!filters?.theaters || filters.theaters.length === 0) return perfs;
  const allowed = new Set(filters.theaters);
  return perfs.filter((p) => allowed.has(p.theater.slug));
}

function berlinHour(d: Date): number {
  const h = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "numeric",
    hour12: false,
  })
    .formatToParts(d)
    .find((p) => p.type === "hour")?.value;
  return h ? parseInt(h, 10) : -1;
}

function berlinWeekday(d: Date): number {
  const w = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "short",
  })
    .formatToParts(d)
    .find((p) => p.type === "weekday")?.value;
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(w ?? "");
}

/**
 * Pick the schedule a cron tick is for, or null if it's a duplicate firing
 * that doesn't match the local hour in Europe/Berlin (covers CET/CEST).
 */
export function scheduleForNow(now: Date): Schedule | null {
  const h = berlinHour(now);
  const wd = berlinWeekday(now);
  if (wd === 0 && h === 9) return "weekly";
  if (h === 7) return "morning";
  if (h === 17) return "afternoon";
  return null;
}

function formatTime(t: string | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

interface NotificationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

async function buildMorningPayload(filters: TheatersFilters | null): Promise<NotificationPayload | null> {
  const date = todayIso();
  const perfs = perfsMatching(await getPerformancesForDate(date), filters);
  if (perfs.length === 0) return null;
  const sample = perfs.slice(0, 3).map((p) => {
    const time = formatTime(p.time);
    return time ? `${time} ${p.show.title}` : p.show.title;
  });
  const body = perfs.length <= 3 ? sample.join(" · ") : `${sample.join(" · ")} und ${perfs.length - 3} weitere`;
  return {
    title: `Heute: ${perfs.length} Vorstellung${perfs.length === 1 ? "" : "en"}`,
    body,
    url: `${APP_URL}/?date=${date}`,
    tag: `morning-${date}`,
  };
}

async function buildAfternoonPayload(filters: TheatersFilters | null): Promise<NotificationPayload | null> {
  const date = todayIso();
  const all = perfsMatching(await getPerformancesForDate(date), filters);
  const evening = all.filter((p) => p.time && p.time >= "17:00" && p.status !== "cancelled");
  if (evening.length === 0) return null;
  const sample = evening.slice(0, 3).map((p) => `${formatTime(p.time)} ${p.show.title}`);
  const body = evening.length <= 3 ? sample.join(" · ") : `${sample.join(" · ")} und ${evening.length - 3} weitere`;
  return {
    title: `Heute Abend: ${evening.length} Vorstellung${evening.length === 1 ? "" : "en"}`,
    body,
    url: `${APP_URL}/?date=${date}`,
    tag: `afternoon-${date}`,
  };
}

async function buildWeeklyPayload(filters: TheatersFilters | null): Promise<NotificationPayload | null> {
  const from = todayIso();
  const to = dateOffset(6);
  const perfs = perfsMatching(await getPerformancesInRange(from, to), filters);
  if (perfs.length === 0) return null;
  const byDate = new Map<string, number>();
  for (const p of perfs) byDate.set(p.date, (byDate.get(p.date) ?? 0) + 1);
  const peak = [...byDate.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    title: `Diese Woche: ${perfs.length} Vorstellungen`,
    body: peak ? `Höhepunkt ${peak[0]}: ${peak[1]} Vorstellungen` : "Wochenüberblick verfügbar",
    url: `${APP_URL}/?date=${from}`,
    tag: `weekly-${from}`,
  };
}

async function buildPayload(schedule: Schedule, filters: TheatersFilters | null): Promise<NotificationPayload | null> {
  if (schedule === "morning") return buildMorningPayload(filters);
  if (schedule === "afternoon") return buildAfternoonPayload(filters);
  return buildWeeklyPayload(filters);
}

function vapidFromEnv(env: Env): VapidKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT ?? "mailto:feedback@ins.theater",
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
      const payload = await buildPayload(schedule, filters);
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
  console.log(`${schedule}: sent ${sentIds.length}, skipped ${skipped} (no matching events), pruned ${goneIds.length}`);
}
