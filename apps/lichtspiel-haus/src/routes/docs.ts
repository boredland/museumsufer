import { cityHost, cityMeta, cityName, cityUrl } from "@museumsufer/core";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { localizeTranslations } from "../i18n";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

const spec = {
  openapi: "3.1.0",
  info: {
    title: "lichtspiel.haus API",
    description:
      "Public API for cinema screenings. Each city has its own subdomain (<city>.lichtspiel.haus) and every endpoint defaults to the city of the host you call. Arthouse, programmkino, repertoire, festivals and film series. Underlying data refreshes multiple times daily via a GitHub Action.",
    version: "1.0.0",
    contact: { url: "https://github.com/boredland/museumsufer" },
    license: { name: "MIT", url: "https://github.com/boredland/museumsufer/blob/main/LICENSE" },
  },
  servers: [{ url: "https://frankfurt.lichtspiel.haus" }],
  tags: [
    { name: "Screenings", description: "Cinema screening queries" },
    { name: "Cinemas", description: "Cinema directory" },
    { name: "Series", description: "Film series and festivals" },
    { name: "Calendar", description: "Subscribable .ics feeds" },
  ],
  paths: {
    "/api/day": {
      get: {
        tags: ["Screenings"],
        summary: "Screenings for a date",
        description: "Returns `{date, count, screenings}` for the given day. Defaults to the host's city. Optional filters: cinema, series, city.",
        operationId: "getDay",
        parameters: [
          {
            name: "date",
            in: "query",
            schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            description: "ISO date (defaults to today in the city's local time: Europe/Berlin or Europe/Madrid)",
          },
          { name: "cinema", in: "query", schema: { type: "string" }, description: "Cinema slug" },
          { name: "series", in: "query", schema: { type: "string" }, description: "Series slug" },
          { name: "city", in: "query", schema: { type: "string" }, description: "City key (defaults to the host's city)" },
        ],
        responses: { "200": { description: "Day screenings" } },
      },
    },
    "/api/screenings": {
      get: {
        tags: ["Screenings"],
        summary: "Screening search",
        description: "Filter by date, range, cinema, series, or city. Defaults to the host's city.",
        operationId: "getScreenings",
        parameters: [
          { name: "date", in: "query", schema: { type: "string" }, description: "Single ISO date" },
          { name: "from", in: "query", schema: { type: "string" }, description: "Range start (defaults today)" },
          { name: "to", in: "query", schema: { type: "string" }, description: "Range end (defaults today+60)" },
          { name: "cinema", in: "query", schema: { type: "string" }, description: "Cinema slug" },
          { name: "series", in: "query", schema: { type: "string" }, description: "Series slug" },
          { name: "city", in: "query", schema: { type: "string" }, description: "City key (defaults to the host's city)" },
        ],
        responses: { "200": { description: "Screening list" } },
      },
    },
    "/api/screenings/{id}": {
      get: {
        tags: ["Screenings"],
        summary: "Single screening",
        operationId: "getScreening",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Screening" }, "404": { description: "Not found" } },
      },
    },
    "/api/cinemas": {
      get: {
        tags: ["Cinemas"],
        summary: "Cinema directory",
        operationId: "getCinemas",
        responses: { "200": { description: "Cinema list" } },
      },
    },
    "/api/cinemas/{slug}": {
      get: {
        tags: ["Cinemas"],
        summary: "Single cinema + upcoming screenings",
        operationId: "getCinema",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Cinema + screenings" }, "404": { description: "Not found" } },
      },
    },
    "/api/series": {
      get: {
        tags: ["Series"],
        summary: "Film series directory",
        description: "Series with screenings in the host's city. Pass `city` to override.",
        operationId: "getSeries",
        parameters: [
          { name: "city", in: "query", schema: { type: "string" }, description: "City key (defaults to the host's city)" },
        ],
        responses: { "200": { description: "Series list" } },
      },
    },
    "/api/series/{slug}": {
      get: {
        tags: ["Series"],
        summary: "Single series + screenings",
        operationId: "getSeriesBySlug",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Series + screenings" }, "404": { description: "Not found" } },
      },
    },
    "/feed.ics": {
      get: { tags: ["Calendar"], summary: "Global iCal (14d)", responses: { "200": { description: "iCalendar" } } },
    },
    "/kino/{slug}/feed.ics": {
      get: {
        tags: ["Calendar"],
        summary: "Per-cinema iCal (60d)",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "iCalendar" } },
      },
    },
    "/reihe/{slug}/feed.ics": {
      get: {
        tags: ["Calendar"],
        summary: "Per-series iCal",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "iCalendar" } },
      },
    },
  },
};

app.get("/openapi.json", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const specWithServer = {
    ...spec,
    servers: [{ url: cityUrl("lichtspiel.haus", city) }],
  };
  return c.json(specWithServer, { headers: { "Cache-Control": "public, max-age=86400" } });
});

app.get(
  "/",
  Scalar({
    url: "/api/docs/openapi.json",
    theme: "saturn",
    pageTitle: "lichtspiel.haus API",
  }),
);

export default app;
