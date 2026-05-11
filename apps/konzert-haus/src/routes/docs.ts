import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

const spec = {
  openapi: "3.1.0",
  info: {
    title: "konzert.haus API",
    description:
      "Public API for concert events in Frankfurt and the Rhein-Main region. Classical, jazz, sacred, world, experimental and chamber music — no pop or rock. Underlying data refreshes hourly via a GitHub Action.",
    version: "1.0.0",
    contact: { url: "https://github.com/boredland/museumsufer" },
    license: { name: "MIT", url: "https://github.com/boredland/museumsufer/blob/main/LICENSE" },
  },
  servers: [{ url: "https://frankfurt.konzert.haus" }],
  tags: [
    { name: "Events", description: "Concert events queries" },
    { name: "Venues", description: "Venue directory" },
    { name: "Calendar", description: "Subscribable .ics feeds" },
  ],
  paths: {
    "/api/events": {
      get: {
        tags: ["Events"],
        summary: "Event search",
        description: "Filter by date, range, venue, genre, or city.",
        operationId: "getEvents",
        parameters: [
          { name: "date", in: "query", schema: { type: "string" }, description: "Single ISO date" },
          { name: "from", in: "query", schema: { type: "string" }, description: "Range start (defaults today)" },
          { name: "to", in: "query", schema: { type: "string" }, description: "Range end (defaults today+60)" },
          { name: "venue", in: "query", schema: { type: "string" }, description: "Venue slug" },
          { name: "genre", in: "query", schema: { type: "string" }, description: "Genre key" },
          { name: "city", in: "query", schema: { type: "string" }, description: "City key" },
        ],
        responses: { "200": { description: "Event list" } },
      },
    },
    "/api/events/{id}": {
      get: {
        tags: ["Events"],
        summary: "Single event",
        operationId: "getEvent",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Event" }, "404": { description: "Not found" } },
      },
    },
    "/api/venues": {
      get: {
        tags: ["Venues"],
        summary: "Venue directory",
        operationId: "getVenues",
        responses: { "200": { description: "Venue list" } },
      },
    },
    "/api/venues/{slug}": {
      get: {
        tags: ["Venues"],
        summary: "Single venue + upcoming events",
        operationId: "getVenue",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Venue + events" }, "404": { description: "Not found" } },
      },
    },
    "/feed.ics": {
      get: { tags: ["Calendar"], summary: "Global iCal (14d)", responses: { "200": { description: "iCalendar" } } },
    },
    "/spielort/{slug}/feed.ics": {
      get: {
        tags: ["Calendar"],
        summary: "Per-venue iCal (60d)",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "iCalendar" } },
      },
    },
    "/genre/{slug}/feed.ics": {
      get: {
        tags: ["Calendar"],
        summary: "Per-genre iCal (60d)",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "iCalendar" } },
      },
    },
  },
};

app.get("/openapi.json", (c) => c.json(spec, { headers: { "Cache-Control": "public, max-age=86400" } }));

app.get(
  "/",
  Scalar({
    url: "/api/docs/openapi.json",
    theme: "saturn",
    pageTitle: "konzert.haus API",
  }),
);

export default app;
