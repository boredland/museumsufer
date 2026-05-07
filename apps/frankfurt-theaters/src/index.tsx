import { dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { getDatesWithPerformances, getPerformancesForDate } from "./db";
import { renderPage, renderProgrammePartial } from "./frontend";
import { renderDayMarkdown, wantsMarkdown } from "./markdown";
import apiRoutes from "./routes/api";
import docsRoutes from "./routes/docs";
import feedsRoutes from "./routes/feeds";
import imprintRoutes from "./routes/imprint";
import ogRoutes from "./routes/og";
import staticRoutes from "./routes/static";
import theaterRoutes from "./routes/theater";
import { runAll, runOne } from "./scrape-runner";
import { SERVICE_WORKER_JS } from "./service-worker";
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
  // Keep crawl budget on content pages — JSON data endpoints are not for indexing.
  // /api/docs is a content page (Scalar UI) and is allowlisted via the path check.
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/") && !path.startsWith("/api/docs")) {
    c.header("X-Robots-Tag", "noindex");
  }
  c.header(
    "Link",
    [
      '</.well-known/api-catalog>; rel=api-catalog; type="application/linkset+json"',
      '</api/docs/openapi.json>; rel=service-desc; type="application/openapi+json"',
      '</api/docs>; rel=service-doc; type="text/html"',
      '</llms.txt>; rel=describedby; type="text/plain"; title="LLM Instructions"',
    ].join(", "),
    { append: true },
  );
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
  if (wantsMarkdown(c.req.raw)) {
    return c.body(renderDayMarkdown(date, performances), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=1800",
      },
    });
  }
  return c.html(renderPage({ date, today, performances, dateStrip }), {
    headers: { "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600" },
  });
});

app.get("/sw.js", (c) =>
  c.body(SERVICE_WORKER_JS, {
    headers: { "Content-Type": "application/javascript", "Cache-Control": "no-cache" },
  }),
);

app.get("/partial/programme", async (c) => {
  const date = c.req.query("date") || todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.text("invalid date", 400);
  const performances = await getPerformancesForDate(c.env.DB, date);
  return c.html(renderProgrammePartial(date, performances), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=900" },
  });
});

app.route("/", staticRoutes);
app.route("/", apiRoutes);
app.route("/", feedsRoutes);
app.route("/", theaterRoutes);
app.route("/", imprintRoutes);
app.route("/", ogRoutes);
app.route("/api/docs", docsRoutes);

function requireScrapeAuth(c: { env: Env; req: { header(name: string): string | undefined } }): boolean {
  if (!c.env.SCRAPE_SECRET) return false;
  return c.req.header("authorization") === `Bearer ${c.env.SCRAPE_SECRET}`;
}

app.post("/scrape/all", async (c) => {
  if (!requireScrapeAuth(c)) return c.json({ error: "unauthorized" }, 401);
  const summary = await runAll(c.env);
  return c.json({ ok: true, summary });
});

app.post("/scrape/:slug", async (c) => {
  if (!requireScrapeAuth(c)) return c.json({ error: "unauthorized" }, 401);
  const summary = await runOne(c.env, c.req.param("slug"));
  return c.json({ ok: summary.ok, summary });
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runAll(env).then((summary) => {
        console.log("Scheduled scrape summary:", JSON.stringify(summary));
        const cutoff = dateOffset(-1);
        return env.DB.prepare("DELETE FROM performances WHERE date < ?1").bind(cutoff).run();
      }),
    );
  },
};
