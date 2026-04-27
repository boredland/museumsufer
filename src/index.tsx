import { Hono } from "hono";
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_LOCALES = ["de", "en", "fr"];

function parseDate(raw: string | undefined): string {
  return raw && ISO_DATE.test(raw) ? raw : todayIso();
}

function parseLocale(raw: string | undefined, fallback: Locale): Locale {
  return raw && VALID_LOCALES.includes(raw) ? (raw as Locale) : fallback;
}

const app = new Hono<{ Bindings: Env }>();

app.route("/", staticRoute);
app.route("/", feedsRoute);
app.route("/scrape", scrapeRoute);

app.get("/img/*", async (c) => {
  const response = await handleImageProxy(c.req.raw, c.env);
  if (response) return response;
  return c.notFound();
});

app.all("/api/*", (c) => {
  const locale = detectLocale(c.req.raw);
  return handleApi(c.req.raw, c.env, locale);
});

app.get("/partial/content", async (c) => {
  const locale = parseLocale(c.req.query("lang"), detectLocale(c.req.raw));
  const date = parseDate(c.req.query("date"));
  const data = await fetchDayData(c.env, date, locale);
  const tr = getTranslations(locale);

  const html = (
    <>
      <ContentBody events={data.events} exhibitions={data.exhibitions} tr={tr} locale={locale} todayIso={todayIso()} />
      <script type="application/json" id="partial-data" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
    </>
  );

  return c.html(html, {
    headers: {
      "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600",
      "X-Date-Label": formatDateFull(date, dateLocale(locale)),
    },
  });
});

app.get("*", async (c) => {
  const locale = detectLocale(c.req.raw);
  const date = parseDate(c.req.query("date"));
  let initialData: InitialData | undefined;
  const museums = await getMuseumMap(c.env).catch(() => ({}));
  try {
    initialData = await fetchDayData(c.env, date, locale);
  } catch (e) {
    console.error("Failed to fetch initial data:", e);
  }

  const sort = c.req.query("sort");
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
