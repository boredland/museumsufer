import { EmailMessage } from "cloudflare:email";
import { buildFeedbackMime, dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { VENUES } from "../concert-config";
import { getEventById, getEventsForDate, getEventsInRange, getVenueBySlug } from "../db";
import { type Env, parseGenre } from "../types";

const FEEDBACK_FROM = "noreply@konzert.haus";
const FEEDBACK_TO = "info@jonas-strassel.de";

const app = new Hono<{ Bindings: Env }>();

const DAY_HEADERS = {
  "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600",
};

app.get("/api/events", (c) => {
  const today = todayIso();
  const date = c.req.query("date");
  const from = c.req.query("from") ?? today;
  const to = c.req.query("to") ?? dateOffset(60);
  const venue = c.req.query("venue") ?? null;
  const city = c.req.query("city") ?? null;
  const genre = parseGenre(c.req.query("genre"));

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "invalid date" }, 400);
    const events = getEventsForDate(date, { venue, city, genre });
    return c.json({ date, events }, { headers: DAY_HEADERS });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return c.json({ error: "invalid date range" }, 400);
  }
  if (from > to) return c.json({ error: "from > to" }, 400);
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (span > 90) return c.json({ error: "range too large (max 90 days)" }, 400);
  const events = getEventsInRange(from, to, { venue, city, genre });
  return c.json({ from, to, venue, city, genre, events }, { headers: DAY_HEADERS });
});

app.get("/api/events/:id{[0-9]+}", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const event = getEventById(id);
  if (!event) return c.json({ error: "not found" }, 404);
  return c.json({ event }, { headers: DAY_HEADERS });
});

app.get("/api/venues", (c) =>
  c.json(
    {
      venues: VENUES.map((v) => ({
        slug: v.slug,
        name: v.name,
        short_name: v.short_name,
        address: v.address,
        lat: v.lat,
        lon: v.lon,
        city: v.city,
        website_url: v.website_url,
        default_genre: v.default_genre,
        detail_url: `/spielort/${v.slug}`,
        ics_url: `/spielort/${v.slug}/feed.ics`,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  ),
);

app.get("/api/venues/:slug{[^.]+}", (c) => {
  const slug = c.req.param("slug");
  const venue = getVenueBySlug(slug);
  if (!venue) return c.json({ error: "not found" }, 404);
  const events = getEventsInRange(todayIso(), dateOffset(60), { venue: slug });
  return c.json({ venue, events }, { headers: DAY_HEADERS });
});

app.post("/api/contact", async (c) => {
  const body = (await c.req
    .json<{ category?: string; email?: string; message?: string; context?: string }>()
    .catch(() => null)) as { category?: string; email?: string; message?: string; context?: string } | null;
  if (!body?.message || body.message.length < 3) return c.json({ error: "message required" }, 400);
  if (body.message.length > 4000) return c.json({ error: "message too long" }, 400);

  const raw = buildFeedbackMime({
    from: FEEDBACK_FROM,
    to: FEEDBACK_TO,
    input: {
      app: "konzert-haus",
      category: body.category ?? null,
      email: body.email ?? null,
      message: body.message,
      context: body.context ?? null,
      userAgent: c.req.header("user-agent") ?? null,
      pageUrl: c.req.header("referer") ?? null,
    },
  });
  await c.env.FEEDBACK_EMAIL.send(new EmailMessage(FEEDBACK_FROM, FEEDBACK_TO, raw));
  return c.json({ ok: true });
});

export default app;
