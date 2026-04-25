import { Env } from "./types";

const BASE_URL = "https://www.museumsufer.de";

const EVENT_PAGE_PATHS = [
  "/programm",
  "/de/programm",
  "/veranstaltungen",
  "/de/veranstaltungen",
  "/kalender",
  "/de/kalender",
  "/events",
  "/de/events",
  "/besuch/veranstaltungen",
  "/de/besuch/veranstaltungen",
  "/besuch/programm",
  "/de/besuch/programm",
];

export async function scrapeMuseumWebsites(env: Env): Promise<{ updated: number; events: number; enriched: number }> {
  await discoverWebsiteUrls(env);

  const { results: museums } = await env.DB.prepare(
    "SELECT id, name, website_url FROM museums WHERE website_url IS NOT NULL"
  ).all<{ id: number; name: string; website_url: string }>();

  let totalEvents = 0;
  let updated = 0;

  for (const museum of museums) {
    try {
      const count = await scrapeMuseumEvents(env, museum);
      if (count > 0) {
        totalEvents += count;
        updated++;
      }
    } catch (e) {
      console.error(`Failed to scrape events for ${museum.name}:`, e);
    }
  }

  const enriched = await enrichUpcomingEvents(env);

  return { updated, events: totalEvents, enriched };
}

async function discoverWebsiteUrls(env: Env): Promise<void> {
  const { results: museums } = await env.DB.prepare(
    "SELECT id, museumsufer_url FROM museums WHERE website_url IS NULL AND museumsufer_url LIKE '%museumsufer.de%'"
  ).all<{ id: number; museumsufer_url: string }>();

  for (const museum of museums) {
    try {
      const res = await fetch(museum.museumsufer_url);
      if (!res.ok) continue;
      const html = await res.text();

      const match = html.match(
        /href="(https?:\/\/[^"]+)"[^>]*class="[^"]*margRight15\s+externelLink/
      );
      if (!match) continue;

      const websiteUrl = match[1];
      if (websiteUrl.includes("kultur-frankfurt.de")) continue;

      await env.DB.prepare("UPDATE museums SET website_url = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(websiteUrl, museum.id)
        .run();
    } catch (e) {
      console.error(`Failed to discover website for museum ${museum.id}:`, e);
    }
  }
}

interface ScrapedEvent {
  title: string;
  date: string;
  time: string | null;
  description: string | null;
  detail_url: string | null;
}

async function scrapeMuseumEvents(
  env: Env,
  museum: { id: number; name: string; website_url: string }
): Promise<number> {
  const baseUrl = museum.website_url.replace(/\/$/, "");
  let eventsHtml: string | null = null;
  let eventsUrl: string | null = null;

  for (const path of EVENT_PAGE_PATHS) {
    try {
      const url = `${baseUrl}${path}`;
      const res = await fetch(url, { redirect: "follow" });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          eventsHtml = await res.text();
          eventsUrl = url;
          break;
        }
      }
    } catch {
      continue;
    }
  }

  if (!eventsHtml || !eventsUrl) {
    try {
      const res = await fetch(baseUrl, { redirect: "follow" });
      if (res.ok) {
        const html = await res.text();
        const eventLink = findEventLink(html, baseUrl);
        if (eventLink) {
          const eventRes = await fetch(eventLink, { redirect: "follow" });
          if (eventRes.ok) {
            eventsHtml = await eventRes.text();
            eventsUrl = eventLink;
          }
        }
      }
    } catch {
      return 0;
    }
  }

  if (!eventsHtml) return 0;

  const textContent = stripHtmlToText(eventsHtml);
  if (textContent.length < 100) return 0;

  const truncated = textContent.slice(0, 8000);

  const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      {
        role: "user",
        content: `Extract upcoming events from this museum's program page. Today is ${todayIso()}.

Only extract concrete events with specific dates (not permanent exhibitions or general descriptions).
Return ONLY a JSON array, nothing else. Each element:
{"title": "Event Title", "date": "YYYY-MM-DD", "time": "HH:MM" or null, "description": "brief description" or null, "detail_url": "relative or absolute URL to the event detail page" or null}

For detail_url: extract the href of the link wrapping each event title/card. Use the exact href value from the page, whether relative or absolute.

If there are no events with specific dates, return an empty array: []

Text content from ${museum.name} (${eventsUrl}):
${truncated}`,
      },
    ],
  }) as { response: string };

  const events = extractJson<ScrapedEvent[]>(result.response);
  if (!events || events.length === 0) return 0;

  let count = 0;
  for (const event of events) {
    if (!event.title || !event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;

    const detailUrl = normalizeUrl(event.detail_url, baseUrl);

    await env.DB.prepare(
      `INSERT INTO events (museum_id, title, date, time, description, url, detail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(museum_id, title, date) DO UPDATE SET
         time = excluded.time,
         description = excluded.description,
         detail_url = COALESCE(excluded.detail_url, events.detail_url),
         updated_at = datetime('now')`
    )
      .bind(
        museum.id,
        event.title,
        event.date,
        event.time,
        event.description,
        eventsUrl,
        detailUrl
      )
      .run();
    count++;
  }

  return count;
}

async function enrichUpcomingEvents(env: Env): Promise<number> {
  const today = todayIso();
  const weekAhead = dateOffset(7);

  const { results: events } = await env.DB.prepare(
    `SELECT ev.id, ev.detail_url, ev.price, ev.image_url, m.name as museum_name, m.website_url
     FROM events ev
     JOIN museums m ON ev.museum_id = m.id
     WHERE ev.date >= ? AND ev.date <= ?
       AND ev.detail_url IS NOT NULL
       AND (ev.price IS NULL AND ev.image_url IS NULL)
     LIMIT 30`
  )
    .bind(today, weekAhead)
    .all<{
      id: number;
      detail_url: string;
      price: string | null;
      image_url: string | null;
      museum_name: string;
      website_url: string;
    }>();

  let enriched = 0;

  for (const event of events) {
    try {
      const details = await fetchEventDetails(env, event.detail_url, event.museum_name, event.website_url);
      if (!details) continue;

      const updates: string[] = [];
      const values: (string | null)[] = [];

      if (details.price) {
        updates.push("price = ?");
        values.push(details.price);
      }
      if (details.image_url) {
        updates.push("image_url = ?");
        values.push(details.image_url);
      }

      if (updates.length === 0) {
        // Mark as checked so we don't re-fetch
        await env.DB.prepare("UPDATE events SET price = '', updated_at = datetime('now') WHERE id = ?")
          .bind(event.id)
          .run();
        continue;
      }

      updates.push("updated_at = datetime('now')");
      await env.DB.prepare(
        `UPDATE events SET ${updates.join(", ")} WHERE id = ?`
      )
        .bind(...values, event.id)
        .run();
      enriched++;
    } catch (e) {
      console.error(`Failed to enrich event ${event.id}:`, e);
    }
  }

  return enriched;
}

async function fetchEventDetails(
  env: Env,
  detailUrl: string,
  museumName: string,
  websiteUrl: string
): Promise<{ price: string | null; image_url: string | null } | null> {
  let html: string;
  try {
    const res = await fetch(detailUrl, { redirect: "follow" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const imageUrl = extractImageFromHtml(html, detailUrl);

  const textContent = stripHtmlToText(html).slice(0, 6000);
  if (textContent.length < 50) return { price: null, image_url: imageUrl };

  const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      {
        role: "user",
        content: `Extract price/cost information from this event detail page for "${museumName}".

Look for: admission price, ticket cost, "Eintritt", "€", "kostenlos", "kostenfrei", "frei", "inklusive Museumseintritt", etc.

Return ONLY a JSON object, nothing else:
{"price": "the price text exactly as shown, e.g. '8 €', 'Eintritt frei', 'kostenlos', '12 € / 8 € ermäßigt'" or null}

If no price information is found, return: {"price": null}

Page content:
${textContent}`,
      },
    ],
  }) as { response: string };

  let price: string | null = null;
  const parsed = extractJsonObject<{ price: string | null }>(result.response);
  if (parsed?.price && parsed.price !== "null") {
    price = parsed.price;
  }

  return { price, image_url: imageUrl };
}

function extractImageFromHtml(html: string, pageUrl: string): string | null {
  const baseUrl = new URL(pageUrl).origin;

  // Look for og:image first (most reliable)
  const ogMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i)
    || html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i);
  if (ogMatch) {
    return normalizeUrl(ogMatch[1], baseUrl);
  }

  // Look for a prominent image in the main content area
  const mainContent = html.match(/<main[\s\S]*?<\/main>/i)?.[0]
    || html.match(/<article[\s\S]*?<\/article>/i)?.[0]
    || html;

  const imgMatch = mainContent.match(/<img[^>]+src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
    || mainContent.match(/<img[^>]+src="(\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);

  if (imgMatch) {
    return normalizeUrl(imgMatch[1], baseUrl);
  }

  return null;
}

function normalizeUrl(url: string | null | undefined, baseUrl: string): string | null {
  if (!url) return null;
  url = url.trim();
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${baseUrl.replace(/\/$/, "")}${url}`;
  return `${baseUrl.replace(/\/$/, "")}/${url}`;
}

function findEventLink(html: string, baseUrl: string): string | null {
  const patterns = [
    /href="([^"]*(?:programm|veranstaltung|kalender|events)[^"]*)"/gi,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) {
      const href = match[1];
      if (href.startsWith("http")) return href;
      if (href.startsWith("/")) return `${baseUrl}${href}`;
    }
  }
  return null;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJson<T>(text: string): T | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

function extractJsonObject<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
