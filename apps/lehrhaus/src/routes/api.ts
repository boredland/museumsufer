import { dateOffset, handleContactRequest, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { getEventById, getEventsForDate, getEventsInRange, getSourceBySlug } from "../db";
import { SCRAPE_DATA } from "../scrape-data";
import { type Env, parseCategory } from "../types";

const FEEDBACK_FROM = "no-reply@lehr.salon";
const FEEDBACK_TO = "feedback@lehr.salon";

const app = new Hono<{ Bindings: Env }>();

const DAY_HEADERS = {
  "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600",
};

app.get("/api/day", (c) => {
  const date = c.req.query("date") ?? todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "invalid date" }, 400);
  const source = c.req.query("source") ?? null;
  const category = parseCategory(c.req.query("format"));
  const events = getEventsForDate(date, { source, category });
  return c.json({ date, count: events.length, events }, { headers: DAY_HEADERS });
});

app.get("/api/events", (c) => {
  const today = todayIso();
  const date = c.req.query("date");
  const from = c.req.query("from") ?? today;
  const to = c.req.query("to") ?? dateOffset(60);
  const source = c.req.query("source") ?? null;
  const category = parseCategory(c.req.query("format"));

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "invalid date" }, 400);
    const events = getEventsForDate(date, { source, category });
    return c.json({ date, events }, { headers: DAY_HEADERS });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return c.json({ error: "invalid date range" }, 400);
  }
  if (from > to) return c.json({ error: "from > to" }, 400);
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (span > 90) return c.json({ error: "range too large (max 90 days)" }, 400);
  const events = getEventsInRange(from, to, { source, category });
  return c.json({ from, to, source, format: category, events }, { headers: DAY_HEADERS });
});

app.get("/api/events/:id{[0-9]+}", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const event = getEventById(id);
  if (!event) return c.json({ error: "not found" }, 404);
  return c.json({ event }, { headers: DAY_HEADERS });
});

app.get("/api/sources", (c) =>
  c.json(
    {
      sources: SCRAPE_DATA.sources.map((s) => ({
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
  ),
);

app.get("/api/sources/:slug{[^.]+}", (c) => {
  const slug = c.req.param("slug");
  const source = getSourceBySlug(slug);
  if (!source) return c.json({ error: "not found" }, 404);
  const events = getEventsInRange(todayIso(), dateOffset(60), { source: slug });
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
