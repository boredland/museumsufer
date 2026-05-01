import { fetchEventsFromApi } from "./api-scrapers";
import { dateOffset, todayIso } from "./date";
import { fetchPage } from "./fetch-utils";
import { getMuseumConfig, MUSEUMS } from "./museum-config";
import { normalizeUrl } from "./shared";
import type { Env } from "./types";

const PLACEHOLDER_TITLE_RE =
  /^(event title|sample event|placeholder|untitled|tba|tbd|lorem|beispiel(?:event| ?titel)?|test event|veranstaltung \d+)\s*\d*\s*$/i;

function isPlaceholderTitle(title: string): boolean {
  return PLACEHOLDER_TITLE_RE.test(title.trim());
}

const EVENT_PAGE_PATHS = [
  "/programm",
  "/de/programm",
  "/veranstaltungen",
  "/de/veranstaltungen",
  "/kalender",
  "/de/kalender",
  "/events",
  "/de/events",
  "/termine",
  "/de/termine",
  "/besuch/veranstaltungen",
  "/de/besuch/veranstaltungen",
  "/besuch/programm",
  "/de/besuch/programm",
];

export async function scrapeMuseumWebsites(
  env: Env,
): Promise<{ updated: number; events: number; enriched: number; api: number }> {
  await discoverWebsiteUrls(env);

  const { results: museums } = await env.DB.prepare("SELECT id, name, slug, website_url FROM museums").all<{
    id: number;
    name: string;
    slug: string;
    website_url: string | null;
  }>();

  const results = await runWithConcurrency(museums, 5, async (museum) => {
    try {
      return await processMuseum(env, museum);
    } catch (e) {
      console.error(`Failed to scrape events for ${museum.name}:`, e);
      return { events: 0, api: false };
    }
  });

  const totalEvents = results.reduce((sum, r) => sum + r.events, 0);
  const updated = results.filter((r) => r.events > 0).length;
  const apiCount = results.filter((r) => r.api).length;

  const enriched = await enrichUpcomingEvents(env);

  return { updated, events: totalEvents, enriched, api: apiCount };
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function processMuseum(
  env: Env,
  museum: { id: number; name: string; slug: string; website_url: string | null },
): Promise<{ events: number; api: boolean }> {
  const museumConfig = getMuseumConfig(museum.slug);

  if (museumConfig?.skipEvents && !museumConfig.eventApi) return { events: 0, api: false };

  if (museumConfig?.eventApi) {
    const eventApi = museumConfig.eventApi;
    const proxy =
      museumConfig.proxy && env.FETCH_PROXY_URL
        ? { url: env.FETCH_PROXY_URL, token: env.FETCH_PROXY_TOKEN }
        : undefined;
    const events = await fetchEventsFromApi(eventApi, proxy);

    const validEvents = events
      .filter((e) => e.title && e.date)
      .map((e) => ({
        ...e,
        title: e.title.replace(/\\"/g, '"').replace(/\\'/g, "'"),
        description: e.description ? e.description.replace(/\\"/g, '"').replace(/\\'/g, "'") : e.description,
      }));

    const overrideSlugs = Array.from(
      new Set(validEvents.map((e) => e.museum_slug_override).filter((s): s is string => !!s)),
    );
    const overrideMap = new Map<string, number>();
    if (overrideSlugs.length > 0) {
      const placeholders = overrideSlugs.map(() => "?").join(",");
      const { results } = await env.DB.prepare(`SELECT id, slug FROM museums WHERE slug IN (${placeholders})`)
        .bind(...overrideSlugs)
        .all<{ id: number; slug: string }>();
      for (const r of results) overrideMap.set(r.slug, r.id);
    }

    const insertSql = `INSERT INTO events (museum_id, title, date, time, end_time, end_date, description, url, detail_url, image_url, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(museum_id, title, date) DO UPDATE SET
         time = COALESCE(excluded.time, events.time),
         end_time = COALESCE(excluded.end_time, events.end_time),
         end_date = COALESCE(excluded.end_date, events.end_date),
         description = COALESCE(excluded.description, events.description),
         detail_url = COALESCE(excluded.detail_url, events.detail_url),
         image_url = COALESCE(excluded.image_url, events.image_url),
         price = COALESCE(excluded.price, events.price),
         updated_at = datetime('now')`;

    const statements = validEvents.map((event) => {
      const targetMuseumId = (event.museum_slug_override && overrideMap.get(event.museum_slug_override)) || museum.id;
      return env.DB.prepare(insertSql).bind(
        targetMuseumId,
        event.title,
        event.date,
        event.time,
        event.end_time,
        event.end_date,
        event.description,
        eventApi.endpoint,
        event.detail_url,
        event.image_url,
        event.price,
      );
    });

    if (statements.length > 0) await env.DB.batch(statements);
    return { events: statements.length, api: statements.length > 0 };
  }

  if (!museum.website_url) return { events: 0, api: false };

  const count = await scrapeMuseumEvents(
    env,
    museum as { id: number; name: string; slug: string; website_url: string },
  );
  return { events: count, api: false };
}

async function discoverWebsiteUrls(env: Env): Promise<void> {
  const { results: museums } = await env.DB.prepare(
    "SELECT id, museumsufer_url FROM museums WHERE website_url IS NULL AND museumsufer_url LIKE '%museumsufer.de%'",
  ).all<{ id: number; museumsufer_url: string }>();

  for (const museum of museums) {
    try {
      const res = await fetch(museum.museumsufer_url);
      if (!res.ok) continue;
      const html = await res.text();

      const match = html.match(/href="(https?:\/\/[^"]+)"[^>]*class="[^"]*margRight15\s+externelLink/);
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
  museum: { id: number; name: string; slug: string; website_url: string },
): Promise<number> {
  const baseUrl = museum.website_url.replace(/\/$/, "");
  const config = MUSEUMS[museum.slug];
  const fetchOpts = config ? { spa: config.spa, proxy: config.proxy } : undefined;
  let eventsHtml: string | null = null;
  let eventsUrl: string | null = null;

  const candidates = EVENT_PAGE_PATHS.map((path) => `${baseUrl}${path}`);
  const results = await Promise.all(
    candidates.map(async (url) => {
      const html = await fetchPage(env, url, fetchOpts);
      return html ? { url, html } : null;
    }),
  );
  const found = results.find((r) => r !== null);
  if (found) {
    eventsHtml = found.html;
    eventsUrl = found.url;
  }

  if (!eventsHtml || !eventsUrl) {
    try {
      const html = await fetchPage(env, baseUrl, fetchOpts);
      if (html) {
        const eventLink = findEventLink(html, baseUrl);
        if (eventLink) {
          eventsHtml = await fetchPage(env, eventLink, fetchOpts);
          eventsUrl = eventLink;
        }
      }
    } catch {
      return 0;
    }
  }

  if (!eventsHtml) return 0;

  const cached = await env.DB.prepare("SELECT events_html_hash, events_scraped_at FROM museums WHERE id = ?")
    .bind(museum.id)
    .first<{ events_html_hash: string | null; events_scraped_at: string | null }>();
  const hash = await sha256(stripHtmlToText(eventsHtml));
  const now = Date.now();
  const lastScrapedMs = cached?.events_scraped_at ? Date.parse(`${cached.events_scraped_at}Z`) : 0;
  if (cached?.events_html_hash === hash && now - lastScrapedMs < 24 * 60 * 60 * 1000) {
    return 0;
  }

  const pageLinks = extractPageLinks(eventsHtml, baseUrl);
  const textContent = stripHtmlToText(eventsHtml);
  if (textContent.length < 100) return 0;

  const truncated = textContent.slice(0, 8000);

  const result = (await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Extract upcoming events from this museum's program page. Today is ${todayIso()}.

Rules:
- Only extract concrete events with specific dates that appear verbatim in the text below.
- Do NOT invent, paraphrase, or generate placeholder events. Never use generic titles like "Event Title 1", "Sample Event", "TBA", etc.
- If the page has no concrete dated events, return [] — empty is the correct answer.
- Skip permanent exhibitions and general descriptions.

Return ONLY a JSON array, nothing else. Each element:
{"title": <exact title from text>, "date": "YYYY-MM-DD", "time": "HH:MM" or null, "description": <short snippet from text> or null}

Text content from ${museum.name} (${eventsUrl}):
${truncated}`,
      },
    ],
  })) as Record<string, unknown>;

  await env.DB.prepare("UPDATE museums SET events_html_hash = ?, events_scraped_at = datetime('now') WHERE id = ?")
    .bind(hash, museum.id)
    .run();

  const responseText = typeof result.response === "string" ? result.response : JSON.stringify(result);
  const events = extractJson<ScrapedEvent[]>(responseText);
  if (!events || events.length === 0) return 0;

  const insertSql = `INSERT INTO events (museum_id, title, date, time, description, url, detail_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(museum_id, title, date) DO UPDATE SET
       time = excluded.time,
       description = excluded.description,
       detail_url = COALESCE(excluded.detail_url, events.detail_url),
       updated_at = datetime('now')`;

  const statements = events
    .filter(
      (event) =>
        event.title &&
        event.date &&
        /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
        !isPlaceholderTitle(event.title) &&
        textContent.toLowerCase().includes(event.title.toLowerCase().slice(0, 12)),
    )
    .map((event) => {
      const title = event.title.replace(/\\"/g, '"').replace(/\\'/g, "'");
      const description = event.description ? event.description.replace(/\\"/g, '"').replace(/\\'/g, "'") : null;
      const detailUrl = matchLinkForTitle(title, pageLinks);
      return env.DB.prepare(insertSql).bind(
        museum.id,
        title,
        event.date,
        event.time,
        description,
        eventsUrl,
        detailUrl,
      );
    });

  if (statements.length > 0) await env.DB.batch(statements);
  return statements.length;
}

async function enrichUpcomingEvents(env: Env): Promise<number> {
  const today = todayIso();
  const weekAhead = dateOffset(7);

  const { results: events } = await env.DB.prepare(
    `SELECT ev.id, ev.detail_url, ev.title, ev.price, ev.image_url, ev.time, ev.description, m.name as museum_name, m.website_url
     FROM events ev
     JOIN museums m ON ev.museum_id = m.id
     WHERE ev.date >= ? AND ev.date <= ?
       AND ev.detail_url IS NOT NULL
       AND (ev.price IS NULL OR ev.image_url IS NULL OR ev.time IS NULL OR ev.description IS NULL)
     LIMIT 30`,
  )
    .bind(today, weekAhead)
    .all<{
      id: number;
      detail_url: string;
      title: string;
      price: string | null;
      image_url: string | null;
      time: string | null;
      description: string | null;
      museum_name: string;
      website_url: string;
    }>();

  const detailResults = await Promise.all(
    events.map(async (event) => {
      try {
        return await fetchEventDetails(env, event.detail_url, event.title, event.museum_name, event.website_url);
      } catch {
        return null;
      }
    }),
  );

  const statements: D1PreparedStatement[] = [];
  let enriched = 0;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const details = detailResults[i];
    if (!details) continue;

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (details.price && !event.price) {
      updates.push("price = ?");
      values.push(details.price);
    }
    if (details.image_url && !event.image_url) {
      updates.push("image_url = ?");
      values.push(details.image_url);
    }
    if (details.time && !event.time) {
      updates.push("time = ?");
      values.push(details.time);
    }
    if (details.end_time) {
      updates.push("end_time = ?");
      values.push(details.end_time);
    }
    if (details.description && !event.description) {
      updates.push("description = ?");
      values.push(details.description);
    }

    if (updates.length === 0) {
      statements.push(
        env.DB.prepare(
          "UPDATE events SET price = COALESCE(price, ''), description = COALESCE(description, ''), updated_at = datetime('now') WHERE id = ?",
        ).bind(event.id),
      );
      continue;
    }

    updates.push("updated_at = datetime('now')");
    statements.push(env.DB.prepare(`UPDATE events SET ${updates.join(", ")} WHERE id = ?`).bind(...values, event.id));
    enriched++;
  }

  if (statements.length > 0) await env.DB.batch(statements);
  return enriched;
}

function extractTimeFromHtml(html: string): { time: string | null; end_time: string | null } {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const rangeMatch = text.match(/(\d{1,2}[:.]\d{2})\s*(?:–|-)\s*(\d{1,2}[:.]\d{2})\s*(?:Uhr|h)?/);
  if (rangeMatch) {
    return {
      time: rangeMatch[1].replace(".", ":"),
      end_time: rangeMatch[2].replace(".", ":"),
    };
  }
  const singleMatch = text.match(/(\d{1,2}[:.]\d{2})\s*(?:Uhr|h)/);
  if (singleMatch) {
    return { time: singleMatch[1].replace(".", ":"), end_time: null };
  }
  const commaMatch = text.match(/\d{2}\.\d{2}\.\d{4},?\s*(\d{1,2}[:.]\d{2})/);
  if (commaMatch) {
    return { time: commaMatch[1].replace(".", ":"), end_time: null };
  }
  return { time: null, end_time: null };
}

async function fetchEventDetails(
  _env: Env,
  detailUrl: string,
  title: string,
  _museumName: string,
  _websiteUrl: string,
): Promise<{
  price: string | null;
  image_url: string | null;
  time: string | null;
  end_time: string | null;
  description: string | null;
} | null> {
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
  const { time, end_time } = extractTimeFromHtml(html);
  const description = extractDescriptionFromHtml(html, title);
  const price = extractPriceFromHtml(html);

  return { price, image_url: imageUrl, time, end_time, description };
}

const AMOUNT = String.raw`\d+(?:[.,]\d{1,2})?(?:,-)?`;
const PRICE_TOKEN = String.raw`(?:€\s*${AMOUNT}|${AMOUNT}\s*(?:€|Euro|EUR))`;
const PRICE_RANGE = new RegExp(
  String.raw`${PRICE_TOKEN}(?:\s*(?:\/|–|-|bis)\s*${PRICE_TOKEN}(?:\s*(?:erm[äa]ßigt|reduziert|ermäßigt))?)?`,
  "i",
);

export function extractPriceFromHtml(html: string): string | null {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const scope = findContentScope(stripped);
  const text = decodeEntities(scope.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

  const eintrittFree = text.match(/Eintritt:?\s*(frei|kostenlos|kostenfrei)\b/i);
  if (eintrittFree) return "Eintritt frei";

  const eintrittPrice = text.match(new RegExp(String.raw`Eintritt:?\s*(${PRICE_RANGE.source})`, "i"));
  if (eintrittPrice) return `Eintritt ${eintrittPrice[1].trim()}`.replace(/\s+/g, " ");

  if (/\b(?:kostenlos|kostenfrei|Eintritt\s+frei|free\s+admission)\b/i.test(text)) {
    return "Eintritt frei";
  }

  const priceMatch = text.match(PRICE_RANGE);
  if (priceMatch) return priceMatch[0].replace(/\s+/g, " ").trim();

  return null;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ndash;": "–",
  "&mdash;": "—",
  "&#8211;": "–",
  "&#8212;": "—",
  "&#8216;": "‘",
  "&#8217;": "’",
  "&#8220;": "“",
  "&#8221;": "”",
  "&hellip;": "…",
  "&#8230;": "…",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

const DATETIME_ONLY = /^\s*\d{1,2}[.\s]\s?[\w.]+\s?\d{0,4}.{0,40}(?:Uhr|h)?\s*$/i;

const CAPTION_HINT = /(©|Photo:|Foto:|Courtesy)/i;
const CONTENT_CONTAINERS = [
  /<div[^>]*\bclass="(?:[^"]*\s)?(?:page-content|entry-content|wp-block-post-content|event-description|single-event-content|content-area|main-content|c-event-description|event-content)(?:\s[^"]*)?"[^>]*>/i,
  /<article\b[^>]*>/i,
  /<main\b[^>]*>/i,
];

function findContentScope(html: string): string {
  for (const re of CONTENT_CONTAINERS) {
    const m = re.exec(html);
    if (!m) continue;
    const start = m.index + m[0].length;
    const slice = html.slice(start, start + 60000);
    if (slice.length > 200) return slice;
  }
  return html;
}

export function extractDescriptionFromHtml(html: string, title: string): string | null {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const scope = findContentScope(stripped);
  const titleLower = title.toLowerCase().slice(0, 60);

  const paragraphs: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null = re.exec(scope);
  while (m !== null) {
    let text = m[1].replace(/<[^>]+>/g, " ");
    text = decodeEntities(text);
    text = text.replace(/\s+/g, " ").trim();
    if (
      text.length >= 80 &&
      !text.toLowerCase().startsWith(titleLower) &&
      !DATETIME_ONLY.test(text) &&
      !CAPTION_HINT.test(text.slice(0, 120))
    ) {
      paragraphs.push(text);
    }
    if (paragraphs.join(" ").length > 600) break;
    m = re.exec(scope);
  }

  if (paragraphs.length === 0) return null;
  let out = paragraphs.join(" ");
  if (out.length > 600) {
    const cut = out.slice(0, 600);
    const lastSpace = cut.lastIndexOf(" ");
    out = `${cut.slice(0, lastSpace > 0 ? lastSpace : 600)}…`;
  }
  return out;
}

export function extractImageFromHtml(html: string, pageUrl: string): string | null {
  const baseUrl = new URL(pageUrl).origin;
  const pageDomain = new URL(pageUrl).hostname;

  const ogMatch =
    html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i) ||
    html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i);
  if (ogMatch) {
    const ogUrl = normalizeUrl(ogMatch[1], baseUrl);
    if (ogUrl && isSameDomain(ogUrl, pageDomain)) return ogUrl;
  }

  const mainContent =
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html;

  const imgRe = /<img[^>]+src="([^"]+)"/gi;
  let match;
  while ((match = imgRe.exec(mainContent)) !== null) {
    const src = match[1];
    if (!isContentImage(src)) continue;
    const url = normalizeUrl(src, baseUrl);
    if (url && isSameDomain(url, pageDomain)) return url;
  }

  return null;
}

function isContentImage(src: string): boolean {
  const lower = src.toLowerCase();
  if (!/\.(jpg|jpeg|png|webp)/.test(lower)) return false;
  if (/logo|icon|favicon|sprite|banner|partner|sponsor|social|button|badge/i.test(lower)) return false;
  if (/1x1|pixel|tracking|spacer/i.test(lower)) return false;
  return true;
}

function isSameDomain(url: string, pageDomain: string): boolean {
  try {
    const imgDomain = new URL(url).hostname;
    return imgDomain === pageDomain || imgDomain.endsWith(`.${pageDomain}`) || pageDomain.endsWith(`.${imgDomain}`);
  } catch {
    return true;
  }
}

export interface PageLink {
  text: string;
  href: string;
}

export function extractPageLinks(html: string, baseUrl: string): PageLink[] {
  const links: PageLink[] = [];
  const re = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const href = match[1];
    const text = match[2]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text.length < 3 || text.length > 200) continue;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    const normalized = normalizeUrl(href, baseUrl);
    if (normalized) links.push({ text, href: normalized });
  }
  return links;
}

export function matchLinkForTitle(title: string, links: PageLink[]): string | null {
  const titleLower = title.toLowerCase().trim();
  const titleWords = titleLower.split(/\s+/).filter((w) => w.length > 2);

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
  const patterns = [/href="([^"]*(?:programm|veranstaltung|kalender|events)[^"]*)"/gi];
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

export function stripHtmlToText(html: string): string {
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

export function extractJson<T>(text: string): T | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
