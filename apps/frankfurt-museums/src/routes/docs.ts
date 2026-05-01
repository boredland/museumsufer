import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Museumsufer Frankfurt API",
    description:
      "Public API for museum exhibitions and events in Frankfurt's Museumsufer district. Data is refreshed daily at 6am UTC.",
    version: "1.0.0",
    contact: { url: "https://github.com/boredland/museumsufer" },
  },
  servers: [{ url: "https://museumsufer.app" }],
  paths: {
    "/api/day": {
      get: {
        summary: "Day overview",
        description: "Returns exhibitions and events for a given date.",
        operationId: "getDay",
        parameters: [
          {
            name: "date",
            in: "query",
            schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            description: "ISO date (defaults to today in Europe/Berlin)",
          },
          {
            name: "lang",
            in: "query",
            schema: { type: "string", enum: ["de", "en", "fr"] },
            description: "Response language (defaults to de)",
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
    "/api/events": {
      get: {
        summary: "Events for a date",
        description: "Returns all events scheduled for a given date, sorted by time.",
        operationId: "getEvents",
        parameters: [
          {
            name: "date",
            in: "query",
            schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            description: "ISO date (defaults to today)",
          },
          {
            name: "lang",
            in: "query",
            schema: { type: "string", enum: ["de", "en", "fr"] },
            description: "Response language (defaults to de)",
          },
        ],
        responses: {
          "200": {
            description: "Event list",
            content: {
              "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Event" } } },
            },
          },
        },
      },
    },
    "/api/exhibitions": {
      get: {
        summary: "Exhibitions for a date",
        description: "Returns all exhibitions active on a given date.",
        operationId: "getExhibitions",
        parameters: [
          {
            name: "date",
            in: "query",
            schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            description: "ISO date (defaults to today)",
          },
          {
            name: "lang",
            in: "query",
            schema: { type: "string", enum: ["de", "en", "fr"] },
            description: "Response language (defaults to de)",
          },
        ],
        responses: {
          "200": {
            description: "Exhibition list",
            content: {
              "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Exhibition" } } },
            },
          },
        },
      },
    },
    "/api/museums": {
      get: {
        summary: "All museums",
        description: "Returns all museums in the Museumsufer district.",
        operationId: "getMuseums",
        responses: {
          "200": {
            description: "Museum list",
            content: {
              "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Museum" } } },
            },
          },
        },
      },
    },
    "/api/event/{id}.ics": {
      get: {
        summary: "Event as ICS",
        description: "Downloads a single event as an ICS calendar file.",
        operationId: "getEventIcs",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, description: "Event ID" }],
        responses: {
          "200": { description: "ICS file", content: { "text/calendar": { schema: { type: "string" } } } },
          "404": { description: "Event not found" },
        },
      },
    },
    "/feed.xml": {
      get: {
        summary: "RSS feed",
        description: "RSS feed of events for the next 7 days.",
        operationId: "getRssFeed",
        responses: {
          "200": { description: "RSS XML", content: { "application/rss+xml": { schema: { type: "string" } } } },
        },
      },
    },
    "/feed.ics": {
      get: {
        summary: "ICS calendar feed",
        description:
          "ICS calendar feed of events for the next 7 days. Subscribable via webcal://museumsufer.app/feed.ics",
        operationId: "getIcsFeed",
        responses: { "200": { description: "ICS file", content: { "text/calendar": { schema: { type: "string" } } } } },
      },
    },
  },
  components: {
    schemas: {
      Event: {
        type: "object",
        properties: {
          id: { type: "integer" },
          museum_id: { type: "integer" },
          title: { type: "string" },
          date: { type: "string", format: "date" },
          time: { type: "string", nullable: true, example: "14:00" },
          end_time: { type: "string", nullable: true, example: "16:00" },
          end_date: { type: "string", format: "date", nullable: true },
          description: { type: "string", nullable: true },
          url: { type: "string", format: "uri", nullable: true },
          detail_url: { type: "string", format: "uri", nullable: true },
          image_url: { type: "string", format: "uri", nullable: true },
          price: { type: "string", nullable: true, example: "8 €, erm. 4 €" },
          museum_name: { type: "string" },
          museum_slug: { type: "string" },
          like_count: { type: "integer" },
          translated: { type: "boolean" },
        },
      },
      Exhibition: {
        type: "object",
        properties: {
          id: { type: "integer" },
          museum_id: { type: "integer" },
          title: { type: "string" },
          start_date: { type: "string", format: "date", nullable: true },
          end_date: { type: "string", format: "date", nullable: true },
          description: { type: "string", nullable: true },
          image_url: { type: "string", format: "uri", nullable: true },
          detail_url: { type: "string", format: "uri", nullable: true },
          museum_name: { type: "string" },
          museum_slug: { type: "string" },
          like_count: { type: "integer" },
          translated: { type: "boolean" },
        },
      },
      Museum: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          slug: { type: "string" },
          museumsufer_url: { type: "string", format: "uri" },
          website_url: { type: "string", format: "uri", nullable: true },
          opening_hours: { type: "string", nullable: true },
        },
      },
      DayResponse: {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
          exhibitions: { type: "array", items: { $ref: "#/components/schemas/Exhibition" } },
          events: { type: "array", items: { $ref: "#/components/schemas/Event" } },
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
    pageTitle: "Museumsufer API",
  }),
);

export default app;
