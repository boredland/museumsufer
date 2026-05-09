import { securityHeaders } from "@museumsufer/core";
import { Hono } from "hono";
import { isCategorySlug } from "./categories";
import { todayIso } from "./date";
import { renderPage } from "./frontend";
import { handleImageProxy } from "./image-proxy";
import { getCategoryCountsForDate, getEventCountsByDate, getEventsForDate } from "./queries";
import docsRoute from "./routes/docs";
import eventRoute from "./routes/event";
import feedsRoute from "./routes/feeds";
import staticRoute from "./routes/static";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  securityHeaders({
    permissionsPolicy: "geolocation=(self), microphone=(), camera=(), payment=()",
    csp: [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  }),
);

app.route("/", staticRoute);
app.route("/", feedsRoute);
app.route("/", eventRoute);
app.route("/api/docs", docsRoute);

app.get("/img/*", async (c) => (await handleImageProxy(c.req.raw)) ?? c.notFound());

// Home + category routes share a single renderer.
function renderForCategory(c: import("hono").Context, category?: string) {
  const date = c.req.query("date") || todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.html(`<p>Ungültiges Datum.</p>`, 400);
  if (category && !isCategorySlug(category)) return c.html(`<p>Unbekannte Kategorie.</p>`, 404);
  const events = getEventsForDate(date, category);
  const categoryCounts = getCategoryCountsForDate(date);
  const horizon = new Date(`${todayIso()}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 21);
  const dateCounts = getEventCountsByDate(todayIso(), horizon.toISOString().slice(0, 10));
  const html = renderPage({ date, category, events, categoryCounts, dateCounts });
  return c.html(html, 200, {
    "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=3600",
    "Content-Language": "de",
  });
}

app.get("/", (c) => renderForCategory(c));
app.get("/c/:cat", (c) => renderForCategory(c, c.req.param("cat")));

// JSON for clients / agents.
app.get("/api/day", (c) => {
  const date = c.req.query("date") || todayIso();
  const cat = c.req.query("category");
  const events = getEventsForDate(date, cat);
  return c.json({ date, count: events.length, events });
});

app.onError((err, c) => {
  console.error("Unhandled:", err);
  return c.html(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Fehler</title><link rel="stylesheet" href="/styles.css" /></head><body><main style="max-width:32rem;margin:6rem auto;padding:0 1rem"><h1 style="font-family:'Bodoni Moda',serif;font-style:italic">Etwas ist schief gegangen.</h1><p><a href="/">Zur Startseite</a></p></main></body></html>`,
    500,
  );
});

app.notFound((c) => {
  return c.html(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Nicht gefunden</title><link rel="stylesheet" href="/styles.css" /></head><body><header class="masthead"><h1><a href="/">Landau<span class="ampersand">&amp;</span>heute</a></h1></header><main style="max-width:32rem;margin:4rem auto;padding:0 1rem;text-align:center"><p style="font-family:'Bodoni Moda',serif;font-style:italic;font-size:1.25rem">Diese Seite existiert nicht.</p><p style="margin-top:2rem"><a href="/" style="border-bottom:1px solid currentColor">Zurück zum Programm</a></p></main></body></html>`,
    404,
  );
});

export default app;
