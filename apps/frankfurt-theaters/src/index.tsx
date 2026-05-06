import { Hono } from "hono";
import { dateOffset, todayIso } from "./date";
import { getDatesWithPerformances, getPerformancesForDate } from "./db";
import { renderPage } from "./frontend";
import { runAll, runOne } from "./scrape-runner";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.use("*", async (c, next) => {
  await next();
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
});

app.get("/healthz", (c) => c.json({ ok: true }));

app.get("/", async (c) => {
  const date = c.req.query("date") || todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.text("invalid date", 400);
  const today = todayIso();
  const [performances, dateStrip] = await Promise.all([
    getPerformancesForDate(c.env.DB, date),
    getDatesWithPerformances(c.env.DB, today, dateOffset(60)),
  ]);
  return c.html(renderPage({ date, today, performances, dateStrip }));
});

app.get("/api/day", async (c) => {
  const date = c.req.query("date") || todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "invalid date" }, 400);
  const performances = await getPerformancesForDate(c.env.DB, date);
  return c.json({ date, performances });
});

app.post("/scrape/all", async (c) => {
  const auth = c.req.header("authorization");
  if (c.env.SCRAPE_SECRET && auth !== `Bearer ${c.env.SCRAPE_SECRET}`) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const summary = await runAll(c.env);
  return c.json({ ok: true, summary });
});

app.post("/scrape/:slug", async (c) => {
  const auth = c.req.header("authorization");
  if (c.env.SCRAPE_SECRET && auth !== `Bearer ${c.env.SCRAPE_SECRET}`) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const summary = await runOne(c.env, c.req.param("slug"));
  return c.json({ ok: summary.ok, summary });
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runAll(env).then((summary) => {
        console.log("Scheduled scrape summary:", JSON.stringify(summary));
        // Drop performances that are more than 1 day in the past
        const cutoff = dateOffset(-1);
        return env.DB.prepare("DELETE FROM performances WHERE date < ?1").bind(cutoff).run();
      }),
    );
  },
};
