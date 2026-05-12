/**
 * Shared route handlers for Web Push subscription management. Each app mounts
 * these on its Hono router; the handlers expect a D1 `push_subscriptions`
 * table with the schema in apps/*\/migrations/000?_push_subscriptions.sql.
 *
 * The schedule set is fixed: morning / afternoon / weekly. To diverge, copy
 * the helpers out instead of adding more knobs here.
 */

const SCHEDULES = ["morning", "afternoon", "weekly"] as const;
export type PushSchedule = (typeof SCHEDULES)[number];

/** Worker env slice expected by every push handler. */
export interface PushEnv {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
}

function isSchedule(v: unknown): v is PushSchedule {
  return typeof v === "string" && (SCHEDULES as readonly string[]).includes(v);
}

interface ParsedSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  schedules: PushSchedule[];
  /** Opaque per-app filter blob — null means "no filter, notify on all events". */
  filters: Record<string, unknown> | null;
}

function parseSubscriptionBody(body: unknown): ParsedSubscription | string {
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
  const schedules: PushSchedule[] = [];
  for (const s of b.schedules) {
    if (!isSchedule(s)) return `invalid schedule: ${String(s)}`;
    if (!schedules.includes(s)) schedules.push(s);
  }

  let filters: Record<string, unknown> | null = null;
  if (b.filters != null) {
    if (typeof b.filters !== "object" || Array.isArray(b.filters)) return "filters must be an object";
    const blob = JSON.stringify(b.filters);
    if (blob.length > 4096) return "filters too large";
    filters = b.filters as Record<string, unknown>;
  }

  return { endpoint: b.endpoint, p256dh: keys.p256dh, auth: keys.auth, schedules, filters };
}

/** GET /api/push/key — returns the app's VAPID public key. */
export function handlePushKeyRequest(env: PushEnv): Response {
  if (!env.VAPID_PUBLIC_KEY) return Response.json({ error: "VAPID not configured" }, { status: 503 });
  return Response.json({ publicKey: env.VAPID_PUBLIC_KEY }, { headers: { "Cache-Control": "public, max-age=3600" } });
}

/**
 * POST /api/push/subscribe — upserts one row per schedule and prunes rows
 * outside the new schedule set so the modal stays authoritative.
 */
export async function handlePushSubscribeRequest(request: Request, env: PushEnv): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = parseSubscriptionBody(body);
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });

  const ua = request.headers.get("user-agent");
  const filtersJson = parsed.filters ? JSON.stringify(parsed.filters) : null;
  const stmts = parsed.schedules.map((schedule) =>
    env.DB.prepare(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, schedule, user_agent, filters_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (endpoint, schedule) DO UPDATE SET
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         filters_json = excluded.filters_json,
         failed_at = NULL`,
    ).bind(parsed.endpoint, parsed.p256dh, parsed.auth, schedule, ua, filtersJson),
  );

  const keepList = parsed.schedules.map((s) => `'${s}'`).join(",");
  stmts.push(
    env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?1 AND schedule NOT IN (${keepList})`).bind(
      parsed.endpoint,
    ),
  );

  await env.DB.batch(stmts);
  return Response.json({ ok: true, schedules: parsed.schedules });
}

/** POST /api/push/unsubscribe — removes every row for the endpoint. */
export async function handlePushUnsubscribeRequest(request: Request, env: PushEnv): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint || typeof body.endpoint !== "string") {
    return Response.json({ error: "endpoint required" }, { status: 400 });
  }
  await env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?1`).bind(body.endpoint).run();
  return Response.json({ ok: true });
}

/**
 * GET /api/push/me?endpoint=… — reports which schedules an endpoint is on and
 * the (shared) filters the user chose. All rows for one endpoint share the same
 * filters_json since the subscribe handler writes the same blob to each row.
 */
export async function handlePushMeRequest(request: Request, env: PushEnv): Promise<Response> {
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) return Response.json({ schedules: [], filters: null });
  const rows = await env.DB.prepare(
    `SELECT schedule, filters_json FROM push_subscriptions WHERE endpoint = ?1 AND failed_at IS NULL`,
  )
    .bind(endpoint)
    .all<{ schedule: PushSchedule; filters_json: string | null }>();
  const results = rows.results ?? [];
  const filters = results.find((r) => r.filters_json)?.filters_json ?? null;
  return Response.json({
    schedules: results.map((r) => r.schedule),
    filters: filters ? safeParseJson(filters) : null,
  });
}

function safeParseJson(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
