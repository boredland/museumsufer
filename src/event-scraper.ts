import { Env } from "./types";
import { getApiConfig } from "./museum-apis";
import { fetchEventsFromApi } from "./api-scrapers";
import { todayIso, dateOffset } from "./date";

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

export async function scrapeMuseumWebsites(env: Env): Promise<{ updated: number; events: number; enriched: number; api: number }> {
  await discoverWebsiteUrls(env);

  const { results: museums } = await env.DB.prepare(
    "SELECT id, name, slug, website_url FROM museums"
  ).all<{ id: number; name: string; slug: string; website_url: string | null }>();

  let totalEvents = 0;
  let updated = 0;
  let apiCount = 0;

  for (const museum of museums) {
    try {
      const apiConfig = getApiConfig(museum.slug);

      if (apiConfig) {
        const events = await fetchEventsFromApi(apiConfig);
        let count = 0;
        for (const event of events) {
          if (!event.title || !event.date) continue;

          let targetMuseumId = museum.id;
          if (event.museum_slug_override) {
            const override = await env.DB.prepare("SELECT id FROM museums WHERE slug = ?")
              .bind(event.museum_slug_override)
              .first<{ id: number }>();
            if (override) targetMuseumId = override.id;
          }

          await env.DB.prepare(
            `INSERT INTO events (museum_id, title, date, time, end_time, end_date, description, url, detail_url, image_url, price)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(museum_id, title, date) DO UPDATE SET
               time = COALESCE(excluded.time, events.time),
               end_time = COALESCE(excluded.end_time, events.end_time),
               end_date = COALESCE(excluded.end_date, events.end_date),
               description = COALESCE(excluded.description, events.description),
               detail_url = COALESCE(excluded.detail_url, events.detail_url),
               image_url = COALESCE(excluded.image_url, events.image_url),
               price = COALESCE(excluded.price, events.price),
               updated_at = datetime('now')`
          )
            .bind(
              targetMuseumId, event.title, event.date, event.time,
              event.end_time, event.end_date,
              event.description, apiConfig.endpoint, event.detail_url,
              event.image_url, event.price
            )
            .run();
          count++;
        }
        if (count > 0) {
          totalEvents += count;
          updated++;
          apiCount++;
        }
        continue;
      }

      if (!museum.website_url) continue;

      const count = await scrapeMuseumEvents(env, museum as { id: number; name: string; website_url: string });
      if (count > 0) {
        totalEvents += count;
        updated++;
      }
    } catch (e) {
      console.error(`Failed to scrape events for ${museum.name}:`, e);
    }
  }

  const enriched = await enrichUpcomingEvents(env);

  return { updated, events: totalEvents, enriched, api: apiCount };
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

  const pageLinks = extractPageLinks(eventsHtml, baseUrl);
  const textContent = stripHtmlToText(eventsHtml);
  if (textContent.length < 100) return 0;

  const truncated = textContent.slice(0, 8000);

  const result = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Extract upcoming events from this museum's program page. Today is ${todayIso()}.

Only extract concrete events with specific dates (not permanent exhibitions or general descriptions).
Return ONLY a JSON array, nothing else. Each element:
{"title": "Event Title", "date": "YYYY-MM-DD", "time": "HH:MM" or null, "description": "brief description" or null}

If there are no events with specific dates, return an empty array: []

Text content from ${museum.name} (${eventsUrl}):
${truncated}`,
      },
    ],
  }) as Record<string, unknown>;

  const responseText = typeof result.response === "string"
    ? result.response
    : JSON.stringify(result);
  const events = extractJson<ScrapedEvent[]>(responseText);
  if (!events || events.length === 0) return 0;

  let count = 0;
  for (const event of events) {
    if (!event.title || !event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;

    const detailUrl = matchLinkForTitle(event.title, pageLinks);

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

  const result = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
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
  }) as Record<string, unknown>;

  let price: string | null = null;
  const priceResponseText = typeof result.response === "string"
    ? result.response
    : JSON.stringify(result);
  const parsed = extractJsonObject<{ price: string | null }>(priceResponseText);
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

interface PageLink {
  text: string;
  href: string;
}

function extractPageLinks(html: string, baseUrl: string): PageLink[] {
  const links: PageLink[] = [];
  const re = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!text || text.length < 3 || text.length > 200) continue;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    const normalized = normalizeUrl(href, baseUrl);
    if (normalized) links.push({ text, href: normalized });
  }
  return links;
}

function matchLinkForTitle(title: string, links: PageLink[]): string | null {
  const titleLower = title.toLowerCase().trim();
  const titleWords = titleLower.split(/\s+/).filter(w => w.length > 2);

  let bestMatch: { href: string; score: number } | null = null;

  for (const link of links) {
    const linkText = link.text.toLowerCase();

    if (linkText === titleLower) return link.href;

    if (titleLower.includes(linkText) || linkText.includes(titleLower)) {
      const score = Math.min(titleLower.length, linkText.length);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { href: link.href, score };
      }
      continue;
    }

    let matchingWords = 0;
    for (const word of titleWords) {
      if (linkText.includes(word)) matchingWords++;
    }
    if (titleWords.length > 0 && matchingWords / titleWords.length >= 0.6) {
      const score = matchingWords;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { href: link.href, score };
      }
    }

    const slugFromUrl = link.href.split("/").pop()?.replace(/-/g, " ").toLowerCase() || "";
    let slugWords = 0;
    for (const word of titleWords) {
      if (slugFromUrl.includes(word)) slugWords++;
    }
    if (titleWords.length > 0 && slugWords / titleWords.length >= 0.5) {
      const score = slugWords + 0.5;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { href: link.href, score };
      }
    }
  }

  return bestMatch ? bestMatch.href : null;
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

