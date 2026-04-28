import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  attachLikeCounts,
  buildIcs,
  fetchDayData,
  getEventsForDate,
  getExhibitionsForDate,
  getLikeCounts,
  getMuseumMap,
  handleLike,
  markTranslated,
  proxyImages,
} from "./api";
import { ContentBody } from "./components";
import { todayIso } from "./date";
import { scrapeMuseumWebsites } from "./event-scraper";
import { scrapeMuseumExhibitions } from "./exhibition-scraper";
import { type InitialData, renderPage } from "./frontend";
import { dateLocale, detectLocale, getTranslations, type Locale } from "./i18n";
import { handleImageProxy } from "./image-proxy";
import feedsRoute from "./routes/feeds";
import scrapeRoute from "./routes/scrape";
import staticRoute from "./routes/static";
import { scrape } from "./scraper";
import { formatDateFull } from "./shared";
import { translateEvents, translateFields } from "./translate";
import type { Env, Event, Exhibition } from "./types";

const dayQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  lang: z.enum(["de", "en", "fr"]).optional(),
  sort: z.string().optional(),
});

const app = new Hono<{ Bindings: Env }>();

// Error middleware
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// CORS middleware - restrict to museumsufer.app
app.use(
  "/api/*",
  cors({
    origin: ["https://museumsufer.app", "http://localhost:3000", "http://localhost:8787"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    maxAge: 600,
  }),
);

app.route("/", staticRoute);
app.route("/", feedsRoute);
app.route("/scrape", scrapeRoute);

app.get("/img/*", async (c) => {
  const response = await handleImageProxy(c.req.raw, c.env);
  if (response) return response;
  return c.notFound();
});

app.post("/api/transit", async (c) => {
  const body = await c.req.json<{ lat: number; lng: number }>().catch(() => null);
  if (!body?.lat || !body?.lng) return c.json({ error: "invalid" }, 400);

  const CENTER_LAT = 50.1092;
  const CENTER_LNG = 8.6819;
  const MAX_KM = 20;
  const dlat = (body.lat - CENTER_LAT) * 111.32;
  const dlng = (body.lng - CENTER_LNG) * 111.32 * Math.cos((CENTER_LAT * Math.PI) / 180);
  if (Math.sqrt(dlat * dlat + dlng * dlng) > MAX_KM)
    return c.json({}, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });

  const snapLat = Math.round(body.lat * 500) / 500;
  const snapLng = Math.round(body.lng * 500) / 500;
  const ox = Math.round(snapLng * 1e6);
  const oy = Math.round(snapLat * 1e6);
  const { getMuseumLocations: getLocs } = await import("./museum-config");
  const geo = getLocs();
  const slugs = Object.keys(geo);
  const result: Record<string, number> = {};

  const lidToSlugs = new Map<string, string[]>();
  const coordSlugs: string[] = [];
  for (const slug of slugs) {
    const m = geo[slug];
    if (m.rmvStopLid) {
      const existing = lidToSlugs.get(m.rmvStopLid);
      if (existing) existing.push(slug);
      else lidToSlugs.set(m.rmvStopLid, [slug]);
    } else {
      coordSlugs.push(slug);
    }
  }

  const uniqueLids = [...lidToSlugs.keys()];
  const queryItems = [
    ...uniqueLids.map((lid) => ({ key: lid, arrLoc: { lid } })),
    ...coordSlugs.map((slug) => {
      const m = geo[slug];
      return {
        key: slug,
        arrLoc: { type: "C" as const, crd: { x: Math.round(m.lng * 1e6), y: Math.round(m.lat * 1e6) } },
      };
    }),
  ];

  for (let i = 0; i < queryItems.length; i += 10) {
    const batch = queryItems.slice(i, i + 10);
    const svcReqL = batch.map((item) => ({
      meth: "TripSearch",
      req: {
        depLocL: [{ type: "C", crd: { x: ox, y: oy } }],
        arrLocL: [item.arrLoc],
        numF: 1,
        getPolyline: false,
      },
    }));
    try {
      const res = await fetch("https://www.rmv.de/auskunft/bin/jp/mgate.exe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cf: { cacheTtl: 86400, cacheEverything: true },
        body: JSON.stringify({
          auth: { type: "AID", aid: "x0k4ZR33ICN9CWmj" },
          client: { type: "WEB", id: "RMV", name: "webapp" },
          ver: "1.44",
          ext: "RMV.1",
          lang: "de",
          svcReqL,
        }),
      });
      const data = (await res.json()) as { svcResL?: Array<{ res?: { outConL?: Array<{ dur?: string }> } }> };
      (data.svcResL || []).forEach((r, j) => {
        const dur = r.res?.outConL?.[0]?.dur;
        if (!dur) return;
        const minutes = parseInt(dur.slice(0, 2), 10) * 60 + parseInt(dur.slice(2, 4), 10);
        const item = batch[j];
        const mappedSlugs = lidToSlugs.get(item.key);
        if (mappedSlugs) {
          for (const s of mappedSlugs) result[s] = minutes;
        } else {
          result[item.key] = minutes;
        }
      });
    } catch {}
  }

  const WALK_KM_PER_MIN = 0.08;
  for (const slug of slugs) {
    if (result[slug] !== undefined) continue;
    const m = geo[slug];
    const dLat = (m.lat - snapLat) * 111.32;
    const dLng = (m.lng - snapLng) * 111.32 * Math.cos((snapLat * Math.PI) / 180);
    const km = Math.sqrt(dLat * dLat + dLng * dLng);
    result[slug] = Math.round(km / WALK_KM_PER_MIN);
  }

  return c.json(result, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
});

// API routes (migrated from handleApi)
app.post("/api/like", async (c) => {
  return handleLike(c.req.raw, c.env);
});

app.get("/api/events", async (c) => {
  const date = c.req.query("date") || todayIso();
  const lang = c.req.query("lang") || "de";
  const events = proxyImages(await getEventsForDate(c.env, date));
  const counts = await getLikeCounts(
    c.env,
    "event",
    events.map((e) => e.id),
  );
  const withLikes = attachLikeCounts(events, counts);
  const translated = await translateFields(c.env, withLikes, ["title", "description"] as (keyof Event)[], lang);
  return c.json(markTranslated(withLikes, translated, lang), {
    headers: { "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600" },
  });
});

app.get("/api/exhibitions", async (c) => {
  const date = c.req.query("date") || todayIso();
  const lang = c.req.query("lang") || "de";
  const exhibitions = proxyImages(await getExhibitionsForDate(c.env, date));
  const counts = await getLikeCounts(
    c.env,
    "exhibition",
    exhibitions.map((e) => e.id),
  );
  const withLikes = attachLikeCounts(exhibitions, counts);
  const translated = await translateFields(c.env, withLikes, ["title"] as (keyof Exhibition)[], lang);
  return c.json(markTranslated(withLikes, translated, lang), {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=21600" },
  });
});

app.get("/api/museums", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM museums ORDER BY name").all();
  return c.json(results, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
  });
});

app.get("/api/day", async (c) => {
  const date = c.req.query("date") || todayIso();
  const lang = c.req.query("lang") || "de";
  const [rawExhibitions, rawEvents] = await Promise.all([
    getExhibitionsForDate(c.env, date),
    getEventsForDate(c.env, date),
  ]);
  const exhibitions = proxyImages(rawExhibitions);
  const events = proxyImages(rawEvents);
  const [exhCounts, evCounts] = await Promise.all([
    getLikeCounts(
      c.env,
      "exhibition",
      exhibitions.map((e) => e.id),
    ),
    getLikeCounts(
      c.env,
      "event",
      events.map((e) => e.id),
    ),
  ]);
  const exhWithLikes = attachLikeCounts(exhibitions, exhCounts);
  const evWithLikes = attachLikeCounts(events, evCounts);
  const [trExh, trEv] = await Promise.all([
    translateFields(c.env, exhWithLikes, ["title"] as (keyof Exhibition)[], lang),
    translateFields(c.env, evWithLikes, ["title", "description"] as (keyof Event)[], lang),
  ]);
  return c.json(
    {
      date,
      exhibitions: markTranslated(exhWithLikes, trExh, lang),
      events: markTranslated(evWithLikes, trEv, lang),
    },
    {
      headers: { "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600" },
    },
  );
});

app.get("/api/event/:id.ics", async (c) => {
  const idStr = c.req.param("id");
  if (!idStr) return c.json({ error: "invalid id" }, { status: 400 });
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) return c.json({ error: "invalid id" }, { status: 400 });
  const ev = await c.env.DB.prepare(
    "SELECT ev.*, m.name as museum_name FROM events ev JOIN museums m ON ev.museum_id = m.id WHERE ev.id = ?",
  )
    .bind(id)
    .first<Event & { museum_name: string }>();
  if (!ev) return c.json({ error: "not found" }, { status: 404 });
  return c.text(buildIcs([ev]), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ev.id}.ics"`,
      "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
});

app.get(
  "/partial/content",
  zValidator("query", dayQuery, (result, c) => {
    if (!result.success) return c.text("Bad request", 400);
  }),
  async (c) => {
    const { date: rawDate, lang } = c.req.valid("query");
    const date = rawDate || todayIso();
    const locale = (lang || detectLocale(c.req.raw)) as Locale;
    const data = await fetchDayData(c.env, date, locale);
    const tr = getTranslations(locale);

    const html = (
      <>
        <ContentBody
          events={data.events}
          exhibitions={data.exhibitions}
          tr={tr}
          locale={locale}
          todayIso={todayIso()}
        />
        <script type="application/json" id="partial-data" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
      </>
    );

    return c.html(html, {
      headers: {
        "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600",
        "X-Date-Label": formatDateFull(date, dateLocale(locale)),
      },
    });
  },
);

// Catch-all route with query validation
app.get(
  "*",
  zValidator("query", dayQuery, (result, _c) => {
    if (!result.success) {
      console.warn("Query validation failed:", result.error);
    }
  }),
  async (c) => {
    const locale = detectLocale(c.req.raw);
    const { date: rawDate, sort } = c.req.valid("query");
    const date = rawDate || todayIso();
    let initialData: InitialData | undefined;
    const museums = await getMuseumMap(c.env).catch(() => ({}));
    try {
      initialData = await fetchDayData(c.env, date, locale);
    } catch (e) {
      console.error("Failed to fetch initial data:", e);
    }

    return c.html(renderPage(locale, initialData, museums, sort === "near" ? "near" : undefined), {
      headers: {
        "Content-Language": locale,
        Vary: "Accept-Language",
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  },
);

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      scrape(env)
        .catch((e) => console.error("scrape failed:", e))
        .then(() => scrapeMuseumExhibitions(env))
        .catch((e) => console.error("exhibition scrape failed:", e))
        .then(() => scrapeMuseumWebsites(env))
        .catch((e) => console.error("event scrape failed:", e))
        .then(() => translateEvents(env))
        .catch((e) => console.error("translation failed:", e)),
    );
  },
} satisfies ExportedHandler<Env>;
