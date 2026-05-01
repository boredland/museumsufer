import { Hono } from "hono";
import { handleFeeds } from "../api";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

app.get("/feed.xml", async (c) => {
  const response = await handleFeeds(c.req.raw, c.env);
  return response ?? c.notFound();
});

app.get("/rss.xml", async (c) => {
  const response = await handleFeeds(c.req.raw, c.env);
  return response ?? c.notFound();
});

app.get("/feed.ics", async (c) => {
  const response = await handleFeeds(c.req.raw, c.env);
  return response ?? c.notFound();
});

app.get("/calendar.ics", async (c) => {
  const response = await handleFeeds(c.req.raw, c.env);
  return response ?? c.notFound();
});

export default app;
