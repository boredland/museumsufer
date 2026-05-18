import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://eschborn-k.de";
const REST_URL = `${BASE}/wp-json/wp/v2/mec-events?per_page=50&orderby=date&order=desc`;
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

interface MecEvent {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
}

const JSON_LD_RE = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;

interface ScheduleOrgEvent {
  "@type"?: string;
  startDate?: string;
  endDate?: string;
  name?: string;
  description?: string;
  offers?: { price?: string | number } | { price?: string | number }[];
  image?: string;
}

/**
 * Eschborn K is a multi-purpose stage/cinema in the city's culture house.
 * WordPress with Modern Events Calendar (MEC). The list endpoint gives us
 * post slugs; the actual show date+time lives in a Schema.org Event
 * JSON-LD block on each detail page, so we fan out one fetch per event.
 */
export async function scrapeEschbornK(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const listRes = await fetch(REST_URL, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!listRes.ok) throw new Error(`eschborn-k list fetch failed: ${listRes.status}`);
  const posts = (await listRes.json()) as MecEvent[];

  const detailResults = await Promise.all(
    posts.map(async (post) => {
      try {
        const r = await fetch(post.link, { headers: { "User-Agent": UA } });
        if (!r.ok) return null;
        return { post, html: await r.text() };
      } catch {
        return null;
      }
    }),
  );

  const events: CanonicalScrapedEvent[] = [];
  for (const result of detailResults) {
    if (!result) continue;
    const { post, html } = result;
    const event = extractEventLd(html);
    if (!event?.startDate) continue;
    const [date, timeFull] = event.startDate.split("T");
    if (!date || date < today) continue;
    const time = timeFull ? timeFull.slice(0, 5) : null;
    const endTime = event.endDate?.includes("T") ? event.endDate.split("T")[1].slice(0, 5) : null;

    const title = decodeHtmlEntities(stripHtml(post.title.rendered)).trim();
    if (!title) continue;
    const description = post.excerpt?.rendered ? stripHtml(post.excerpt.rendered).replace(/\s+/g, " ").trim() : null;

    const labels: ScrapedLabel[] = labelsFor(title, description);

    events.push({
      source_event_id: String(post.id),
      title,
      description,
      date,
      time,
      end_time: endTime && endTime !== time ? endTime : null,
      detail_url: post.link,
      ticket_url: getPriceUrl(event) ?? post.link,
      labels,
    });
  }

  return { source_slug: "eschborn-k", display_name: "Eschborn K", events };
}

function extractEventLd(html: string): ScheduleOrgEvent | null {
  for (const m of html.matchAll(JSON_LD_RE)) {
    try {
      const parsed = JSON.parse(m[1].trim()) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === "object" && "@type" in item && (item as { "@type": string })["@type"] === "Event") {
          return item as ScheduleOrgEvent;
        }
      }
    } catch {}
  }
  return null;
}

function getPriceUrl(event: ScheduleOrgEvent): string | null {
  const offers = Array.isArray(event.offers) ? event.offers[0] : event.offers;
  return offers && typeof offers === "object" && "url" in offers ? ((offers as { url?: string }).url ?? null) : null;
}

function labelsFor(title: string, description: string | null): ScrapedLabel[] {
  const type = classifyEvent(title, description);
  if (type === "Film") return [{ label: "film:cinema", confidence: 0.85, classifier: "keyword:event" }];
  if (type === "Konzert") return [{ label: "music:classical", confidence: 0.7, classifier: "keyword:event" }];
  const label = eventTypeToLabel(type) ?? "event:venue";
  return [{ label, confidence: 0.7, classifier: "keyword:event" }];
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
