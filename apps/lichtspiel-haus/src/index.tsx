import { cityUrl, dateOffset, securityHeaders, todayIso } from "@museumsufer/core";
import { cityMiddleware } from "@museumsufer/core/city-routing";
import { type Context, Hono } from "hono";
import { getDatesWithScreenings, getScreeningsForDate, getScreeningsInRange } from "./db";
import { dispatchDigest, scheduleForNow } from "./digest";
import { renderPage, renderProgrammePartial } from "./frontend";
import { detectLocale, getTranslations, localizeTranslations } from "./i18n";
import { handleImageProxy } from "./image-proxy";
import { renderDayMarkdown, wantsMarkdown } from "./markdown";
import apiRoutes from "./routes/api";
import cinemaRoutes from "./routes/cinema";
import docsRoutes from "./routes/docs";
import feedsRoutes from "./routes/feeds";
import filmRoutes from "./routes/film";
import imprintRoutes from "./routes/imprint";
import ogRoutes from "./routes/og";
import pushRoutes from "./routes/push";
import seriesRoutes from "./routes/series";
import staticRoutes from "./routes/static";
import { SERVICE_WORKER_JS } from "./service-worker";
import type { Env } from "./types";

type AppEnv = { Bindings: Env; Variables: { city: string } };

const app = new Hono<AppEnv>();

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  // `no-store`: a 500 with no Cache-Control takes a heuristic TTL under Workers
  // Cache, which would keep serving the error long after the cause is fixed.
  return c.json({ error: "Internal server error" }, 500, { "Cache-Control": "no-store" });
});

// 'unsafe-inline' is unavoidable while the theme FOUC + HTMX lifecycle
// + seen-banner handlers are inlined into <head>/<body>; the other
// directives still provide defence-in-depth (locked-down object-src,
// no eval, explicit allow-list for the Turnstile challenge iframe).
app.use(
  "*",
  securityHeaders({
    csp: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://image.tmdb.org",
      "font-src 'self'",
      "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com",
      "frame-src https://challenges.cloudflare.com",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
    permissionsPolicy: "geolocation=(), camera=(), microphone=(), payment=()",
  }),
);

// Apex (lichtspiel.haus) redirects to the nearest city's subdomain using
// Cloudflare edge geolocation; `<city>.lichtspiel.haus` sets c.var.city.
app.use("*", cityMiddleware({ apex: "lichtspiel.haus", apexBehavior: "geo" }));

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

// `no-store` so this keeps answering from the Worker: a cached liveness probe
// reports health the origin may no longer have.
app.get("/healthz", (c) => c.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }));

app.get("/img/*", async (c) => (await handleImageProxy(c.req.raw)) ?? c.notFound());

/** Clamp the optional `?range=` to the allowed slate (7 or 14). Any other
 *  value (negative, absurd, non-numeric) yields null so the caller falls
 *  back to single-day rendering. */
function parseRange(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return n === 7 || n === 14 ? n : null;
}

/** Add `days - 1` to the start date so a 7-day range from 2026-05-19 ends
 *  on 2026-05-25 inclusive. Core's dateOffset is today-anchored, so we
 *  roll our own date arithmetic. */
function endOfRange(start: string, days: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days - 1);
  return d.toISOString().slice(0, 10);
}

function renderHome(c: Context<AppEnv>, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.text("invalid date", 400);
  const today = todayIso();
  const cinema = c.req.query("kino") || c.req.query("cinema") || null;
  const series = c.req.query("reihe") || c.req.query("series") || null;
  const range = parseRange(c.req.query("range") ?? undefined);
  const city = c.get("city") ?? "frankfurt";
  // Range anchors on the day in the URL so /tag/2026-06-01?range=7 shows
  // that week, not always "today + 7"; default home stays today-anchored.
  const screenings = range
    ? getScreeningsInRange(date, endOfRange(date, range), { city, cinema, series })
    : getScreeningsForDate(date, { city, cinema, series });
  const dateStrip = getDatesWithScreenings(today, dateOffset(60), { city, cinema, series });
  if (wantsMarkdown(c.req.raw)) {
    return c.body(renderDayMarkdown(date, screenings), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=1800",
      },
    });
  }
  const locale = detectLocale(c.req.raw);
  const tr = localizeTranslations(getTranslations(locale), city, locale);
  return c.html(
    renderPage({
      date,
      today,
      screenings,
      dateStrip,
      city,
      cinema,
      series,
      range,
      locale,
      tr,
      turnstileSiteKey: c.env.TURNSTILE_SITE_KEY,
    }),
    {
      headers: {
        "Content-Language": locale,
        "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600",
        Vary: "Accept-Language",
      },
    },
  );
}

app.get("/", (c) => renderHome(c, c.req.query("date") || todayIso()));
app.get("/tag/:date", (c) => renderHome(c, c.req.param("date")));

app.get("/partial/content", (c) => {
  const date = c.req.query("date") || todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.text("invalid date", 400);
  const cinema = c.req.query("kino") || c.req.query("cinema") || null;
  const series = c.req.query("reihe") || c.req.query("series") || null;
  const range = parseRange(c.req.query("range") ?? undefined);
  const city = c.get("city") ?? "frankfurt";
  const screenings = range
    ? getScreeningsInRange(date, endOfRange(date, range), { city, cinema, series })
    : getScreeningsForDate(date, { city, cinema, series });
  const locale = detectLocale(c.req.raw);
  const tr = localizeTranslations(getTranslations(locale), city, locale);
  const appUrl = cityUrl("lichtspiel.haus", city);
  return c.html(renderProgrammePartial(date, screenings, tr, locale, city, range, appUrl), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=900",
      "Content-Language": locale,
      Vary: "Accept-Language",
    },
  });
});

app.get("/sw.js", (c) =>
  c.body(SERVICE_WORKER_JS, {
    headers: { "Content-Type": "application/javascript", "Cache-Control": "no-cache" },
  }),
);

app.route("/", staticRoutes);
app.route("/", apiRoutes);
app.route("/", pushRoutes);
app.route("/", feedsRoutes);
app.route("/", cinemaRoutes);
app.route("/", seriesRoutes);
app.route("/", filmRoutes);
app.route("/", imprintRoutes);
app.route("/", ogRoutes);
app.route("/api/docs", docsRoutes);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const schedule = scheduleForNow(new Date());
    if (!schedule) return;
    ctx.waitUntil(dispatchDigest(env, schedule));
  },
};
