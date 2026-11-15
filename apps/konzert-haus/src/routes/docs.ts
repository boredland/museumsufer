import { cityUrl } from "@museumsufer/core";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

const spec = {
  openapi: "3.1.0",
  info: {
    title: "konzert.haus API",
    description:
      "Public API for concert events. Each city has its own subdomain (<city>.konzert.haus) and every endpoint defaults to the city of the host you call. Classical, jazz, sacred, world, experimental and chamber music — no pop or rock. Underlying data refreshes hourly via a GitHub Action.",
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
    "/api/day": {
      get: {
        tags: ["Events"],
        summary: "Events for a date",
        description: "Returns `{date, count, events}` for the given day. Defaults to the host's city. Optional filters: venue, genre, city.",
        operationId: "getDay",
        parameters: [
          {
            name: "date",
            in: "query",
            schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            description: "ISO date (defaults to today in Europe/Berlin)",
          },
          { name: "venue", in: "query", schema: { type: "string" }, description: "Venue slug" },
          { name: "genre", in: "query", schema: { type: "string" }, description: "Genre key" },
          { name: "city", in: "query", schema: { type: "string" }, description: "City key (defaults to the host's city)" },
        ],
        responses: { "200": { description: "Day events" } },
      },
    },
    "/api/events": {
      get: {
        tags: ["Events"],
        summary: "Event search",
        description: "Filter by date, range, venue, genre, or city. Defaults to the host's city.",
        operationId: "getEvents",
        parameters: [
          { name: "date", in: "query", schema: { type: "string" }, description: "Single ISO date" },
          { name: "from", in: "query", schema: { type: "string" }, description: "Range start (defaults today)" },
          { name: "to", in: "query", schema: { type: "string" }, description: "Range end (defaults today+60)" },
          { name: "venue", in: "query", schema: { type: "string" }, description: "Venue slug" },
          { name: "genre", in: "query", schema: { type: "string" }, description: "Genre key" },
          { name: "city", in: "query", schema: { type: "string" }, description: "City key (defaults to the host's city)" },
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

app.get("/openapi.json", (c) => {
  const city = c.get("city") ?? "frankfurt";
  return c.json(
    { ...spec, servers: [{ url: cityUrl("konzert.haus", city) }] },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
});

app.get(
  "/",
  Scalar({
    url: "/api/docs/openapi.json",
    theme: "saturn",
    pageTitle: "konzert.haus API",
  }),
);

export default app;
