import { dateOffset, handleContactRequest, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { getPerformanceById, getPerformancesForDate, getPerformancesInRange } from "../db";
import { THEATERS } from "../theater-config";
import type { Env } from "../types";

const FEEDBACK_FROM = "no-reply@ins.theater";
const FEEDBACK_TO = "info@jonas-strassel.de";

const app = new Hono<{ Bindings: Env }>();

const DAY_HEADERS = {
  "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600",
};

app.get("/api/day", async (c) => {
  const date = c.req.query("date") || todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "invalid date" }, 400);
  const performances = await getPerformancesForDate(date);
  return c.json({ date, performances }, { headers: DAY_HEADERS });
});

app.get("/api/theaters", (c) =>
  c.json(
    {
      theaters: THEATERS.map((t) => ({
        slug: t.slug,
        name: t.name,
        address: t.address,
        lat: t.lat,
        lon: t.lon,
        website_url: t.website_url,
        ticketing_provider: t.ticketing_provider,
        detail_url: `/theater/${t.slug}`,
        ics_url: `/theater/${t.slug}/feed.ics`,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  ),
);

app.get("/api/theater/:slug{[^.]+}", async (c) => {
  const slug = c.req.param("slug");
  const config = THEATERS.find((t) => t.slug === slug);
  if (!config) return c.json({ error: "not found" }, 404);
  const performances = await getPerformancesInRange(todayIso(), dateOffset(60), slug);
  return c.json({ theater: config, performances }, { headers: DAY_HEADERS });
});

app.get("/api/performances", async (c) => {
  const today = todayIso();
  const from = c.req.query("from") || today;
  const to = c.req.query("to") || dateOffset(14);
  const theater = c.req.query("theater") || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return c.json({ error: "invalid date range" }, 400);
  }
  if (from > to) return c.json({ error: "from > to" }, 400);
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (span > 60) return c.json({ error: "range too large (max 60 days)" }, 400);
  const performances = await getPerformancesInRange(from, to, theater);
  return c.json({ from, to, theater, performances }, { headers: DAY_HEADERS });
});

app.get("/api/performance/:id{[0-9]+}", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const perf = await getPerformanceById(id);
  if (!perf) return c.json({ error: "not found" }, 404);
  return c.json({ performance: perf }, { headers: DAY_HEADERS });
});

app.post("/api/contact", (c) =>
  handleContactRequest({
    request: c.req.raw,
    env: c.env,
    app: "frankfurt-theaters",
    from: FEEDBACK_FROM,
    to: FEEDBACK_TO,
  }),
);

export default app;
