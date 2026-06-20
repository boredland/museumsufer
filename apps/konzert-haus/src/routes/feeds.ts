import {
  buildIcsCalendar,
  buildRssFeed,
  buildUtm,
  cityHost,
  cityUrl,
  dateOffset,
  type IcsEventInput,
  localizeCityText,
  type RssItem,
  slugify,
  todayIso,
} from "@museumsufer/core";
import { Hono } from "hono";
import { type DayEvent, getEventById, getEventsInRange, getVenueBySlug } from "../db";
import { type Env, parseGenre } from "../types";

const APEX = "konzert.haus";
const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

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
  return c.body(buildIcs(events, "konzert.haus", city), { headers: ICS_HEADERS });
});

app.get("/feed.rss", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const events = getEventsInRange(todayIso(), dateOffset(14), { city });
  return c.body(buildRss(events, city), { headers: RSS_HEADERS });
});

app.get("/feed.xml", (c) => c.redirect("/feed.rss", 301));

app.get("/spielort/:slug/feed.ics", (c) => {
  const slug = c.req.param("slug");
  const venue = getVenueBySlug(slug);
  if (!venue) return c.notFound();
  const events = getEventsInRange(todayIso(), dateOffset(60), { venue: slug });
  return c.body(buildIcs(events, venue.name, venue.city), { headers: ICS_HEADERS });
});

app.get("/genre/:slug/feed.ics", (c) => {
  const genre = parseGenre(c.req.param("slug"));
  if (!genre) return c.notFound();
  const city = c.get("city") ?? "frankfurt";
  const events = getEventsInRange(todayIso(), dateOffset(60), { genre, city });
  return c.body(buildIcs(events, `konzert.haus — ${genre}`, city), { headers: ICS_HEADERS });
});

app.get("/event/:id{[0-9]+}/feed.ics", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const event = getEventById(id);
  if (!event) return c.notFound();
  return c.body(buildIcs([event], `${event.venue.name} – ${event.title}`, event.venue.city), {
    headers: {
      ...ICS_HEADERS,
      "Content-Disposition": `attachment; filename="${slugify(event.title).slice(0, 60)}-${event.date}.ics"`,
      "Cache-Control": "public, max-age=600",
    },
  });
});

export default app;

function toIcsInput(
  e: DayEvent,
  host: string,
  appUrl: string,
  utm: (url: string, medium: string) => string,
): IcsEventInput {
  const descLines: string[] = [];
  if (e.performers) descLines.push(e.performers);
  if (e.price_min != null) {
    descLines.push(e.price_max && e.price_max !== e.price_min ? `${e.price_min}–${e.price_max} €` : `${e.price_min} €`);
  }
  if (e.ticket_url) descLines.push(utm(e.ticket_url, "ics"));
  const linkSource = e.detail_url ?? e.ticket_url ?? `${appUrl}/api/events/${e.id}`;
  return {
    uid: `event-${e.id}@${host}`,
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

function buildIcs(events: DayEvent[], calName: string, city: string): string {
  const host = cityHost(APEX, city);
  const appUrl = cityUrl(APEX, city);
  const utm = buildUtm(host);
  return buildIcsCalendar({
    prodId: "-//konzert.haus//DE",
    name: calName,
    events: events.map((e) => toIcsInput(e, host, appUrl, utm)),
  });
}

function buildRss(events: DayEvent[], city: string): string {
  const host = cityHost(APEX, city);
  const appUrl = cityUrl(APEX, city);
  const utm = buildUtm(host);
  const items: RssItem[] = events.map((e) => {
    const dateStr = e.time ? `${e.date}T${e.time}:00+02:00` : `${e.date}T00:00:00+02:00`;
    const linkSource = e.detail_url ?? e.ticket_url ?? `${appUrl}/api/events/${e.id}`;
    const parts: string[] = [`${e.venue.name}${e.venue_room ? `, ${e.venue_room}` : ""}`];
    if (e.subtitle) parts.push(e.subtitle);
    if (e.price_min != null) {
      parts.push(e.price_max && e.price_max !== e.price_min ? `${e.price_min}–${e.price_max} €` : `${e.price_min} €`);
    }
    return {
      title: e.title + (e.time ? ` — ${e.time} Uhr` : ""),
      link: utm(linkSource, "rss"),
      guid: `event-${e.id}@${host}`,
      pubDate: new Date(dateStr),
      category: e.venue.name,
      description: parts.join(" — "),
    };
  });
  return buildRssFeed({
    title: "konzert.haus",
    link: appUrl,
    selfLink: `${appUrl}/feed.rss`,
    description: localizeCityText("Konzerte in Frankfurt und Umgebung — die nächsten 14 Tage", city, "de"),
    language: "de",
    items,
  });
}
