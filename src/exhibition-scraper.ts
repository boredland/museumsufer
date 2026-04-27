import { todayIso } from "./date";
import {
  extractImageFromHtml,
  extractJson,
  extractPageLinks,
  matchLinkForTitle,
  stripHtmlToText,
} from "./event-scraper";
import { MUSEUM_EXHIBITION_URLS } from "./museum-exhibitions";
import { USER_AGENT } from "./shared";
import type { Env } from "./types";

interface ScrapedExhibition {
  title: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

export async function scrapeMuseumExhibitions(
  env: Env,
): Promise<{ scraped: number; exhibitions: number; errors: string[] }> {
  const { results: museums } = await env.DB.prepare(
    `SELECT m.id, m.name, m.slug
     FROM museums m
     LEFT JOIN exhibitions e ON e.museum_id = m.id
     GROUP BY m.id
     HAVING COUNT(e.id) = 0`,
  ).all<{ id: number; name: string; slug: string }>();

  let scraped = 0;
  let exhibitions = 0;
  const errors: string[] = [];

  for (const museum of museums) {
    const config = MUSEUM_EXHIBITION_URLS[museum.slug];
    if (!config) continue;

    try {
      const count = await scrapeExhibitionsForMuseum(env, museum, config.url, config.js);
      exhibitions += count;
      scraped++;
    } catch (e) {
      const msg = `${museum.slug}: ${e instanceof Error ? e.message : String(e)}`;
      console.error(`Exhibition scrape failed for ${msg}`);
      errors.push(msg);
    }
  }

  return { scraped, exhibitions, errors };
}

async function scrapeExhibitionsForMuseum(
  env: Env,
  museum: { id: number; name: string; slug: string },
  pageUrl: string,
  useJs?: true,
): Promise<number> {
  let html: string;

  if (useJs && env.BROWSER) {
    html = await fetchWithBrowser(env, pageUrl);
  } else if (useJs) {
    return 0;
  } else {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) return 0;
    html = await res.text();
  }

  const pageLinks = extractPageLinks(html, new URL(pageUrl).origin);
  const textContent = stripHtmlToText(html);
  if (textContent.length < 50) return 0;

  const truncated = textContent.slice(0, 8000);
  const today = todayIso();

  const result = (await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Extract temporary/special exhibitions from this museum's exhibition page. Today is ${today}.

Only extract Sonderausstellungen/Wechselausstellungen (temporary or special exhibitions).
Do NOT include permanent exhibitions (Dauerausstellungen, Sammlung, ständige Ausstellung).
Return ONLY a JSON array, nothing else. Each element:
{"title": "Exhibition Title", "start_date": "YYYY-MM-DD" or null, "end_date": "YYYY-MM-DD" or null, "description": "brief description" or null}

If there are no temporary exhibitions, return an empty array: []

Text content from ${museum.name} (${pageUrl}):
${truncated}`,
      },
    ],
  })) as Record<string, unknown>;

  const responseText = typeof result.response === "string" ? result.response : JSON.stringify(result);
  const parsed = extractJson<ScrapedExhibition[]>(responseText);
  if (!parsed || parsed.length === 0) return 0;

  let count = 0;
  for (const exh of parsed) {
    if (!exh.title) continue;

    if (exh.end_date && /^\d{4}-\d{2}-\d{2}$/.test(exh.end_date) && exh.end_date < today) continue;

    const detailUrl = matchLinkForTitle(exh.title, pageLinks);
    const imageUrl = extractImageFromHtml(html, pageUrl);

    await env.DB.prepare(
      `INSERT INTO exhibitions (museum_id, title, start_date, end_date, description, image_url, detail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(museum_id, title) DO UPDATE SET
         start_date = COALESCE(excluded.start_date, exhibitions.start_date),
         end_date = COALESCE(excluded.end_date, exhibitions.end_date),
         description = COALESCE(excluded.description, exhibitions.description),
         image_url = COALESCE(excluded.image_url, exhibitions.image_url),
         detail_url = COALESCE(excluded.detail_url, exhibitions.detail_url),
         updated_at = datetime('now')`,
    )
      .bind(
        museum.id,
        exh.title.trim(),
        exh.start_date && /^\d{4}-\d{2}-\d{2}$/.test(exh.start_date) ? exh.start_date : null,
        exh.end_date && /^\d{4}-\d{2}-\d{2}$/.test(exh.end_date) ? exh.end_date : null,
        exh.description?.trim() || null,
        imageUrl,
        detailUrl,
      )
      .run();
    count++;
  }

  return count;
}

async function fetchWithBrowser(env: Env, url: string): Promise<string> {
  const puppeteer = await import("@cloudflare/puppeteer");
  const browser = await puppeteer.default.launch(env.BROWSER!);
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 15000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}
