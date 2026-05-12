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
import { type DayEvent, getEventById, getEventsInRange, getVenueBySlug } from "../db";
import { type Env, parseGenre } from "../types";
import { APP_URL } from "./static";

const utm = buildUtm("frankfurt.konzert.haus");
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
  return c.body(buildIcs(events, "konzert.haus"), { headers: ICS_HEADERS });
});

app.get("/feed.rss", (c) => {
  const events = getEventsInRange(todayIso(), dateOffset(14));
  return c.body(buildRss(events), { headers: RSS_HEADERS });
});

app.get("/feed.xml", (c) => c.redirect("/feed.rss", 301));

app.get("/spielort/:slug/feed.ics", (c) => {
  const slug = c.req.param("slug");
  const venue = getVenueBySlug(slug);
  if (!venue) return c.notFound();
  const events = getEventsInRange(todayIso(), dateOffset(60), { venue: slug });
  return c.body(buildIcs(events, venue.name), { headers: ICS_HEADERS });
});

app.get("/genre/:slug/feed.ics", (c) => {
  const genre = parseGenre(c.req.param("slug"));
  if (!genre) return c.notFound();
  const events = getEventsInRange(todayIso(), dateOffset(60), { genre });
  return c.body(buildIcs(events, `konzert.haus — ${genre}`), { headers: ICS_HEADERS });
});

app.get("/event/:id{[0-9]+}/feed.ics", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const event = getEventById(id);
  if (!event) return c.notFound();
  return c.body(buildIcs([event], `${event.venue.name} – ${event.title}`), {
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
  if (e.performers) descLines.push(e.performers);
  if (e.price_min != null) {
    descLines.push(e.price_max && e.price_max !== e.price_min ? `${e.price_min}–${e.price_max} €` : `${e.price_min} €`);
  }
  if (e.ticket_url) descLines.push(utm(e.ticket_url, "ics"));
  const linkSource = e.detail_url ?? e.ticket_url ?? `${APP_URL}/api/events/${e.id}`;
  return {
    uid: `event-${e.id}@frankfurt.konzert.haus`,
    date: e.date,
    time: e.time ?? null,
    end_time: e.end_time ?? null,
    end_date: null,
    title: [e.title, e.subtitle].filter(Boolean).join(" — "),
    location: e.venue_room ? `${e.venue.name} — ${e.venue_room}` : e.venue.name,
    description: descLines.length ? descLines.join("\n") : null,
    detail_url: null,
    url: utm(linkSource, "ics"),
    status: "CONFIRMED",
    defaultDurationHours: 2,
  };
}

function buildIcs(events: DayEvent[], calName: string): string {
  return buildIcsCalendar({
    prodId: "-//konzert.haus//DE",
    name: calName,
    events: events.map(toIcsInput),
  });
}

function buildRss(events: DayEvent[]): string {
  const items: RssItem[] = events.map((e) => {
    const dateStr = e.time ? `${e.date}T${e.time}:00+02:00` : `${e.date}T00:00:00+02:00`;
    const linkSource = e.detail_url ?? e.ticket_url ?? `${APP_URL}/api/events/${e.id}`;
    const parts: string[] = [`${e.venue.name}${e.venue_room ? `, ${e.venue_room}` : ""}`];
    if (e.subtitle) parts.push(e.subtitle);
    if (e.price_min != null) {
      parts.push(e.price_max && e.price_max !== e.price_min ? `${e.price_min}–${e.price_max} €` : `${e.price_min} €`);
    }
    return {
      title: e.title + (e.time ? ` — ${e.time} Uhr` : ""),
      link: utm(linkSource, "rss"),
      guid: `event-${e.id}@frankfurt.konzert.haus`,
      pubDate: new Date(dateStr),
      category: e.venue.name,
      description: parts.join(" — "),
    };
  });
  return buildRssFeed({
    title: "konzert.haus",
    link: APP_URL,
    selfLink: `${APP_URL}/feed.rss`,
    description: "Konzerte in Frankfurt und Umgebung — die nächsten 14 Tage",
    language: "de",
    items,
  });
}
