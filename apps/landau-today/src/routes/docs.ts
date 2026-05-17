import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { CATEGORIES } from "../categories";
import { APP_URL } from "../shared";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

const categoryEnum = CATEGORIES.map((c) => c.slug);

const spec = {
  openapi: "3.1.0",
  info: {
    title: "landau.today API",
    description:
      "Aggregated event calendar for Landau in der Pfalz and the Südliche Weinstraße. Data is refreshed daily ~06:30 UTC from six public sources (Kulturnetz Landau, Stadt Landau, Hambacher Schloss, RPTU, Pfalz.de, Südliche Weinstraße Tourismus).",
    version: "1.0.0",
    contact: { url: "https://github.com/boredland/museumsufer/tree/main/apps/landau-today" },
  },
  servers: [{ url: APP_URL }],
  paths: {
    "/api/day": {
      get: {
        summary: "Events for a date",
        description:
          "Returns all events on `date`, optionally filtered by `category`. Past events on today's date are pruned at request time using the Berlin clock.",
        operationId: "getDay",
        parameters: [
          {
            name: "date",
            in: "query",
            schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            description: "ISO date (defaults to today in Europe/Berlin)",
          },
          {
            name: "category",
            in: "query",
            schema: { type: "string", enum: categoryEnum },
            description: "Filter to one of the 16 unified category slugs",
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
    "/event/{id}/feed.ics": {
      get: {
        summary: "Event as ICS",
        description: "Single event as a downloadable iCalendar (RFC 5545) file.",
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
        description: "RSS 2.0 feed of events for the next 7 days.",
        operationId: "getRssFeed",
        responses: {
          "200": { description: "RSS XML", content: { "application/rss+xml": { schema: { type: "string" } } } },
        },
      },
    },
    "/feed.ics": {
      get: {
        summary: "ICS calendar feed",
        description: `Subscribable iCalendar feed of events for the next 14 days. Use webcal://${APP_URL.replace(/^https?:\/\//, "")}/feed.ics`,
        operationId: "getIcsFeed",
        responses: {
          "200": { description: "ICS file", content: { "text/calendar": { schema: { type: "string" } } } },
        },
      },
    },
    "/llms.txt": {
      get: {
        summary: "LLM agent description",
        description: "Plain-text site description for AI agents (sources, API surface, categories).",
        operationId: "getLlmsTxt",
        responses: {
          "200": { description: "Plain text", content: { "text/plain": { schema: { type: "string" } } } },
        },
      },
    },
  },
  components: {
    schemas: {
      Event: {
        type: "object",
        required: ["id", "source", "source_uid", "title", "date", "category", "detail_url"],
        properties: {
          id: { type: "integer", description: "FNV-1a hash of (source, source_uid)" },
          source: {
            type: "string",
            enum: ["kulturnetz-landau", "landau-de", "hambacher-schloss", "rptu-campuskultur", "suew", "pfalz-de"],
          },
          source_uid: { type: "string", description: "Stable upstream identifier" },
          title: { type: "string" },
          date: { type: "string", format: "date" },
          time: { type: "string", nullable: true, example: "19:30" },
          end_date: { type: "string", format: "date", nullable: true },
          end_time: { type: "string", nullable: true, example: "22:00" },
          category: { type: "string", enum: categoryEnum },
          venue: { type: "string", nullable: true, example: "Stiftskirche Landau" },
          city: { type: "string", nullable: true, example: "Landau in der Pfalz" },
          organizer: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          detail_url: { type: "string", format: "uri" },
          image_url: { type: "string", format: "uri", nullable: true },
          price: { type: "string", nullable: true, example: "frei · 12 € erm." },
          featured: { type: "boolean", nullable: true },
          lat: { type: "number", nullable: true, example: 49.198 },
          lng: { type: "number", nullable: true, example: 8.117 },
        },
      },
      DayResponse: {
        type: "object",
        required: ["date", "count", "events"],
        properties: {
          date: { type: "string", format: "date" },
          count: { type: "integer" },
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
    pageTitle: "landau.today API",
  }),
);

export default app;
