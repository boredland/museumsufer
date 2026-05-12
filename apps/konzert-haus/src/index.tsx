import { dateOffset, securityHeaders, todayIso } from "@museumsufer/core";
import { type Context, Hono } from "hono";
import { getDatesWithEvents, getEventsForDate } from "./db";
import { dispatchDigest, scheduleForNow } from "./digest";
import { renderPage, renderProgrammePartial } from "./frontend";
import { detectLocale, getTranslations } from "./i18n";
import { handleImageProxy } from "./image-proxy";
import { renderDayMarkdown, wantsMarkdown } from "./markdown";
import apiRoutes from "./routes/api";
import docsRoutes from "./routes/docs";
import feedsRoutes from "./routes/feeds";
import genreRoutes from "./routes/genre";
import imprintRoutes from "./routes/imprint";
import ogRoutes from "./routes/og";
import pushRoutes from "./routes/push";
import staticRoutes from "./routes/static";
import venueRoutes from "./routes/venue";
import { SERVICE_WORKER_JS } from "./service-worker";
import { type Env, parseGenre } from "./types";

type AppEnv = { Bindings: Env; Variables: { city: string } };

const app = new Hono<AppEnv>();

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.use("*", securityHeaders());

app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const host = (c.req.header("host") ?? "").toLowerCase();
  if (host === "konzert.haus") {
    return c.redirect(`https://frankfurt.konzert.haus${url.pathname}${url.search}`, 301);
  }
  const city = host.endsWith(".konzert.haus") ? host.slice(0, -".konzert.haus".length) : "frankfurt";
  c.set("city", city);
  await next();
});

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

function renderHome(c: Context<AppEnv>, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.text("invalid date", 400);
  const today = todayIso();
  const genre = parseGenre(c.req.query("genre"));
  const city = c.get("city") ?? "frankfurt";
  const events = getEventsForDate(date, { city, genre });
  const dateStrip = getDatesWithEvents(today, dateOffset(60), { city });
  if (wantsMarkdown(c.req.raw)) {
    return c.body(renderDayMarkdown(date, events), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=1800",
      },
    });
  }
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  return c.html(
    renderPage({
      date,
      today,
      events,
      dateStrip,
      city,
      genre,
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
  const genre = parseGenre(c.req.query("genre"));
  const city = c.get("city") ?? "frankfurt";
  const events = getEventsForDate(date, { city, genre });
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  return c.html(renderProgrammePartial(date, events, tr), {
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
app.route("/", venueRoutes);
app.route("/", genreRoutes);
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
