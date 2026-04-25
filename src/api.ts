import { Env, Exhibition, Event, Museum } from "./types";

const CACHE_EVENTS = "public, max-age=3600, s-maxage=3600";
const CACHE_EXHIBITIONS = "public, max-age=21600, s-maxage=21600";
const CACHE_MUSEUMS = "public, max-age=86400, s-maxage=86400";

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/events") {
    const date = url.searchParams.get("date") || todayIso();
    return json(await getEventsForDate(env, date), 200, CACHE_EVENTS);
  }

  if (path === "/api/exhibitions") {
    const date = url.searchParams.get("date") || todayIso();
    return json(await getExhibitionsForDate(env, date), 200, CACHE_EXHIBITIONS);
  }

  if (path === "/api/museums") {
    return json(await getMuseums(env), 200, CACHE_MUSEUMS);
  }

  if (path === "/api/day") {
    const date = url.searchParams.get("date") || todayIso();
    const [exhibitions, events] = await Promise.all([
      getExhibitionsForDate(env, date),
      getEventsForDate(env, date),
    ]);
    return json({ date, exhibitions, events }, 200, CACHE_EVENTS);
  }

  return json({ error: "not found" }, 404);
}

async function getExhibitionsForDate(env: Env, date: string): Promise<Exhibition[]> {
  const { results } = await env.DB.prepare(
    `SELECT e.*, m.name as museum_name
     FROM exhibitions e
     JOIN museums m ON e.museum_id = m.id
     WHERE (e.start_date IS NULL OR e.start_date <= ?)
       AND (e.end_date IS NULL OR e.end_date >= ?)
     ORDER BY m.name, e.title`
  )
    .bind(date, date)
    .all<Exhibition>();
  return results;
}

async function getEventsForDate(env: Env, date: string): Promise<Event[]> {
  const { results } = await env.DB.prepare(
    `SELECT ev.*, m.name as museum_name
     FROM events ev
     JOIN museums m ON ev.museum_id = m.id
     WHERE ev.date = ?
     ORDER BY ev.time, m.name`
  )
    .bind(date)
    .all<Event>();
  return results;
}

async function getMuseums(env: Env): Promise<Museum[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM museums ORDER BY name"
  ).all<Museum>();
  return results;
}

function todayIso(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

function json(data: unknown, status = 200, cacheControl?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };
  if (cacheControl) headers["Cache-Control"] = cacheControl;
  return new Response(JSON.stringify(data), { status, headers });
}
