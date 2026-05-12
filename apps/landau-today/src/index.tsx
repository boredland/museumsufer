import { handleContactRequest, securityHeaders } from "@museumsufer/core";
import { Hono } from "hono";
import { isCategorySlug } from "./categories";
import { todayIso } from "./date";
import { dispatchDigest, scheduleForNow } from "./digest";
import { renderPage, renderPartial } from "./frontend";
import { detectLocale, getTranslations } from "./i18n";
import { handleImageProxy } from "./image-proxy";
import { renderDayMarkdown, wantsMarkdown } from "./markdown";
import { getCategoryCountsForDate, getEventCountsByDate, getEventsForDate } from "./queries";
import apiRoute from "./routes/api";
import docsRoute from "./routes/docs";
import eventRoute from "./routes/event";
import feedsRoute from "./routes/feeds";
import imprintRoute from "./routes/imprint";
import ogRoute from "./routes/og";
import pushRoute from "./routes/push";
import staticRoute from "./routes/static";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

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

app.use(
  "*",
  securityHeaders({
    permissionsPolicy: "geolocation=(self), microphone=(), camera=(), payment=()",
    csp: [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
      "script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
      "frame-src https://challenges.cloudflare.com",
      "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  }),
);

app.route("/", staticRoute);
app.route("/", pushRoute);
app.route("/", feedsRoute);
app.route("/", eventRoute);
app.route("/", imprintRoute);
app.route("/", apiRoute);
app.route("/", ogRoute);
app.route("/api/docs", docsRoute);

app.get("/img/*", async (c) => (await handleImageProxy(c.req.raw)) ?? c.notFound());

app.post("/api/contact", (c) =>
  handleContactRequest({
    request: c.req.raw,
    env: c.env,
    app: "landau-today",
    from: "no-reply@landau.today",
    to: "feedback@landau.today",
  }),
);

// Home + category routes share a single renderer. /partial/content
// always returns just the swappable inner body so htmx can graft it
// into #content-body without flickering the masthead, search bar, or
// footer. The full-page routes serve renderPage() unconditionally —
// even when called by htmx — because the page entry shouldn't depend
// on a header that proxies/CDN caches might strip.
function buildProps(c: import("hono").Context<{ Bindings: Env }>, category?: string) {
  const date = c.req.query("date") || todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (category && !isCategorySlug(category)) return null;
  const events = getEventsForDate(date, category);
  const categoryCounts = getCategoryCountsForDate(date);
  const horizon = new Date(`${todayIso()}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 21);
  const dateCounts = getEventCountsByDate(todayIso(), horizon.toISOString().slice(0, 10));
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  return {
    date,
    category,
    events,
    categoryCounts,
    dateCounts,
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY,
    locale,
    tr,
  };
}

function renderForCategory(c: import("hono").Context<{ Bindings: Env }>, category?: string) {
  const props = buildProps(c, category);
  if (!props) {
    const tr = getTranslations(detectLocale(c.req.raw));
    return c.html(`<p>${tr.errInvalidRequest}</p>`, 400);
  }
  if (wantsMarkdown(c.req.raw)) {
    return c.body(renderDayMarkdown(props.date, props.events), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=1800",
      },
    });
  }
  return c.html(renderPage(props), 200, {
    "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=3600",
    "Content-Language": props.locale,
    Vary: "Accept-Language",
  });
}

app.get("/", (c) => renderForCategory(c));
app.get("/c/:cat", (c) => renderForCategory(c, c.req.param("cat")));

app.get("/partial/content", (c) => {
  const cat = c.req.query("category");
  const props = buildProps(c, cat);
  if (!props) {
    const tr = getTranslations(detectLocale(c.req.raw));
    return c.html(`<p>${tr.errInvalidRequest}</p>`, 400);
  }
  return c.html(renderPartial(props), 200, {
    "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=3600",
    "Content-Language": props.locale,
    Vary: "Accept-Language",
  });
});

// JSON for clients / agents.
app.get("/api/day", (c) => {
  const date = c.req.query("date") || todayIso();
  const cat = c.req.query("category");
  const events = getEventsForDate(date, cat);
  return c.json({ date, count: events.length, events });
});

app.onError((err, c) => {
  console.error("Unhandled:", err);
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const homeHref = locale === "fr" ? "/?lang=fr" : "/";
  return c.html(
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${tr.err500Title}</title><link rel="stylesheet" href="/styles.css" /></head><body><main style="max-width:32rem;margin:6rem auto;padding:0 1rem"><h1 style="font-family:'Bodoni Moda',serif;font-style:italic">${tr.err500Body}</h1><p><a href="${homeHref}">${tr.err500Back}</a></p></main></body></html>`,
    500,
  );
});

app.notFound((c) => {
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const homeHref = locale === "fr" ? "/?lang=fr" : "/";
  return c.html(
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${tr.err404Title}</title><link rel="stylesheet" href="/styles.css" /></head><body><header class="masthead"><h1><a href="${homeHref}">Landau<span class="ampersand">&amp;</span>heute</a></h1></header><main style="max-width:32rem;margin:4rem auto;padding:0 1rem;text-align:center"><p style="font-family:'Bodoni Moda',serif;font-style:italic;font-size:1.25rem">${tr.err404Body}</p><p style="margin-top:2rem"><a href="${homeHref}" style="border-bottom:1px solid currentColor">${tr.err404Back}</a></p></main></body></html>`,
    404,
  );
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const schedule = scheduleForNow(new Date());
    if (!schedule) return;
    ctx.waitUntil(dispatchDigest(env, schedule));
  },
};
