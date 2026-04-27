import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { fetchDayData, getMuseumMap, handleApi } from "./api";
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
import { translateEvents } from "./translate";
import type { Env } from "./types";

const dayQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  lang: z.enum(["de", "en", "fr"]).optional(),
  sort: z.string().optional(),
});

const app = new Hono<{ Bindings: Env }>();

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

  const snapLat = Math.round(body.lat * 500) / 500;
  const snapLng = Math.round(body.lng * 500) / 500;
  const ox = Math.round(snapLng * 1e6);
  const oy = Math.round(snapLat * 1e6);
  const { getMuseumLocations: getLocs } = await import("./museum-config");
  const geo = getLocs();
  const slugs = Object.keys(geo);
  const result: Record<string, number> = {};

  for (let i = 0; i < slugs.length; i += 5) {
    const batch = slugs.slice(i, i + 5);
    const svcReqL = batch.map((slug) => ({
      meth: "TripSearch",
      req: {
        depLocL: [{ type: "C", crd: { x: ox, y: oy } }],
        arrLocL: [{ type: "C", crd: { x: Math.round(geo[slug].lng * 1e6), y: Math.round(geo[slug].lat * 1e6) } }],
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
        if (dur) result[batch[j]] = parseInt(dur.slice(0, 2), 10) * 60 + parseInt(dur.slice(2, 4), 10);
      });
    } catch {}
  }

  return c.json(result, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
});

app.all("/api/*", (c) => {
  const locale = detectLocale(c.req.raw);
  return handleApi(c.req.raw, c.env, locale);
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

app.get("*", async (c) => {
  const locale = detectLocale(c.req.raw);
  const rawDate = c.req.query("date");
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayIso();
  const sort = c.req.query("sort");
  let initialData: InitialData | undefined;
  const museums = await getMuseumMap(c.env).catch(() => ({}));
  try {
    initialData = await fetchDayData(c.env, date, locale);
  } catch (e) {
    console.error("Failed to fetch initial data:", e);
  }

  return c.html(renderPage(locale, initialData, museums, sort), {
    headers: {
      "Content-Language": locale,
      Vary: "Accept-Language",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
});

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
