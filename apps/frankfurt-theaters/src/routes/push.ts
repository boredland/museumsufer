import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

const SCHEDULES = ["morning", "afternoon", "weekly"] as const;
type Schedule = (typeof SCHEDULES)[number];

function isSchedule(v: unknown): v is Schedule {
  return typeof v === "string" && (SCHEDULES as readonly string[]).includes(v);
}

function parseSubscriptionBody(body: unknown):
  | {
      endpoint: string;
      p256dh: string;
      auth: string;
      schedules: Schedule[];
    }
  | string {
  if (!body || typeof body !== "object") return "body required";
  const b = body as Record<string, unknown>;
  if (typeof b.endpoint !== "string" || !b.endpoint.startsWith("https://")) {
    return "endpoint must be https URL";
  }
  if (b.endpoint.length > 2048) return "endpoint too long";
  const keys = b.keys as Record<string, unknown> | undefined;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
    return "keys.p256dh and keys.auth required";
  }
  if (!Array.isArray(b.schedules) || b.schedules.length === 0) {
    return "schedules must be a non-empty array";
  }
  const schedules: Schedule[] = [];
  for (const s of b.schedules) {
    if (!isSchedule(s)) return `invalid schedule: ${String(s)}`;
    if (!schedules.includes(s)) schedules.push(s);
  }
  return { endpoint: b.endpoint, p256dh: keys.p256dh, auth: keys.auth, schedules };
}

app.get("/api/push/key", (c) => {
  const key = (c.env as Env & { VAPID_PUBLIC_KEY?: string }).VAPID_PUBLIC_KEY;
  if (!key) return c.json({ error: "VAPID not configured" }, 503);
  return c.json({ publicKey: key }, { headers: { "Cache-Control": "public, max-age=3600" } });
});

app.post("/api/push/subscribe", async (c) => {
  const body = (await c.req.json().catch(() => null)) as unknown;
  const parsed = parseSubscriptionBody(body);
  if (typeof parsed === "string") return c.json({ error: parsed }, 400);

  const ua = c.req.header("user-agent") ?? null;
  const stmts = parsed.schedules.map((schedule) =>
    c.env.DB.prepare(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, schedule, user_agent)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (endpoint, schedule) DO UPDATE SET
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         failed_at = NULL`,
    ).bind(parsed.endpoint, parsed.p256dh, parsed.auth, schedule, ua),
  );

  // For any schedule not in the new set, delete the row so the modal stays
  // authoritative — toggling a checkbox off removes the subscription.
  const keepList = parsed.schedules.map((s) => `'${s}'`).join(",");
  stmts.push(
    c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?1 AND schedule NOT IN (${keepList})`).bind(
      parsed.endpoint,
    ),
  );

  await c.env.DB.batch(stmts);
  return c.json({ ok: true, schedules: parsed.schedules });
});

app.post("/api/push/unsubscribe", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint || typeof body.endpoint !== "string") {
    return c.json({ error: "endpoint required" }, 400);
  }
  await c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?1`).bind(body.endpoint).run();
  return c.json({ ok: true });
});

app.get("/api/push/me", async (c) => {
  const endpoint = c.req.query("endpoint");
  if (!endpoint) return c.json({ schedules: [] });
  const rows = await c.env.DB.prepare(
    `SELECT schedule FROM push_subscriptions WHERE endpoint = ?1 AND failed_at IS NULL`,
  )
    .bind(endpoint)
    .all<{ schedule: Schedule }>();
  return c.json({ schedules: (rows.results ?? []).map((r) => r.schedule) });
});

export default app;
