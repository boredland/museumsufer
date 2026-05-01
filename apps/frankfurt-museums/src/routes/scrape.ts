import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { scrapeMuseumWebsites } from "../event-scraper";
import { scrapeMuseumExhibitions } from "../exhibition-scraper";
import { scrape } from "../scraper";
import { translateEvents } from "../translate";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

const auth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (!c.env.SCRAPE_SECRET) return next();
  const header = c.req.header("Authorization");
  if (header === `Bearer ${c.env.SCRAPE_SECRET}`) return next();
  return c.json({ error: "unauthorized" }, 401);
});

app.post("/", auth, async (c) => c.json(await scrape(c.env)));
app.post("/exhibitions", auth, async (c) => c.json(await scrapeMuseumExhibitions(c.env)));
app.post("/events", auth, async (c) => c.json(await scrapeMuseumWebsites(c.env)));
app.post("/translate", auth, async (c) => c.json(await translateEvents(c.env)));

export default app;
