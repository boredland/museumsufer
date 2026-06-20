import {
  buildIcsCalendar,
  buildRssFeed,
  buildUtm,
  dateOffset,
  type IcsEventInput,
  type RssItem,
  slugify,
  todayIso,
} from "@museumsufer/core";
import { Hono } from "hono";
import { type DayEvent, getEventById, getEventsInRange, getSourceBySlug } from "../db";
import { type AppEnv, type Env, parseCategory } from "../types";
import { APP_URL } from "./static";

const app = new Hono<AppEnv>();

const ICS_HEADERS = {
  "Content-Type": "text/calendar; charset=utf-8",
  "Cache-Control": "public, max-age=1800, s-maxage=3600",
};

const RSS_HEADERS = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, max-age=1800, s-maxage=3600",
};

app.get("/feed.ics", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const events = getEventsInRange(todayIso(), dateOffset(14), { city });
  return c.body(buildIcs(events, "lehr.salon", city), { headers: ICS_HEADERS });
});

app.get("/feed.rss", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const events = getEventsInRange(todayIso(), dateOffset(14), { city });
  return c.body(buildRss(events, city), { headers: RSS_HEADERS });
});

app.get("/feed.xml", (c) => c.redirect("/feed.rss", 301));

app.get("/quelle/:slug/feed.ics", (c) => {
  const slug = c.req.param("slug");
  const source = getSourceBySlug(slug);
  if (!source) return c.notFound();
  const city = c.get("city") ?? "frankfurt";
  const events = getEventsInRange(todayIso(), dateOffset(60), { city, source: slug });
  return c.body(buildIcs(events, source.name, city), { headers: ICS_HEADERS });
});

app.get("/format/:slug/feed.ics", (c) => {
  const category = parseCategory(c.req.param("slug"));
  if (!category) return c.notFound();
  const city = c.get("city") ?? "frankfurt";
  const events = getEventsInRange(todayIso(), dateOffset(60), { city, category });
  return c.body(buildIcs(events, `lehr.salon — ${category}`, city), { headers: ICS_HEADERS });
});

app.get("/event/:id{[0-9]+}/feed.ics", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const event = getEventById(id);
  if (!event) return c.notFound();
  const city = event.city ?? "frankfurt";
  return c.body(buildIcs([event], `${event.source.name} – ${event.title}`, city), {
    headers: {
      ...ICS_HEADERS,
      "Content-Disposition": `attachment; filename="${slugify(event.title).slice(0, 60)}-${event.date}.ics"`,
      "Cache-Control": "public, max-age=600",
    },
  });
});

export default app;

function toIcsInput(e: DayEvent, city: string): IcsEventInput {
  const domain = `${city}.lehr.salon`;
  const appUrl = `https://${domain}`;
  const utm = buildUtm(domain);
  const descLines: string[] = [];
  if (e.description) descLines.push(e.description);
  descLines.push(`[${e.category}]`);
  if (e.language && e.language.toLowerCase() !== "de") descLines.push(`Sprache: ${e.language.toUpperCase()}`);
  if (e.ticket_url) descLines.push(utm(e.ticket_url, "ics"));
  const linkSource = e.detail_url ?? e.ticket_url ?? `${appUrl}/api/events/${e.id}`;
  return {
    uid: `event-${e.id}@${domain}`,
    date: e.date,
    time: e.time ?? null,
    end_time: e.end_time ?? null,
    end_date: null,
    title: e.title,
    location: e.source.name,
    description: descLines.length ? descLines.join("\n") : null,
    detail_url: null,
    url: utm(linkSource, "ics"),
    status: "CONFIRMED",
    defaultDurationHours: 2,
  };
}

function buildIcs(events: DayEvent[], calName: string, city: string): string {
  return buildIcsCalendar({
    prodId: `-//lehr.salon//${city.toUpperCase()}//DE`,
    name: calName,
    events: events.map((e) => toIcsInput(e, city)),
  });
}

function buildRss(events: DayEvent[], city: string): string {
  const domain = `${city}.lehr.salon`;
  const appUrl = `https://${domain}`;
  const utm = buildUtm(domain);
  const items: RssItem[] = events.map((e) => {
    const dateStr = e.time ? `${e.date}T${e.time}:00+02:00` : `${e.date}T00:00:00+02:00`;
    const linkSource = e.detail_url ?? e.ticket_url ?? `${appUrl}/api/events/${e.id}`;
    const parts: string[] = [e.source.name, e.category];
    if (e.language && e.language.toLowerCase() !== "de") parts.push(e.language.toUpperCase());
    return {
      title: e.title + (e.time ? ` — ${e.time} Uhr` : ""),
      link: utm(linkSource, "rss"),
      guid: `event-${e.id}@${domain}`,
      pubDate: new Date(dateStr),
      category: e.source.name,
      description: parts.join(" — "),
    };
  });
  const cityName = city === "hamburg" ? "Hamburg" : "Frankfurt";
  return buildRssFeed({
    title: "lehr.salon",
    link: appUrl,
    selfLink: `${appUrl}/feed.rss`,
    description: `Vorträge & Diskussionen in ${cityName} — die nächsten 14 Tage`,
    language: "de",
    items,
  });
}
