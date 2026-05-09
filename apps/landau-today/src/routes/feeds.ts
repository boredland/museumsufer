import { buildIcsCalendar, buildRssFeed, type IcsEventInput, type RssItem } from "@museumsufer/core";
import { Hono } from "hono";
import { dateOffset, todayIso } from "../date";
import { getEventsForRange } from "../queries";
import { APP_URL, formatDateLong, formatTime } from "../shared";
import type { Env, Event } from "../types";

const app = new Hono<{ Bindings: Env }>();

app.get("/feed.xml", (c) => {
  const events = upcoming(7);
  const xml = buildRssFeed({
    title: "landau.today",
    link: APP_URL,
    selfLink: `${APP_URL}/feed.xml`,
    description: "Veranstaltungen in Landau in der Pfalz.",
    items: events.map(toRssItem),
  });
  return c.text(xml, 200, {
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=3600",
  });
});

app.get("/rss.xml", (c) => c.redirect("/feed.xml", 301));

app.get("/feed.ics", (c) => {
  const events = upcoming(14);
  const ics = buildIcsCalendar({
    prodId: "-//landau.today//EN",
    name: "landau.today",
    events: events.map(toIcsInput),
  });
  return c.text(ics, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=3600",
  });
});

app.get("/calendar.ics", (c) => c.redirect("/feed.ics", 301));

export default app;

function upcoming(days: number): Event[] {
  return getEventsForRange(todayIso(), dateOffset(days));
}

function toRssItem(ev: Event): RssItem {
  const time = formatTime(ev.time);
  const title = `${ev.title}${time ? ` (${formatDateLong(ev.date)} ${time})` : ` (${formatDateLong(ev.date)})`}`;
  const link = `${APP_URL}/event/${ev.id}`;
  const desc = `${ev.venue ? `${ev.venue}. ` : ""}${ev.description ?? ""}`.trim();
  const pubDate = new Date(`${ev.date}T${ev.time ?? "00:00"}:00+02:00`);
  return { title, link, guid: link, pubDate, category: ev.category, description: desc };
}

function toIcsInput(ev: Event): IcsEventInput {
  return {
    uid: `${ev.id}@landau.today`,
    date: ev.date,
    time: ev.time ?? null,
    end_date: ev.end_date ?? null,
    end_time: ev.end_time ?? null,
    title: ev.title,
    location: ev.venue,
    description: ev.description ?? null,
    detail_url: `${APP_URL}/event/${ev.id}`,
  };
}
