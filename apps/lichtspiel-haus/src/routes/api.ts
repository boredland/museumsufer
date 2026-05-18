import { dateOffset, handleContactRequest, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { CINEMAS } from "../cinema-config";
import {
  getAllSeries,
  getCinemaBySlug,
  getScreeningById,
  getScreeningsForDate,
  getScreeningsInRange,
  getSeriesScreenings,
} from "../db";
import type { Env } from "../types";

const FEEDBACK_FROM = "no-reply@lichtspiel.haus";
const FEEDBACK_TO = "feedback@lichtspiel.haus";

const app = new Hono<{ Bindings: Env }>();

const DAY_HEADERS = {
  "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600",
};

app.get("/api/day", (c) => {
  const date = c.req.query("date") ?? todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "invalid date" }, 400);
  const cinema = c.req.query("cinema") ?? null;
  const city = c.req.query("city") ?? null;
  const series = c.req.query("series") ?? null;
  const screenings = getScreeningsForDate(date, { cinema, city, series });
  return c.json({ date, count: screenings.length, screenings }, { headers: DAY_HEADERS });
});

app.get("/api/screenings", (c) => {
  const today = todayIso();
  const date = c.req.query("date");
  const from = c.req.query("from") ?? today;
  const to = c.req.query("to") ?? dateOffset(60);
  const cinema = c.req.query("cinema") ?? null;
  const city = c.req.query("city") ?? null;
  const series = c.req.query("series") ?? null;

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "invalid date" }, 400);
    const screenings = getScreeningsForDate(date, { cinema, city, series });
    return c.json({ date, screenings }, { headers: DAY_HEADERS });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return c.json({ error: "invalid date range" }, 400);
  }
  if (from > to) return c.json({ error: "from > to" }, 400);
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (span > 90) return c.json({ error: "range too large (max 90 days)" }, 400);
  const screenings = getScreeningsInRange(from, to, { cinema, city, series });
  return c.json({ from, to, cinema, city, series, screenings }, { headers: DAY_HEADERS });
});

app.get("/api/screenings/:id{[0-9]+}", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const screening = getScreeningById(id);
  if (!screening) return c.json({ error: "not found" }, 404);
  return c.json({ screening }, { headers: DAY_HEADERS });
});

app.get("/api/cinemas", (c) =>
  c.json(
    {
      cinemas: CINEMAS.map((v) => ({
        slug: v.slug,
        name: v.name,
        short_name: v.short_name,
        address: v.address,
        lat: v.lat,
        lon: v.lon,
        city: v.city,
        website_url: v.website_url,
        detail_url: `/kino/${v.slug}`,
        ics_url: `/kino/${v.slug}/feed.ics`,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  ),
);

app.get("/api/cinemas/:slug{[^.]+}", (c) => {
  const slug = c.req.param("slug");
  const cinema = getCinemaBySlug(slug);
  if (!cinema) return c.json({ error: "not found" }, 404);
  const screenings = getScreeningsInRange(todayIso(), dateOffset(60), { cinema: slug });
  return c.json({ cinema, screenings }, { headers: DAY_HEADERS });
});

app.get("/api/series", (c) =>
  c.json(
    {
      series: getAllSeries(todayIso()).map((s) => ({
        ...s,
        detail_url: `/reihe/${s.slug}`,
        ics_url: `/reihe/${s.slug}/feed.ics`,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  ),
);

app.get("/api/series/:slug{[^.]+}", (c) => {
  const slug = c.req.param("slug");
  const screenings = getSeriesScreenings(slug, todayIso());
  if (screenings.length === 0) return c.json({ error: "not found" }, 404);
  const name = screenings[0].series?.name ?? slug;
  return c.json({ slug, name, screenings }, { headers: DAY_HEADERS });
});

app.post("/api/contact", (c) =>
  handleContactRequest({
    request: c.req.raw,
    env: c.env,
    app: "lichtspiel-haus",
    from: FEEDBACK_FROM,
    to: FEEDBACK_TO,
  }),
);

export default app;
