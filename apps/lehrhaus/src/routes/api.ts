import { dateOffset, handleContactRequest, servesCity, todayIso } from "@museumsufer/core";
import { FRANKFURT_BBOX, HAMBURG_BBOX, inBbox } from "@museumsufer/event-hub";
import { Hono } from "hono";
import { getEventById, getEventsForDate, getEventsInRange, getSourceBySlug } from "../db";
import { SCRAPE_DATA } from "../scrape-data";
import { type AppEnv, type Env, parseCategory } from "../types";

const FEEDBACK_FROM = "no-reply@lehr.salon";
const FEEDBACK_TO = "feedback@lehr.salon";

const app = new Hono<AppEnv>();

const DAY_HEADERS = {
  "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600",
};

app.get("/api/day", (c) => {
  const date = c.req.query("date") ?? todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "invalid date" }, 400);
  const source = c.req.query("source") ?? null;
  const category = parseCategory(c.req.query("format"));
  const city = c.get("city") ?? "frankfurt";
  const events = getEventsForDate(date, { city, source, category });
  return c.json({ date, count: events.length, events }, { headers: DAY_HEADERS });
});

app.get("/api/events", (c) => {
  const today = todayIso();
  const date = c.req.query("date");
  const from = c.req.query("from") ?? today;
  const to = c.req.query("to") ?? dateOffset(60);
  const source = c.req.query("source") ?? null;
  const category = parseCategory(c.req.query("format"));
  const city = c.get("city") ?? "frankfurt";

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "invalid date" }, 400);
    const events = getEventsForDate(date, { city, source, category });
    return c.json({ date, events }, { headers: DAY_HEADERS });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return c.json({ error: "invalid date range" }, 400);
  }
  if (from > to) return c.json({ error: "from > to" }, 400);
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (span > 90) return c.json({ error: "range too large (max 90 days)" }, 400);
  const events = getEventsInRange(from, to, { city, source, category });
  return c.json({ from, to, source, format: category, events }, { headers: DAY_HEADERS });
});

app.get("/api/events/:id{[0-9]+}", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const event = getEventById(id);
  if (!event) return c.json({ error: "not found" }, 404);
  return c.json({ event }, { headers: DAY_HEADERS });
});

app.get("/api/sources", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const bbox = city === "hamburg" ? HAMBURG_BBOX : FRANKFURT_BBOX;
  const citySourceSlugs = new Set(SCRAPE_DATA.events.filter((e) => servesCity(e.city, city)).map((e) => e.source_slug));
  const filteredSources = SCRAPE_DATA.sources.filter((s) => {
    if (citySourceSlugs.has(s.slug)) return true;
    if (s.lat != null && s.lon != null && inBbox(s.lat, s.lon, bbox)) return true;
    return false;
  });

  return c.json(
    {
      sources: filteredSources.map((s) => ({
        slug: s.slug,
        name: s.name,
        short_name: s.short_name,
        lat: s.lat,
        lon: s.lon,
        url: s.url,
        detail_url: `/quelle/${s.slug}`,
        ics_url: `/quelle/${s.slug}/feed.ics`,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
});

app.get("/api/sources/:slug{[^.]+}", (c) => {
  const slug = c.req.param("slug");
  const source = getSourceBySlug(slug);
  if (!source) return c.json({ error: "not found" }, 404);
  const city = c.get("city") ?? "frankfurt";
  const events = getEventsInRange(todayIso(), dateOffset(60), { city, source: slug });
  return c.json({ source, events }, { headers: DAY_HEADERS });
});

app.post("/api/contact", (c) =>
  handleContactRequest({
    request: c.req.raw,
    env: c.env,
    app: "lehr.salon",
    from: FEEDBACK_FROM,
    to: FEEDBACK_TO,
  }),
);

export default app;
