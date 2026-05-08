import { type ApiExhibition, fetchExhibitionsFromApi } from "./api-scrapers";
import { todayIso } from "./date";
import { MUSEUMS } from "./museum-config";
import type { Env } from "./types";

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
    if (!config?.exhibitionApi) continue;

    try {
      const items = await fetchExhibitionsFromApi(config.exhibitionApi);
      const persisted = await persistExhibitions(env, museum, items, today);
      exhibitions += persisted;
      scraped++;
    } catch (e) {
      const msg = `${museum.slug}: ${e instanceof Error ? e.message : String(e)}`;
      console.error(`Exhibition scrape failed for ${msg}`);
      errors.push(msg);
    }
  }

  return { scraped, exhibitions, errors };
}

async function persistExhibitions(
  env: Env,
  museum: { id: number; slug: string },
  items: ApiExhibition[],
  today: string,
): Promise<number> {
  if (items.length === 0) return 0;

  const overrideSlugs = Array.from(new Set(items.map((it) => it.museum_slug_override).filter((s): s is string => !!s)));
  const overrideMap = new Map<string, number>();
  if (overrideSlugs.length > 0) {
    const placeholders = overrideSlugs.map(() => "?").join(",");
    const { results } = await env.DB.prepare(`SELECT id, slug FROM museums WHERE slug IN (${placeholders})`)
      .bind(...overrideSlugs)
      .all<{ id: number; slug: string }>();
    for (const r of results) overrideMap.set(r.slug, r.id);
  }

  const insertSql = `INSERT INTO exhibitions (museum_id, title, start_date, end_date, description, image_url, detail_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(museum_id, title) DO UPDATE SET
       start_date = COALESCE(excluded.start_date, exhibitions.start_date),
       end_date = COALESCE(excluded.end_date, exhibitions.end_date),
       description = COALESCE(excluded.description, exhibitions.description),
       image_url = COALESCE(excluded.image_url, exhibitions.image_url),
       detail_url = COALESCE(excluded.detail_url, exhibitions.detail_url),
       updated_at = datetime('now')`;

  const seen = new Set<string>();
  const statements: D1PreparedStatement[] = [];
  for (const it of items) {
    const title = it.title?.trim();
    if (!title) continue;
    if (it.end_date && /^\d{4}-\d{2}-\d{2}$/.test(it.end_date) && it.end_date < today) continue;

    const targetMuseumId = (it.museum_slug_override && overrideMap.get(it.museum_slug_override)) || museum.id;
    const key = `${targetMuseumId}::${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    statements.push(
      env.DB.prepare(insertSql).bind(
        targetMuseumId,
        title,
        it.start_date && /^\d{4}-\d{2}-\d{2}$/.test(it.start_date) ? it.start_date : null,
        it.end_date && /^\d{4}-\d{2}-\d{2}$/.test(it.end_date) ? it.end_date : null,
        it.description ?? null,
        it.image_url ?? null,
        it.detail_url ?? null,
      ),
    );
  }

  if (statements.length > 0) await env.DB.batch(statements);
  return statements.length;
}
