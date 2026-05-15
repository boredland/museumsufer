import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

const spec = {
  openapi: "3.1.0",
  info: {
    title: "lehrhaus API",
    description:
      "Public API for lectures, readings, and discussions in Frankfurt am Main. Aggregates from universities, academies, foundations, and salons. Underlying data refreshes multiple times daily via a GitHub Action.",
    version: "1.0.0",
    contact: { url: "https://github.com/boredland/museumsufer" },
    license: { name: "MIT", url: "https://github.com/boredland/museumsufer/blob/main/LICENSE" },
  },
  servers: [{ url: "https://frankfurt.lehrhaus.app" }],
  tags: [
    { name: "Events", description: "Lecture and discussion event queries" },
    { name: "Sources", description: "Lecture-hosting institutions" },
    { name: "Calendar", description: "Subscribable .ics feeds" },
  ],
  paths: {
    "/api/day": {
      get: {
        tags: ["Events"],
        summary: "Events for a date",
        description: "Returns `{date, count, events}` for the given day. Optional filters: source, format.",
        operationId: "getDay",
        parameters: [
          {
            name: "date",
            in: "query",
            schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            description: "ISO date (defaults to today in Europe/Berlin)",
          },
          { name: "source", in: "query", schema: { type: "string" }, description: "Source slug" },
          {
            name: "format",
            in: "query",
            schema: { type: "string", enum: ["Vortrag", "Diskussion", "Lesung"] },
            description: "Event format",
          },
        ],
        responses: { "200": { description: "Day events" } },
      },
    },
    "/api/events": {
      get: {
        tags: ["Events"],
        summary: "Event search",
        description: "Filter by date, range, source, or format.",
        operationId: "getEvents",
        parameters: [
          { name: "date", in: "query", schema: { type: "string" }, description: "Single ISO date" },
          { name: "from", in: "query", schema: { type: "string" }, description: "Range start (defaults today)" },
          { name: "to", in: "query", schema: { type: "string" }, description: "Range end (defaults today+60)" },
          { name: "source", in: "query", schema: { type: "string" }, description: "Source slug" },
          {
            name: "format",
            in: "query",
            schema: { type: "string", enum: ["Vortrag", "Diskussion", "Lesung"] },
            description: "Event format",
          },
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
    "/api/sources": {
      get: {
        tags: ["Sources"],
        summary: "Source directory",
        operationId: "getSources",
        responses: { "200": { description: "Source list" } },
      },
    },
    "/api/sources/{slug}": {
      get: {
        tags: ["Sources"],
        summary: "Single source + upcoming events",
        operationId: "getSource",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Source + events" }, "404": { description: "Not found" } },
      },
    },
    "/feed.ics": {
      get: { tags: ["Calendar"], summary: "Global iCal (14d)", responses: { "200": { description: "iCalendar" } } },
    },
    "/quelle/{slug}/feed.ics": {
      get: {
        tags: ["Calendar"],
        summary: "Per-source iCal (60d)",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "iCalendar" } },
      },
    },
    "/format/{slug}/feed.ics": {
      get: {
        tags: ["Calendar"],
        summary: "Per-format iCal (60d)",
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
    pageTitle: "lehrhaus API",
  }),
);

export default app;
