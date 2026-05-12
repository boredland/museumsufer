import { Hono } from "hono";
import { CATEGORIES, isCategorySlug } from "../categories";
import { todayIso } from "../date";
import { getEventById, getEventsForDate, getEventsForRange } from "../queries";
import { APP_URL } from "../shared";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

const DAY_HEADERS = {
  "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600",
};

app.get("/api/events", (c) => {
  const today = todayIso();
  const date = c.req.query("date");
  const from = c.req.query("from") ?? today;
  const to = c.req.query("to") ?? addDays(today, 30);
  const rawCat = c.req.query("category");
  const category = rawCat && isCategorySlug(rawCat) ? rawCat : undefined;

  if (date) {
    if (!isIsoDate(date)) return c.json({ error: "invalid date" }, 400);
    const events = getEventsForDate(date, category);
    return c.json({ date, count: events.length, events }, { headers: DAY_HEADERS });
  }

  if (!isIsoDate(from) || !isIsoDate(to)) return c.json({ error: "invalid date range" }, 400);
  if (from > to) return c.json({ error: "from > to" }, 400);
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (span > 90) return c.json({ error: "range too large (max 90 days)" }, 400);
  const events = getEventsForRange(from, to, category);
  return c.json({ from, to, category: category ?? null, count: events.length, events }, { headers: DAY_HEADERS });
});

app.get("/api/events/:id{[0-9]+}", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);
  const event = getEventById(id);
  if (!event) return c.json({ error: "not found" }, 404);
  return c.json({ event }, { headers: DAY_HEADERS });
});

app.get("/api/categories", (c) =>
  c.json(
    {
      categories: CATEGORIES.map((cat) => ({
        slug: cat.slug,
        label: cat.label,
        short: cat.short,
        glyph: cat.glyph,
        detail_url: `${APP_URL}/c/${cat.slug}`,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  ),
);

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default app;
