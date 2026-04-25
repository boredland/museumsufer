import { Env } from "./types";
import { handleApi } from "./api";
import { scrape } from "./scraper";
import { renderPage } from "./frontend";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    if (url.pathname === "/scrape" && request.method === "POST") {
      const result = await scrape(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(renderPage(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(scrape(env));
  },
} satisfies ExportedHandler<Env>;
