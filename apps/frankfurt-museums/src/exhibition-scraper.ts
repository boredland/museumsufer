import { todayIso } from "./date";
import {
  extractImageFromHtml,
  extractJson,
  extractPageLinks,
  matchLinkForTitle,
  stripHtmlToText,
} from "./event-scraper";
import { fetchPage } from "./fetch-utils";
import { MUSEUMS } from "./museum-config";
import { USER_AGENT } from "./shared";
import type { Env } from "./types";

const MONTH_MAP: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
  january: "01",
  february: "02",
  march: "03",
  may: "05",
  june: "06",
  july: "07",
  october: "10",
  december: "12",
};

function parseGermanDate(text: string, fallbackYear?: string): string | null {
  const m = text.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s*(\d{4})?/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = MONTH_MAP[m[2].toLowerCase()];
  const year = m[3] || fallbackYear;
  if (!month || !year) return null;
  return `${year}-${month}-${day}`;
}

const DATE_PAT = String.raw`\d{1,2}\.\s*[A-Za-zÄÖÜäöü]+`;
const DATE_YEAR_PAT = `${DATE_PAT}\\s*\\d{4}`;
const RANGE_RE = new RegExp(
  `(?:Dauer|Laufzeit)[:\\s]+(${DATE_PAT}(?:\\s*\\d{4})?)\\s*[–\\-]\\s*(${DATE_YEAR_PAT})`,
  "i",
);
const GENERIC_RANGE_RE = new RegExp(`(${DATE_PAT}(?:\\s*\\d{4})?)\\s*[–\\-]\\s*(${DATE_YEAR_PAT})`);

function extractDatesFromHtml(html: string): { start: string | null; end: string | null } | null {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&ndash;|–|&#8211;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const rangeMatch = RANGE_RE.exec(text) || GENERIC_RANGE_RE.exec(text);
  if (rangeMatch) {
    const endDate = parseGermanDate(rangeMatch[2]);
    const yearFromEnd = rangeMatch[2].match(/\d{4}/)?.[0];
    const startDate = parseGermanDate(rangeMatch[1], yearFromEnd);
    if (startDate && endDate) return { start: startDate, end: endDate };
  }
  return null;
}

interface ScrapedExhibition {
  title: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

export async function scrapeMuseumExhibitions(
  env: Env,
): Promise<{ scraped: number; exhibitions: number; errors: string[] }> {
  const today = todayIso();
  const { results: museums } = await env.DB.prepare(
    `SELECT m.id, m.name, m.slug
     FROM museums m
     LEFT JOIN exhibitions e ON e.museum_id = m.id
       AND (e.end_date IS NULL OR e.end_date >= ?)
     GROUP BY m.id
     HAVING COUNT(e.id) = 0`,
  )
    .bind(today)
    .all<{ id: number; name: string; slug: string }>();

  let scraped = 0;
  let exhibitions = 0;
  const errors: string[] = [];

  for (const museum of museums) {
    const config = MUSEUMS[museum.slug];
    if (!config?.exhibitionUrl) continue;

    try {
      const count = await scrapeExhibitionsForMuseum(env, museum, config.exhibitionUrl, config);
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
  opts?: { spa?: true; proxy?: true },
): Promise<number> {
  const html = await fetchPage(env, pageUrl, opts);
  if (!html) return 0;

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
{"title": "Exhibition Title", "start_date": "YYYY-MM-DD" or null, "end_date": "YYYY-MM-DD" or null, "description": "..." or null}

If there are no temporary exhibitions, return an empty array: []

Text content from ${museum.name} (${pageUrl}):
${truncated}`,
      },
    ],
  })) as Record<string, unknown>;

  const responseText = typeof result.response === "string" ? result.response : JSON.stringify(result);
  const parsed = extractJson<ScrapedExhibition[]>(responseText);
  if (!parsed || parsed.length === 0) return 0;

  const seen = new Set<string>();
  const validExhibitions: Array<{ exh: ScrapedExhibition; detailUrl: string | null }> = [];
  for (const exh of parsed) {
    if (!exh.title) continue;
    const key = exh.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (exh.end_date && /^\d{4}-\d{2}-\d{2}$/.test(exh.end_date) && exh.end_date < today) continue;
    validExhibitions.push({ exh, detailUrl: matchLinkForTitle(exh.title, pageLinks) });
  }

  const detailData = await Promise.all(
    validExhibitions.map(async ({ detailUrl }) => {
      if (!detailUrl) return null;
      try {
        const res = await fetch(detailUrl, { headers: { "User-Agent": USER_AGENT } });
        if (res.ok) {
          const detailHtml = await res.text();
          return {
            image: extractImageFromHtml(detailHtml, detailUrl),
            dates: extractDatesFromHtml(detailHtml),
          };
        }
      } catch {}
      return null;
    }),
  );

  let count = 0;
  for (let i = 0; i < validExhibitions.length; i++) {
    const { exh, detailUrl } = validExhibitions[i];
    const detail = detailData[i];
    const imageUrl = detail?.image || extractImageFromHtml(html, pageUrl);
    if (!exh.start_date && detail?.dates?.start) exh.start_date = detail.dates.start;
    if (!exh.end_date && detail?.dates?.end) exh.end_date = detail.dates.end;

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
