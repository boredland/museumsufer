import { sendPush, type VapidKeys } from "@museumsufer/core";
import { isCategorySlug } from "./categories";
import { todayIso } from "./date";
import { getEventsForDate, getEventsForRange } from "./queries";
import type { Env } from "./types";

export type Schedule = "morning" | "afternoon" | "weekly";

const APP_URL = "https://landau.today";

interface SubRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  schedule: Schedule;
  filters_json: string | null;
}

interface LandauFilters {
  categories?: string[];
}

function parseFilters(json: string | null): LandauFilters | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    if (!v || typeof v !== "object") return null;
    if (!Array.isArray((v as { categories?: unknown }).categories)) return null;
    const cats = ((v as { categories: unknown[] }).categories as unknown[]).filter(
      (c): c is string => typeof c === "string" && isCategorySlug(c),
    );
    return cats.length === 0 ? null : { categories: cats };
  } catch {
    return null;
  }
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

export function scheduleForNow(now: Date): Schedule | null {
  const h = berlinHour(now);
  const wd = berlinWeekday(now);
  if (wd === 0 && h === 9) return "weekly";
  if (h === 7) return "morning";
  if (h === 17) return "afternoon";
  return null;
}

interface NotificationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

function formatTime(t: string | undefined): string {
  return t ? t.slice(0, 5) : "";
}

interface EventLike {
  date: string;
  time?: string;
  title: string;
  category: string;
}

function eventsMatchingFilters(events: EventLike[], filters: LandauFilters | null): EventLike[] {
  if (!filters?.categories || filters.categories.length === 0) return events;
  const allowed = new Set(filters.categories);
  return events.filter((e) => allowed.has(e.category));
}

function buildMorningPayload(filters: LandauFilters | null): NotificationPayload | null {
  const date = todayIso();
  const events = eventsMatchingFilters(getEventsForDate(date) as EventLike[], filters);
  if (events.length === 0) return null;
  const sample = events.slice(0, 3).map((e) => {
    const time = formatTime(e.time);
    return time ? `${time} ${e.title}` : e.title;
  });
  const body = events.length <= 3 ? sample.join(" · ") : `${sample.join(" · ")} +${events.length - 3} weitere`;
  return {
    title: `Heute in Landau: ${events.length} Termin${events.length === 1 ? "" : "e"}`,
    body,
    url: `${APP_URL}/?date=${date}`,
    tag: `morning-${date}`,
  };
}

function buildAfternoonPayload(filters: LandauFilters | null): NotificationPayload | null {
  const date = todayIso();
  const all = eventsMatchingFilters(getEventsForDate(date) as EventLike[], filters);
  const evening = all.filter((e) => e.time && e.time >= "17:00");
  if (evening.length === 0) return null;
  const sample = evening.slice(0, 3).map((e) => `${formatTime(e.time)} ${e.title}`);
  const body = evening.length <= 3 ? sample.join(" · ") : `${sample.join(" · ")} +${evening.length - 3} weitere`;
  return {
    title: `Heute Abend: ${evening.length} Termin${evening.length === 1 ? "" : "e"}`,
    body,
    url: `${APP_URL}/?date=${date}`,
    tag: `afternoon-${date}`,
  };
}

function buildWeeklyPayload(filters: LandauFilters | null): NotificationPayload | null {
  const from = todayIso();
  const toDate = new Date(`${from}T12:00:00Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 6);
  const to = toDate.toISOString().slice(0, 10);
  const events = eventsMatchingFilters(getEventsForRange(from, to) as EventLike[], filters);
  if (events.length === 0) return null;
  const byDate = new Map<string, number>();
  for (const e of events) byDate.set(e.date, (byDate.get(e.date) ?? 0) + 1);
  const peak = [...byDate.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    title: `Diese Woche in Landau: ${events.length} Termine`,
    body: peak ? `Stärkster Tag ${peak[0]}: ${peak[1]} Termine` : "Wochenüberblick verfügbar",
    url: `${APP_URL}/?date=${from}`,
    tag: `weekly-${from}`,
  };
}

function buildPayload(schedule: Schedule, filters: LandauFilters | null): NotificationPayload | null {
  if (schedule === "morning") return buildMorningPayload(filters);
  if (schedule === "afternoon") return buildAfternoonPayload(filters);
  return buildWeeklyPayload(filters);
}

function vapidFromEnv(env: Env): VapidKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT ?? "mailto:feedback@landau.today",
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
  console.log(`${schedule}: sent ${sentIds.length}, skipped ${skipped} (no matching events), pruned ${goneIds.length}`);
}
