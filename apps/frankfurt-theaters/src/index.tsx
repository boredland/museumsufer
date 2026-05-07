import { dateOffset, securityHeaders, todayIso } from "@museumsufer/core";
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
import { SERVICE_WORKER_JS } from "./service-worker";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.use("*", securityHeaders());

// Theater-specific response headers: X-Robots-Tag on data API, Link header
// pointing at the API discovery surfaces.
app.use("*", async (c, next) => {
  await next();
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
    getPerformancesForDate(date),
    getDatesWithPerformances(today, dateOffset(60)),
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
  const performances = await getPerformancesForDate(date);
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

// Scraping moved to a GitHub Action (.github/workflows/scrape.yml) — it runs
// scripts/scrape.ts in Bun, regenerates src/scrape-data.ts, and commits to
// trigger a Cloudflare redeploy. No more SCRAPE_SECRET, /scrape/* routes,
// or scheduled() handler in the worker.

export default app;
