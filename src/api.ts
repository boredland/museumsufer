import { berlinHourMinute, dateOffset, todayIso } from "./date";
import type { Locale } from "./i18n";
import { MUSEUMS } from "./museum-config";
import { APP_URL, escHtml } from "./shared";
import { translateFields } from "./translate";
import type { Env, Event, EventWithLikes, Exhibition, ExhibitionWithLikes, MuseumInfo } from "./types";

const CACHE_EVENTS = "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600";
const CACHE_EXHIBITIONS = "public, max-age=3600, s-maxage=21600, stale-while-revalidate=21600";
const CACHE_MUSEUMS = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";
const CACHE_FEEDS = "public, max-age=1800, s-maxage=3600, stale-while-revalidate=3600";

async function visitorHash(request: Request): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const day = todayIso();
  const data = new TextEncoder().encode(`${ip}:${day}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getLikeCounts(env: Env, itemType: string, itemIds: number[]): Promise<Record<number, number>> {
  if (itemIds.length === 0) return {};
  const placeholders = itemIds.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT item_id, COUNT(*) as like_count FROM likes
     WHERE item_type = ? AND item_id IN (${placeholders})
     GROUP BY item_id`,
  )
    .bind(itemType, ...itemIds)
    .all<{ item_id: number; like_count: number }>();
  const counts: Record<number, number> = {};
  for (const r of results) counts[r.item_id] = r.like_count;
  return counts;
}

export function attachLikeCounts<T extends { id: number }>(
  items: T[],
  counts: Record<number, number>,
): (T & { like_count: number })[] {
  return items.map((item) => ({ ...item, like_count: counts[item.id] || 0 }));
}

function proxyImageUrl(url: string | null): string | null {
  if (!url?.startsWith("https://")) return url;
  return `/img/${encodeURIComponent(url)}`;
}

export function proxyImages<T extends { image_url?: string | null }>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    image_url: proxyImageUrl(item.image_url ?? null),
  }));
}

export async function handleApi(request: Request, env: Env, locale = "de"): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const lang = url.searchParams.get("lang") || locale;

  if (path === "/api/like" && request.method === "POST") {
    return handleLike(request, env);
  }

  if (path === "/api/events") {
    const date = url.searchParams.get("date") || todayIso();
    const events = proxyImages(await getEventsForDate(env, date));
    const counts = await getLikeCounts(
      env,
      "event",
      events.map((e) => e.id),
    );
    const withLikes = attachLikeCounts(events, counts);
    const translated = await translateFields(env, withLikes, ["title", "description"] as (keyof Event)[], lang);
    return json(markTranslated(withLikes, translated, lang), 200, CACHE_EVENTS);
  }

  if (path === "/api/exhibitions") {
    const date = url.searchParams.get("date") || todayIso();
    const exhibitions = proxyImages(await getExhibitionsForDate(env, date));
    const counts = await getLikeCounts(
      env,
      "exhibition",
      exhibitions.map((e) => e.id),
    );
    const withLikes = attachLikeCounts(exhibitions, counts);
    const translated = await translateFields(env, withLikes, ["title"] as (keyof Exhibition)[], lang);
    return json(markTranslated(withLikes, translated, lang), 200, CACHE_EXHIBITIONS);
  }

  if (path === "/api/museums") {
    const { results } = await env.DB.prepare("SELECT * FROM museums ORDER BY name").all();
    return json(results, 200, CACHE_MUSEUMS);
  }

  if (path === "/api/day") {
    const date = url.searchParams.get("date") || todayIso();
    const [rawExhibitions, rawEvents] = await Promise.all([
      getExhibitionsForDate(env, date),
      getEventsForDate(env, date),
    ]);
    const exhibitions = proxyImages(rawExhibitions);
    const events = proxyImages(rawEvents);
    const [exhCounts, evCounts] = await Promise.all([
      getLikeCounts(
        env,
        "exhibition",
        exhibitions.map((e) => e.id),
      ),
      getLikeCounts(
        env,
        "event",
        events.map((e) => e.id),
      ),
    ]);
    const exhWithLikes = attachLikeCounts(exhibitions, exhCounts);
    const evWithLikes = attachLikeCounts(events, evCounts);
    const [trExh, trEv] = await Promise.all([
      translateFields(env, exhWithLikes, ["title"] as (keyof Exhibition)[], lang),
      translateFields(env, evWithLikes, ["title", "description"] as (keyof Event)[], lang),
    ]);
    return json(
      {
        date,
        exhibitions: markTranslated(exhWithLikes, trExh, lang),
        events: markTranslated(evWithLikes, trEv, lang),
      },
      200,
      CACHE_EVENTS,
    );
  }

  const eventIcsMatch = path.match(/^\/api\/event\/(\d+)\.ics$/);
  if (eventIcsMatch) {
    const id = parseInt(eventIcsMatch[1], 10);
    const ev = await env.DB.prepare(
      "SELECT ev.*, m.name as museum_name FROM events ev JOIN museums m ON ev.museum_id = m.id WHERE ev.id = ?",
    )
      .bind(id)
      .first<Event & { museum_name: string }>();
    if (!ev) return json({ error: "not found" }, 404);
    return new Response(buildIcs([ev]), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${ev.id}.ics"`,
        "Cache-Control": CACHE_EVENTS,
      },
    });
  }

  return json({ error: "not found" }, 404);
}

export async function handleFeeds(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/feed.xml" || url.pathname === "/rss.xml") {
    const events = await getUpcomingEvents(env, 7);
    return new Response(buildRss(events), {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": CACHE_FEEDS },
    });
  }

  if (url.pathname === "/feed.ics" || url.pathname === "/calendar.ics") {
    const events = await getUpcomingEvents(env, 7);
    return new Response(buildIcs(events), {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": CACHE_FEEDS },
    });
  }

  return null;
}

async function handleLike(request: Request, env: Env): Promise<Response> {
  const body = await request
    .json<{ item_type?: string; item_id?: number }>()
    .catch((): { item_type?: string; item_id?: number } => ({}));
  const { item_type, item_id } = body;
  if (!item_type || !item_id || !["exhibition", "event"].includes(item_type)) {
    return json({ error: "invalid request" }, 400);
  }
  const hash = await visitorHash(request);
  try {
    await env.DB.prepare("INSERT OR IGNORE INTO likes (item_type, item_id, visitor_hash) VALUES (?, ?, ?)")
      .bind(item_type, item_id, hash)
      .run();
  } catch {
    return json({ error: "failed" }, 500);
  }
  const row = await env.DB.prepare("SELECT COUNT(*) as c FROM likes WHERE item_type = ? AND item_id = ?")
    .bind(item_type, item_id)
    .first<{ c: number }>();
  return json({ ok: true, like_count: row?.c ?? 1 });
}

export async function fetchDayData(
  env: Env,
  date: string,
  locale: Locale,
): Promise<{ date: string; exhibitions: ExhibitionWithLikes[]; events: EventWithLikes[] }> {
  const [rawExhibitions, rawEvents] = await Promise.all([
    getExhibitionsForDate(env, date),
    getEventsForDate(env, date),
  ]);
  const exhibitions = proxyImages(rawExhibitions);
  const events = proxyImages(rawEvents);
  const [exhCounts, evCounts] = await Promise.all([
    getLikeCounts(
      env,
      "exhibition",
      exhibitions.map((e) => e.id),
    ),
    getLikeCounts(
      env,
      "event",
      events.map((e) => e.id),
    ),
  ]);
  const exhWithLikes = attachLikeCounts(exhibitions, exhCounts);
  const evWithLikes = attachLikeCounts(events, evCounts);
  let finalExh: ExhibitionWithLikes[] = exhWithLikes;
  let finalEv: EventWithLikes[] = evWithLikes;
  if (locale !== "de") {
    const [trExh, trEv] = await Promise.all([
      translateFields(env, exhWithLikes, ["title"] as (keyof Exhibition)[], locale),
      translateFields(env, evWithLikes, ["title", "description"] as (keyof Event)[], locale),
    ]);
    finalExh = trExh.map((item, i) => {
      const orig = exhWithLikes[i] as unknown as Record<string, unknown>;
      const cur = item as unknown as Record<string, unknown>;
      return (cur.title !== orig.title ? { ...cur, translated: true } : cur) as unknown as ExhibitionWithLikes;
    });
    finalEv = trEv.map((item, i) => {
      const orig = evWithLikes[i] as unknown as Record<string, unknown>;
      const cur = item as unknown as Record<string, unknown>;
      return (cur.title !== orig.title || cur.description !== orig.description
        ? { ...cur, translated: true }
        : cur) as unknown as EventWithLikes;
    });
  }
  return { date, exhibitions: finalExh, events: finalEv };
}

export async function getExhibitionsForDate(env: Env, date: string): Promise<Exhibition[]> {
  const { results } = await env.DB.prepare(
    `SELECT e.*, m.name as museum_name, m.slug as museum_slug
     FROM exhibitions e
     JOIN museums m ON e.museum_id = m.id
     WHERE (e.start_date IS NULL OR e.start_date <= ?)
       AND (e.end_date IS NULL OR e.end_date >= ?)
     ORDER BY m.slug, e.title`,
  )
    .bind(date, date)
    .all<Exhibition>();
  return results;
}

export async function getEventsForDate(env: Env, date: string): Promise<Event[]> {
  const { results } = await env.DB.prepare(
    `SELECT ev.*, m.name as museum_name, m.slug as museum_slug
     FROM events ev
     JOIN museums m ON ev.museum_id = m.id
     WHERE ev.date = ?
     ORDER BY ev.time, m.name`,
  )
    .bind(date)
    .all<Event>();

  if (date === todayIso()) {
    return filterPastEvents(results);
  }
  return results;
}

export async function getMuseumMap(env: Env): Promise<Record<string, MuseumInfo>> {
  const { results } = await env.DB.prepare(
    "SELECT slug, name, website_url, description FROM museums ORDER BY name",
  ).all<{
    slug: string;
    name: string;
    website_url: string | null;
    description: string | null;
  }>();
  const map: Record<string, MuseumInfo> = {};
  for (const m of results) {
    const config = MUSEUMS[m.slug];
    if (config?.hidden) continue;
    const info: MuseumInfo = { name: m.name, website: m.website_url, description: m.description };
    if (config?.name) info.museumsufer = false;
    map[m.slug] = info;
  }
  return map;
}

function filterPastEvents(events: Event[]): Event[] {
  const { hour, minute } = berlinHourMinute();
  const nowMinutes = hour * 60 + minute;

  return events.filter((ev) => {
    if (!ev.time) return true;

    if (ev.end_time) {
      const [eh, em] = ev.end_time.split(":").map(Number);
      let endMinutes = eh * 60 + em;
      // Treat end times before 06:00 as next-day (e.g. "02:00" for Nacht der Museen)
      if (endMinutes < 360) endMinutes += 24 * 60;
      return nowMinutes < endMinutes;
    }

    // No end_time: assume 3 hours duration
    const [h, m] = ev.time.split(":").map(Number);
    const assumedEnd = h * 60 + m + 180;
    return nowMinutes < assumedEnd;
  });
}

async function getUpcomingEvents(env: Env, days: number): Promise<(Event & { museum_name: string })[]> {
  const today = todayIso();
  const end = dateOffset(days);
  const { results } = await env.DB.prepare(
    `SELECT ev.*, m.name as museum_name, m.slug as museum_slug
     FROM events ev
     JOIN museums m ON ev.museum_id = m.id
     WHERE ev.date >= ? AND ev.date <= ?
     ORDER BY ev.date, ev.time, m.name`,
  )
    .bind(today, end)
    .all<Event & { museum_name: string }>();
  return results;
}

function buildRss(events: (Event & { museum_name: string })[]): string {
  const items = events.map((ev) => {
    const timeStr = ev.time ? `, ${ev.time} Uhr` : "";
    const desc = ev.description ? escHtml(ev.description) : "";
    const link = ev.detail_url || ev.url || APP_URL;
    return `    <item>
      <title>${escHtml(ev.title)} — ${escHtml(ev.museum_name)}</title>
      <link>${escHtml(link)}</link>
      <guid isPermaLink="false">museumsufer-${ev.id}</guid>
      <pubDate>${new Date(`${ev.date}T${ev.time || "12:00"}:00`).toUTCString()}</pubDate>
      <description>${escHtml(`${ev.date + timeStr}. ${ev.museum_name}. ${desc}`)}</description>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Museumsufer Frankfurt</title>
    <link>${APP_URL}</link>
    <description>Veranstaltungen am Frankfurter Museumsufer</description>
    <language>de</language>
    <atom:link href="${APP_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>`;
}

function buildIcs(events: (Event & { museum_name: string })[]): string {
  const vevents = events.map((ev) => {
    const dtDate = ev.date.replace(/-/g, "");
    let dtStart: string;
    let dtEnd: string;

    if (ev.time) {
      dtStart = `DTSTART;TZID=Europe/Berlin:${dtDate}T${ev.time.replace(":", "")}00`;
      if (ev.end_time) {
        const endDtDate = ev.end_date ? ev.end_date.replace(/-/g, "") : dtDate;
        dtEnd = `DTEND;TZID=Europe/Berlin:${endDtDate}T${ev.end_time.replace(":", "")}00`;
      } else {
        const h = (parseInt(ev.time.split(":")[0], 10) + 1) % 24;
        dtEnd = `DTEND;TZID=Europe/Berlin:${dtDate}T${h.toString().padStart(2, "0")}${ev.time.split(":")[1]}00`;
      }
    } else {
      dtStart = `DTSTART;VALUE=DATE:${dtDate}`;
      dtEnd = `DTEND;VALUE=DATE:${dtDate}`;
    }

    const uid = `museumsufer-${ev.id}@museumsufer.app`;
    const summary = icsEsc(ev.title);
    const location = icsEsc(ev.museum_name);
    const desc = ev.description ? `DESCRIPTION:${icsEsc(ev.description)}\r\n` : "";
    const url = ev.detail_url || ev.url ? `URL:${ev.detail_url || ev.url}\r\n` : "";

    return `BEGIN:VEVENT\r\n${dtStart}\r\n${dtEnd}\r\nSUMMARY:${summary}\r\nLOCATION:${location}\r\n${desc}${url}UID:${uid}\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "").slice(0, 15)}Z\r\nEND:VEVENT`;
  });

  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Museumsufer Frankfurt//DE\r\nX-WR-CALNAME:Museumsufer Frankfurt\r\nX-WR-TIMEZONE:Europe/Berlin\r\nMETHOD:PUBLISH\r\n${vevents.join("\r\n")}\r\nEND:VCALENDAR`;
}

function icsEsc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function markTranslated<T>(originals: T[], translated: T[], lang: string): T[] {
  if (lang === "de") return originals;
  return translated.map((item, i) => {
    const orig = originals[i] as Record<string, unknown>;
    const cur = item as Record<string, unknown>;
    const changed = Object.keys(cur).some((k) => cur[k] !== orig[k]);
    return changed ? ({ ...item, translated: true } as T) : item;
  });
}

function json(data: unknown, status = 200, cacheControl?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };
  if (cacheControl) headers["Cache-Control"] = cacheControl;
  return new Response(JSON.stringify(data), { status, headers });
}
