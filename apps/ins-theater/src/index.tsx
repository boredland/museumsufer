import { dateOffset, securityHeaders, todayIso } from "@museumsufer/core";
import { cityMiddleware } from "@museumsufer/core/city-routing";
import { Hono } from "hono";
import { getDatesWithPerformances, getPerformancesForDate } from "./db";
import { dispatchDigest, scheduleForNow } from "./digest";
import { renderPage, renderProgrammePartial } from "./frontend";
import { handleImageProxy } from "./image-proxy";
import { renderDayMarkdown, wantsMarkdown } from "./markdown";
import apiRoutes from "./routes/api";
import docsRoutes from "./routes/docs";
import feedsRoutes from "./routes/feeds";
import imprintRoutes from "./routes/imprint";
import ogRoutes from "./routes/og";
import pushRoutes from "./routes/push";
import staticRoutes from "./routes/static";
import theaterRoutes from "./routes/theater";
import { SERVICE_WORKER_JS } from "./service-worker";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// 'unsafe-inline' is unavoidable while theme FOUC + HTMX lifecycle
// + inline behaviour scripts ship in <head>/<body>. Cloudflare auto-
// injects its Web Analytics beacon from static.cloudflareinsights.com,
// so that origin needs to be in script-src + connect-src or the CSP
// blocks it and Lighthouse best-practices drops to 0.93.
app.use(
  "*",
  securityHeaders({
    csp: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com",
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
    permissionsPolicy: "geolocation=(), camera=(), microphone=(), payment=()",
  }),
);

// Apex (ins.theater) → nearest city's subdomain (geo); `<city>.ins.theater` sets c.var.city.
app.use("*", cityMiddleware({ apex: "ins.theater", apexBehavior: "geo" }));

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

app.get("/img/*", async (c) => (await handleImageProxy(c.req.raw)) ?? c.notFound());

app.get("/", async (c) => {
  const date = c.req.query("date") || todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.text("invalid date", 400);
  const today = todayIso();
  const city = c.get("city") ?? "frankfurt";
  const [performances, dateStrip] = await Promise.all([
    getPerformancesForDate(date, city),
    getDatesWithPerformances(today, dateOffset(60), city),
  ]);
  if (wantsMarkdown(c.req.raw)) {
    return c.body(renderDayMarkdown(date, performances, city), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=1800",
      },
    });
  }
  return c.html(
    renderPage({ date, today, performances, dateStrip, city, turnstileSiteKey: c.env.TURNSTILE_SITE_KEY }),
    {
      headers: { "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600" },
    },
  );
});

app.get("/sw.js", (c) =>
  c.body(SERVICE_WORKER_JS, {
    headers: { "Content-Type": "application/javascript", "Cache-Control": "no-cache" },
  }),
);

app.get("/partial/content", async (c) => {
  const date = c.req.query("date") || todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.text("invalid date", 400);
  const city = c.get("city") ?? "frankfurt";
  const performances = await getPerformancesForDate(date, city);
  return c.html(renderProgrammePartial(date, performances, city), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=900" },
  });
});

app.route("/", staticRoutes);
app.route("/", apiRoutes);
app.route("/", pushRoutes);
app.route("/", feedsRoutes);
app.route("/", theaterRoutes);
app.route("/", imprintRoutes);
app.route("/", ogRoutes);
app.route("/api/docs", docsRoutes);

// Scraping moved to a GitHub Action (.github/workflows/scrape.yml) — it runs
// scripts/scrape.ts in Bun, regenerates src/scrape-data.ts, and commits to
// trigger a Cloudflare redeploy. No SCRAPE_SECRET / /scrape/* routes.
//
// The scheduled() handler is back, but only for digest push delivery —
// see ./digest.ts. Triggers are declared in wrangler.jsonc and fire at
// both CET and CEST candidate UTC times; scheduleForNow() picks the right
// digest based on the local Europe/Berlin hour and ignores the off-cycle
// firing.

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const schedule = scheduleForNow(new Date());
    if (!schedule) return;
    ctx.waitUntil(dispatchDigest(env, schedule));
  },
};
