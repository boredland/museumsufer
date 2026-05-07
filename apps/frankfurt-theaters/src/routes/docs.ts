import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Frankfurt Theater API",
    description:
      "Public API for theater performances in Frankfurt am Main. Aggregates 23 venues — schauspiel, opera, cabaret, dance, children's theater. The underlying data is regenerated hourly between 09:00 and 21:00 Europe/Berlin by a GitHub Action that redeploys the worker on each meaningful change.",
    version: "1.0.0",
    contact: { url: "https://github.com/boredland/museumsufer" },
    license: { name: "MIT", url: "https://github.com/boredland/museumsufer/blob/main/LICENSE" },
  },
  servers: [{ url: "https://frankfurt.ins.theater" }],
  tags: [
    { name: "Programme", description: "What's playing on a given date or range" },
    { name: "Theaters", description: "Theater directory + per-theater performances" },
    { name: "Calendar", description: "Subscribable .ics feeds" },
  ],
  paths: {
    "/api/day": {
      get: {
        tags: ["Programme"],
        summary: "Day overview",
        description: "All performances scheduled on a given date (default: today, Europe/Berlin).",
        operationId: "getDay",
        parameters: [
          {
            name: "date",
            in: "query",
            schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            description: "ISO date (YYYY-MM-DD). Defaults to today.",
          },
        ],
        responses: {
          "200": {
            description: "Day data",
            content: { "application/json": { schema: { $ref: "#/components/schemas/DayResponse" } } },
          },
        },
      },
    },
    "/api/theaters": {
      get: {
        tags: ["Theaters"],
        summary: "Theater directory",
        description: "Returns the list of all aggregated theaters with their address and metadata.",
        operationId: "getTheaters",
        responses: {
          "200": {
            description: "Theater list",
            content: { "application/json": { schema: { $ref: "#/components/schemas/TheaterListResponse" } } },
          },
        },
      },
    },
    "/api/theater/{slug}": {
      get: {
        tags: ["Theaters"],
        summary: "Single theater + upcoming performances",
        operationId: "getTheater",
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Theater slug (e.g. die-kaes, schauspiel-frankfurt)",
          },
        ],
        responses: {
          "200": {
            description: "Theater + next 60 days of performances",
            content: { "application/json": { schema: { $ref: "#/components/schemas/TheaterResponse" } } },
          },
          "404": { description: "Theater not found" },
        },
      },
    },
    "/api/performances": {
      get: {
        tags: ["Programme"],
        summary: "Performances in a date range",
        description: "Filter by date range and optionally a single theater. Range is capped at 60 days.",
        operationId: "getPerformances",
        parameters: [
          {
            name: "from",
            in: "query",
            schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            description: "Start date (inclusive). Defaults to today.",
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            description: "End date (inclusive). Defaults to today + 14.",
          },
          {
            name: "theater",
            in: "query",
            schema: { type: "string" },
            description: "Filter to a single theater slug",
          },
        ],
        responses: {
          "200": {
            description: "Performance list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    from: { type: "string", format: "date" },
                    to: { type: "string", format: "date" },
                    theater: { type: ["string", "null"] },
                    performances: { type: "array", items: { $ref: "#/components/schemas/Performance" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/performance/{id}": {
      get: {
        tags: ["Programme"],
        summary: "Single performance",
        operationId: "getPerformance",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, description: "Performance ID" },
        ],
        responses: {
          "200": {
            description: "Performance",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { performance: { $ref: "#/components/schemas/Performance" } },
                },
              },
            },
          },
          "404": { description: "Performance not found" },
        },
      },
    },
    "/feed.ics": {
      get: {
        tags: ["Calendar"],
        summary: "iCal feed (next 14 days, all theaters)",
        operationId: "getFeedIcs",
        responses: { "200": { description: "iCalendar (text/calendar)" } },
      },
    },
    "/theater/{slug}/feed.ics": {
      get: {
        tags: ["Calendar"],
        summary: "Per-theater iCal feed",
        operationId: "getTheaterIcs",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "iCalendar (text/calendar)" } },
      },
    },
    "/performance/{id}/feed.ics": {
      get: {
        tags: ["Calendar"],
        summary: "Single performance .ics",
        operationId: "getPerformanceIcs",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "iCalendar (text/calendar)" } },
      },
    },
  },
  components: {
    schemas: {
      Performance: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description:
              "Stable FNV-1a hash of (theater_slug, show_slug, date, time, venue_room). Survives across scrapes; safe to use in deep-link URLs.",
          },
          show_id: { type: "integer", description: "Matches Show.id." },
          date: { type: "string", format: "date" },
          time: { type: ["string", "null"], description: "HH:MM, Europe/Berlin" },
          end_time: { type: ["string", "null"] },
          venue_room: { type: ["string", "null"] },
          ticket_url: { type: ["string", "null"] },
          status: {
            type: "string",
            enum: ["unknown", "available", "few_left", "sold_out", "cancelled"],
          },
          price_min: { type: ["number", "null"] },
          price_max: { type: ["number", "null"] },
          currency: { type: ["string", "null"] },
          show: { $ref: "#/components/schemas/Show" },
          theater: { $ref: "#/components/schemas/TheaterRef" },
        },
      },
      Show: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Stable FNV-1a hash of (theater_slug, show_slug). Survives across scrapes.",
          },
          theater_slug: { type: "string" },
          slug: { type: "string" },
          title: { type: "string" },
          subtitle: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          image_url: { type: ["string", "null"] },
          detail_url: { type: ["string", "null"] },
        },
      },
      TheaterRef: {
        type: "object",
        properties: {
          slug: { type: "string" },
          name: { type: "string" },
          website_url: { type: ["string", "null"] },
        },
      },
      Theater: {
        type: "object",
        properties: {
          slug: { type: "string" },
          name: { type: "string" },
          address: { type: ["string", "null"] },
          lat: { type: ["number", "null"] },
          lon: { type: ["number", "null"] },
          website_url: { type: ["string", "null"] },
          ticketing_provider: { type: ["string", "null"] },
        },
      },
      DayResponse: {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
          performances: { type: "array", items: { $ref: "#/components/schemas/Performance" } },
        },
      },
      TheaterListResponse: {
        type: "object",
        properties: {
          theaters: { type: "array", items: { $ref: "#/components/schemas/Theater" } },
        },
      },
      TheaterResponse: {
        type: "object",
        properties: {
          theater: { $ref: "#/components/schemas/Theater" },
          performances: { type: "array", items: { $ref: "#/components/schemas/Performance" } },
        },
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
    pageTitle: "Frankfurt Theater API",
  }),
);

export default app;
