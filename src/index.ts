import { Env } from "./types";
import { handleApi } from "./api";
import { scrape } from "./scraper";
import { scrapeMuseumWebsites } from "./event-scraper";
import { renderPage } from "./frontend";
import { detectLocale } from "./i18n";

function checkScrapeAuth(request: Request, env: Env): Response | null {
  if (!env.SCRAPE_SECRET) return null;
  const auth = request.headers.get("Authorization");
  if (auth === `Bearer ${env.SCRAPE_SECRET}`) return null;
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    if (url.pathname === "/scrape" && request.method === "POST") {
      const denied = checkScrapeAuth(request, env);
      if (denied) return denied;
      const result = await scrape(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/scrape/events" && request.method === "POST") {
      const denied = checkScrapeAuth(request, env);
      if (denied) return denied;
      const result = await scrapeMuseumWebsites(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const locale = detectLocale(request);
    return new Response(renderPage(locale), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Language": locale,
        "Vary": "Accept-Language",
      },
    });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      scrape(env).then(() => scrapeMuseumWebsites(env))
    );
  },
} satisfies ExportedHandler<Env>;
