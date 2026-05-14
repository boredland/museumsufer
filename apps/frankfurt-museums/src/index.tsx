import { zValidator } from "@hono/zod-validator";
import { handleContactRequest, securityHeaders } from "@museumsufer/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  buildIcs,
  fetchDayData,
  getEventCountsByDate,
  getEventsForDate,
  getExhibitionsForDate,
  getMuseumMap,
  markTranslated,
  proxyImages,
} from "./api";
import { ContentBody } from "./components";
import { berlinNow, todayIso } from "./date";
import { dispatchDigest, scheduleForNow } from "./digest";
import { type InitialData, renderPage } from "./frontend";
import { dateLocale, detectLocale, getTranslations, type Locale } from "./i18n";
import { handleImageProxy } from "./image-proxy";
import { getAllMuseums } from "./queries";
import docsRoute from "./routes/docs";
import feedsRoute from "./routes/feeds";
import imprintRoute from "./routes/imprint";
import museumRoute from "./routes/museum";
import ogRoute from "./routes/og";
import pushRoute from "./routes/push";
import staticRoute from "./routes/static";
import { formatDateFull } from "./shared";
import { translateFields } from "./translate";
import type { Env, Event, Exhibition, MuseumInfo } from "./types";

const dayQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  lang: z.enum(["de", "en", "fr"]).optional(),
  sort: z.string().optional(),
  range: z.coerce.number().int().min(2).max(14).optional(),
});

const app = new Hono<{ Bindings: Env }>();

// Error middleware
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// Apex → frankfurt subdomain. Anyone landing on ins.museum gets a permanent
// redirect to the canonical host (museumsufer.app remains primary canonical
// for SEO; this redirect just collapses the apex shortcut).
app.use("*", async (c, next) => {
  const host = (c.req.header("host") ?? "").toLowerCase();
  if (host === "ins.museum") {
    const url = new URL(c.req.url);
    return c.redirect(`https://frankfurt.ins.museum${url.pathname}${url.search}`, 301);
  }
  await next();
});

// Security headers — applied to every response. CSP keeps the inline-script
// allowance for the FOUC bootstrap; Permissions-Policy keeps geolocation
// enabled for the transit-distance API on /api/transit.
app.use(
  "*",
  securityHeaders({
    permissionsPolicy: "geolocation=(self), microphone=(), camera=(), payment=()",
    csp: [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
      "script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
      "frame-src https://challenges.cloudflare.com",
      "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  }),
);

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
app.route("/", pushRoute);
app.route("/", feedsRoute);
app.route("/", imprintRoute);
app.route("/", museumRoute);
app.route("/", ogRoute);
app.route("/api/docs", docsRoute);

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

  const batches: (typeof queryItems)[] = [];
  for (let i = 0; i < queryItems.length; i += 10) {
    batches.push(queryItems.slice(i, i + 10));
  }

  await Promise.all(
    batches.map(async (batch) => {
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
    }),
  );

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

const FEEDBACK_FROM = "no-reply@ins.museum";
const FEEDBACK_TO = "feedback@ins.museum";

app.post("/api/contact", (c) =>
  handleContactRequest({
    request: c.req.raw,
    env: c.env,
    app: "frankfurt-museums",
    from: FEEDBACK_FROM,
    to: FEEDBACK_TO,
  }),
);

app.get("/api/events", async (c) => {
  const date = c.req.query("date") || todayIso();
  const lang = c.req.query("lang") || "de";
  const events = proxyImages(await getEventsForDate(date));
  const translated = await translateFields(c.env, events, ["title", "description"] as (keyof Event)[], lang);
  return c.json(markTranslated(events, translated, lang), {
    headers: { "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600" },
  });
});

app.get("/api/exhibitions", async (c) => {
  const date = c.req.query("date") || todayIso();
  const lang = c.req.query("lang") || "de";
  const exhibitions = proxyImages(await getExhibitionsForDate(date));
  const translated = await translateFields(c.env, exhibitions, ["title"] as (keyof Exhibition)[], lang);
  return c.json(markTranslated(exhibitions, translated, lang), {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=21600" },
  });
});

app.get("/api/museums", async (c) => {
  return c.json(getAllMuseums(), {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
  });
});

app.get("/api/day", async (c) => {
  const date = c.req.query("date") || todayIso();
  const lang = c.req.query("lang") || "de";
  const [rawExhibitions, rawEvents] = await Promise.all([getExhibitionsForDate(date), getEventsForDate(date)]);
  const exhibitions = proxyImages(rawExhibitions);
  const events = proxyImages(rawEvents);
  const [trExh, trEv] = await Promise.all([
    translateFields(c.env, exhibitions, ["title"] as (keyof Exhibition)[], lang),
    translateFields(c.env, events, ["title", "description"] as (keyof Event)[], lang),
  ]);
  return c.json(
    {
      date,
      exhibitions: markTranslated(exhibitions, trExh, lang),
      events: markTranslated(events, trEv, lang),
    },
    {
      headers: { "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600" },
    },
  );
});

app.get("/event/:id/feed.ics", async (c) => {
  const idStr = c.req.param("id");
  if (!idStr) return c.json({ error: "invalid id" }, { status: 400 });
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) return c.json({ error: "invalid id" }, { status: 400 });
  const { getEventById } = await import("./queries");
  const ev = await getEventById(id);
  if (!ev) return c.json({ error: "not found" }, { status: 404 });
  return c.text(buildIcs([ev as Event & { museum_name: string }]), {
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
    const { date: rawDate, lang, range } = c.req.valid("query");
    const date = rawDate || todayIso();
    const locale = (lang || detectLocale(c.req.raw)) as Locale;
    const endDate = range
      ? berlinNow()
          .add(range - 1, "day")
          .format("YYYY-MM-DD")
      : undefined;
    const data = await fetchDayData(c.env, date, locale, endDate);
    const tr = getTranslations(locale);

    const html = (
      <>
        <ContentBody
          events={data.events}
          exhibitions={data.exhibitions}
          tr={tr}
          locale={locale}
          todayIso={todayIso()}
          groupByDate={!!range}
        />
        <script type="application/json" id="partial-data" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
      </>
    );

    const label = range ? tr.upcomingDays.replace("{n}", String(range)) : formatDateFull(date, dateLocale(locale));
    return c.html(html, {
      headers: {
        "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600",
        "X-Date-Label": label,
      },
    });
  },
);

function renderMarkdown(data: InitialData, locale: Locale, museums: Record<string, MuseumInfo>): string {
  const tr = getTranslations(locale);
  const dl = dateLocale(locale);
  const lines: string[] = [
    `# Museumsufer Frankfurt — ${tr.subtitle}`,
    "",
    `> ${tr.introText}`,
    "",
    `**${formatDateFull(data.date, dl)}**`,
    "",
  ];

  const events = data.events as Event[];
  if (events.length > 0) {
    lines.push(`## ${tr.events} (${events.length})`, "");
    for (const ev of events) {
      const time = ev.time ? ` ${ev.time}` : "";
      const price = ev.price ? ` · ${ev.price}` : "";
      const url = ev.detail_url || ev.url;
      const title = url ? `[${ev.title}](${url})` : ev.title;
      lines.push(`- **${title}**${time}${price}`);
      lines.push(`  ${ev.museum_name || ""}`);
      if (ev.description) lines.push(`  ${ev.description}`);
    }
    lines.push("");
  }

  const exhibitions = data.exhibitions as Exhibition[];
  if (exhibitions.length > 0) {
    lines.push(`## ${tr.exhibitions} (${exhibitions.length})`, "");
    for (const ex of exhibitions) {
      const dates = [ex.start_date, ex.end_date].filter(Boolean).join(" – ");
      const url = ex.detail_url;
      const title = url ? `[${ex.title}](${url})` : ex.title;
      lines.push(`- **${title}**${dates ? ` (${dates})` : ""}`);
      lines.push(`  ${ex.museum_name || ""}`);
      if (ex.description) lines.push(`  ${ex.description}`);
    }
    lines.push("");
  }

  const museumEntries = Object.entries(museums).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  if (museumEntries.length > 0) {
    lines.push(`## ${tr.museums} (${museumEntries.length})`, "");
    for (const [, m] of museumEntries) {
      const link = m.website ? `[${m.name}](${m.website})` : m.name;
      lines.push(`- ${link}`);
    }
    lines.push("");
  }

  lines.push(`---`, "", `Source: https://museumsufer.app · API: https://museumsufer.app/api/docs`);
  return lines.join("\n");
}

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
    const { date: rawDate, sort, range } = c.req.valid("query");
    const date = range ? todayIso() : rawDate || todayIso();
    const endDate = range
      ? berlinNow()
          .add(range - 1, "day")
          .format("YYYY-MM-DD")
      : undefined;
    let initialData: InitialData | undefined;
    const museums = await getMuseumMap().catch(() => ({}));
    try {
      initialData = await fetchDayData(c.env, date, locale, endDate);
    } catch (e) {
      console.error("Failed to fetch initial data:", e);
    }

    const linkHeader = [
      '</.well-known/api-catalog>; rel=api-catalog; type="application/linkset+json"',
      '</api/docs>; rel=service-doc; title="API Documentation"',
      '</feed.xml>; rel=alternate; type="application/rss+xml"; title="RSS"',
      '</feed.ics>; rel=alternate; type="text/calendar"; title="iCal"',
      '</llms.txt>; rel=describedby; type="text/plain"; title="LLM Instructions"',
    ].join(", ");

    const accept = c.req.header("Accept") || "";
    if (accept.includes("text/markdown") && initialData) {
      const md = renderMarkdown(initialData, locale, museums);
      return c.body(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Language": locale,
          Vary: "Accept, Accept-Language",
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
          Link: linkHeader,
        },
      });
    }

    const today = todayIso();
    const horizon = berlinNow().add(90, "day").format("YYYY-MM-DD");
    const dateCounts = getEventCountsByDate(today, horizon);

    const reqUrl = new URL(c.req.url);
    return c.html(
      renderPage(
        locale,
        initialData,
        museums,
        sort === "near" ? "near" : undefined,
        range,
        dateCounts,
        c.env.TURNSTILE_SITE_KEY,
        reqUrl.pathname + reqUrl.search,
      ),
      {
        headers: {
          "Content-Language": locale,
          Vary: "Accept, Accept-Language",
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
          Link: linkHeader,
        },
      },
    );
  },
);

// Scraping moved to .github/workflows/scrape.yml (museums job) — no
// SCRAPE_SECRET / /scrape/* routes. The scheduled() handler is back, but
// only for digest push delivery (see ./digest.ts). Triggers fire at both
// CET and CEST candidate UTC times; scheduleForNow() picks the right
// digest based on the local Europe/Berlin hour.

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const schedule = scheduleForNow(new Date());
    if (!schedule) return;
    ctx.waitUntil(dispatchDigest(env, schedule));
  },
};
