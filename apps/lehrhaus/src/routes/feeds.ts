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
import { type Env, parseCategory } from "../types";
import { APP_URL } from "./static";

const utm = buildUtm("frankfurt.lehr.salon");
const app = new Hono<{ Bindings: Env }>();

const ICS_HEADERS = {
  "Content-Type": "text/calendar; charset=utf-8",
  "Cache-Control": "public, max-age=1800, s-maxage=3600",
};

const RSS_HEADERS = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, max-age=1800, s-maxage=3600",
};

app.get("/feed.ics", (c) => {
  const events = getEventsInRange(todayIso(), dateOffset(14));
  return c.body(buildIcs(events, "lehr.salon"), { headers: ICS_HEADERS });
});

app.get("/feed.rss", (c) => {
  const events = getEventsInRange(todayIso(), dateOffset(14));
  return c.body(buildRss(events), { headers: RSS_HEADERS });
});

app.get("/feed.xml", (c) => c.redirect("/feed.rss", 301));

app.get("/quelle/:slug/feed.ics", (c) => {
  const slug = c.req.param("slug");
  const source = getSourceBySlug(slug);
  if (!source) return c.notFound();
  const events = getEventsInRange(todayIso(), dateOffset(60), { source: slug });
  return c.body(buildIcs(events, source.name), { headers: ICS_HEADERS });
});

app.get("/format/:slug/feed.ics", (c) => {
  const category = parseCategory(c.req.param("slug"));
  if (!category) return c.notFound();
  const events = getEventsInRange(todayIso(), dateOffset(60), { category });
  return c.body(buildIcs(events, `lehr.salon — ${category}`), { headers: ICS_HEADERS });
});

app.get("/event/:id{[0-9]+}/feed.ics", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const event = getEventById(id);
  if (!event) return c.notFound();
  return c.body(buildIcs([event], `${event.source.name} – ${event.title}`), {
    headers: {
      ...ICS_HEADERS,
      "Content-Disposition": `attachment; filename="${slugify(event.title).slice(0, 60)}-${event.date}.ics"`,
      "Cache-Control": "public, max-age=600",
    },
  });
});

export default app;

function toIcsInput(e: DayEvent): IcsEventInput {
  const descLines: string[] = [];
  if (e.description) descLines.push(e.description);
  descLines.push(`[${e.category}]`);
  if (e.language && e.language.toLowerCase() !== "de") descLines.push(`Sprache: ${e.language.toUpperCase()}`);
  if (e.ticket_url) descLines.push(utm(e.ticket_url, "ics"));
  const linkSource = e.detail_url ?? e.ticket_url ?? `${APP_URL}/api/events/${e.id}`;
  return {
    uid: `event-${e.id}@frankfurt.lehr.salon`,
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

function buildIcs(events: DayEvent[], calName: string): string {
  return buildIcsCalendar({
    prodId: "-//lehr.salon//DE",
    name: calName,
    events: events.map(toIcsInput),
  });
}

function buildRss(events: DayEvent[]): string {
  const items: RssItem[] = events.map((e) => {
    const dateStr = e.time ? `${e.date}T${e.time}:00+02:00` : `${e.date}T00:00:00+02:00`;
    const linkSource = e.detail_url ?? e.ticket_url ?? `${APP_URL}/api/events/${e.id}`;
    const parts: string[] = [e.source.name, e.category];
    if (e.language && e.language.toLowerCase() !== "de") parts.push(e.language.toUpperCase());
    return {
      title: e.title + (e.time ? ` — ${e.time} Uhr` : ""),
      link: utm(linkSource, "rss"),
      guid: `event-${e.id}@frankfurt.lehr.salon`,
      pubDate: new Date(dateStr),
      category: e.source.name,
      description: parts.join(" — "),
    };
  });
  return buildRssFeed({
    title: "lehr.salon",
    link: APP_URL,
    selfLink: `${APP_URL}/feed.rss`,
    description: "Vorträge & Diskussionen in Frankfurt — die nächsten 14 Tage",
    language: "de",
    items,
  });
}
