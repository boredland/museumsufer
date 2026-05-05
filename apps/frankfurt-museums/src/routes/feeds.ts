import { Hono } from "hono";
import { handleFeeds } from "../api";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

app.get("/feed.xml", async (c) => {
  const response = await handleFeeds(c.req.raw, c.env);
  return response ?? c.notFound();
});

app.get("/rss.xml", (c) => {
  return c.redirect("/feed.xml", 301);
});

app.get("/feed.ics", async (c) => {
  const response = await handleFeeds(c.req.raw, c.env);
  return response ?? c.notFound();
});

app.get("/calendar.ics", (c) => {
  return c.redirect("/feed.ics", 301);
});

export default app;
