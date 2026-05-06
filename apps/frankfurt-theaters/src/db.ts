import type { TheaterConfig } from "./theater-config";
import type { Performance, ScrapeResult, Show, Theater } from "./types";

export async function upsertTheater(db: D1Database, t: TheaterConfig): Promise<number> {
  await db
    .prepare(
      `INSERT INTO theaters (name, slug, address, lat, lon, website_url, ticketing_provider, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
       ON CONFLICT(slug) DO UPDATE SET
         name = excluded.name,
         address = excluded.address,
         lat = excluded.lat,
         lon = excluded.lon,
         website_url = excluded.website_url,
         ticketing_provider = excluded.ticketing_provider,
         updated_at = datetime('now')`,
    )
    .bind(t.name, t.slug, t.address, t.lat, t.lon, t.website_url, t.ticketing_provider)
    .run();

  const row = await db.prepare("SELECT id FROM theaters WHERE slug = ?1").bind(t.slug).first<{ id: number }>();
  if (!row) throw new Error(`Theater ${t.slug} not found after upsert`);
  return row.id;
}

export async function persistScrapeResult(
  db: D1Database,
  theaterId: number,
  result: ScrapeResult,
): Promise<{ shows: number; performances: number }> {
  const showIdBySlug = new Map<string, number>();

  for (const s of result.shows) {
    await db
      .prepare(
        `INSERT INTO shows (theater_id, slug, title, subtitle, description, image_url, detail_url, season, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))
         ON CONFLICT(theater_id, slug) DO UPDATE SET
           title = excluded.title,
           subtitle = COALESCE(excluded.subtitle, shows.subtitle),
           description = COALESCE(excluded.description, shows.description),
           image_url = COALESCE(excluded.image_url, shows.image_url),
           detail_url = COALESCE(excluded.detail_url, shows.detail_url),
           season = COALESCE(excluded.season, shows.season),
           updated_at = datetime('now')`,
      )
      .bind(
        theaterId,
        s.slug,
        s.title,
        s.subtitle ?? null,
        s.description ?? null,
        s.image_url ?? null,
        s.detail_url ?? null,
        s.season ?? null,
      )
      .run();

    const row = await db
      .prepare("SELECT id FROM shows WHERE theater_id = ?1 AND slug = ?2")
      .bind(theaterId, s.slug)
      .first<{ id: number }>();
    if (row) showIdBySlug.set(s.slug, row.id);
  }

  let performanceCount = 0;
  for (const p of result.performances) {
    const showId = showIdBySlug.get(p.show_slug);
    if (!showId) continue;
    await db
      .prepare(
        `INSERT INTO performances (
           show_id, date, time, end_time, end_date, venue_room,
           provider_event_id, ticket_url, status, price_min, price_max, updated_at
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'))
         ON CONFLICT(show_id, date, time, venue_room) DO UPDATE SET
           end_time = excluded.end_time,
           end_date = excluded.end_date,
           provider_event_id = COALESCE(excluded.provider_event_id, performances.provider_event_id),
           ticket_url = COALESCE(excluded.ticket_url, performances.ticket_url),
           status = excluded.status,
           price_min = COALESCE(excluded.price_min, performances.price_min),
           price_max = COALESCE(excluded.price_max, performances.price_max),
           updated_at = datetime('now')`,
      )
      .bind(
        showId,
        p.date,
        p.time ?? null,
        p.end_time ?? null,
        p.end_date ?? null,
        p.venue_room ?? null,
        p.provider_event_id ?? null,
        p.ticket_url ?? null,
        p.status ?? "unknown",
        p.price_min ?? null,
        p.price_max ?? null,
      )
      .run();
    performanceCount++;
  }

  return { shows: result.shows.length, performances: performanceCount };
}

export interface DateWithCount {
  date: string;
  n: number;
}

export async function getDatesWithPerformances(
  db: D1Database,
  fromDate: string,
  toDate: string,
): Promise<DateWithCount[]> {
  const { results } = await db
    .prepare(
      `SELECT date, COUNT(*) AS n FROM performances
       WHERE date BETWEEN ?1 AND ?2 AND status != 'cancelled'
       GROUP BY date ORDER BY date`,
    )
    .bind(fromDate, toDate)
    .all<{ date: string; n: number }>();
  return results.map((r) => ({ date: String(r.date), n: Number(r.n) }));
}

export async function getPerformancesForDate(
  db: D1Database,
  date: string,
): Promise<(Performance & { show: Show; theater: Pick<Theater, "id" | "name" | "slug" | "website_url"> })[]> {
  const { results } = await db
    .prepare(
      `SELECT
         p.id, p.show_id, p.date, p.time, p.end_time, p.end_date, p.venue_room,
         p.provider_event_id, p.ticket_url, p.status, p.available_seats, p.total_seats,
         p.price_min, p.price_max, p.currency, p.availability_checked_at,
         s.id AS show_id_, s.slug AS show_slug, s.title AS show_title, s.subtitle AS show_subtitle,
         s.description AS show_description, s.image_url AS show_image_url, s.detail_url AS show_detail_url,
         t.id AS theater_id, t.name AS theater_name, t.slug AS theater_slug, t.website_url AS theater_website
       FROM performances p
       JOIN shows s ON s.id = p.show_id
       JOIN theaters t ON t.id = s.theater_id
       WHERE p.date = ?1
       ORDER BY p.time NULLS LAST, t.name, s.title`,
    )
    .bind(date)
    .all<Record<string, unknown>>();

  return results.map((r) => ({
    id: Number(r.id),
    show_id: Number(r.show_id),
    date: String(r.date),
    time: r.time as string | null,
    end_time: r.end_time as string | null,
    end_date: r.end_date as string | null,
    venue_room: r.venue_room as string | null,
    provider_event_id: r.provider_event_id as string | null,
    ticket_url: r.ticket_url as string | null,
    status: (r.status as Performance["status"]) ?? "unknown",
    available_seats: r.available_seats as number | null,
    total_seats: r.total_seats as number | null,
    price_min: r.price_min as number | null,
    price_max: r.price_max as number | null,
    currency: r.currency as string | null,
    availability_checked_at: r.availability_checked_at as string | null,
    show: {
      id: Number(r.show_id_),
      theater_id: Number(r.theater_id),
      slug: String(r.show_slug),
      title: String(r.show_title),
      subtitle: r.show_subtitle as string | null,
      description: r.show_description as string | null,
      language: null,
      age_recommendation: null,
      image_url: r.show_image_url as string | null,
      detail_url: r.show_detail_url as string | null,
      season: null,
    },
    theater: {
      id: Number(r.theater_id),
      name: String(r.theater_name),
      slug: String(r.theater_slug),
      website_url: r.theater_website as string | null,
    },
  }));
}
