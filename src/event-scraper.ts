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

export async function scrapeMuseumWebsites(env: Env): Promise<{ updated: number; events: number }> {
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

  return { updated, events: totalEvents };
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
    // Try fetching the homepage and looking for an events link
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
        content: `Extract upcoming events from this museum's program page. Today is ${new Date().toISOString().slice(0, 10)}.

Only extract concrete events with specific dates (not permanent exhibitions or general descriptions).
Return ONLY a JSON array, nothing else. Each element:
{"title": "Event Title", "date": "YYYY-MM-DD", "time": "HH:MM" or null, "description": "brief description" or null}

If there are no events with specific dates, return an empty array: []

Text content from ${museum.name} (${eventsUrl}):
${truncated}`,
      },
    ],
  }) as { response: string };

  const events = extractJson<Array<{
    title: string;
    date: string;
    time: string | null;
    description: string | null;
  }>>(result.response);

  if (!events || events.length === 0) return 0;

  let count = 0;
  for (const event of events) {
    if (!event.title || !event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;

    await env.DB.prepare(
      `INSERT INTO events (museum_id, title, date, time, description, url)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`
    )
      .bind(
        museum.id,
        event.title,
        event.date,
        event.time,
        event.description,
        eventsUrl
      )
      .run();
    count++;
  }

  return count;
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
