import {
  buildIcsCalendar,
  buildRssFeed,
  buildUtm,
  cityHost,
  cityMeta,
  cityName,
  cityUrl,
  dateOffset,
  type IcsEventInput,
  type RssItem,
  slugify,
  todayIso,
} from "@museumsufer/core";
import { Hono } from "hono";
import { type DayScreening, getCinemaBySlug, getScreeningById, getScreeningsInRange, getSeriesScreenings } from "../db";
import { getTranslations, localizeTranslations } from "../i18n";
import type { Env } from "../types";
import { REPO_URL } from "./static";

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
  const host = cityHost("lichtspiel.haus", city);
  const appUrl = cityUrl("lichtspiel.haus", city);
  const localUtm = buildUtm(host);
  const screenings = getScreeningsInRange(todayIso(), dateOffset(14));
  return c.body(buildIcs(screenings, "lichtspiel.haus", localUtm, appUrl, host), { headers: ICS_HEADERS });
});

app.get("/feed.rss", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const host = cityHost("lichtspiel.haus", city);
  const appUrl = cityUrl("lichtspiel.haus", city);
  const localUtm = buildUtm(host);
  const screenings = getScreeningsInRange(todayIso(), dateOffset(14));
  return c.body(buildRss(screenings, city, localUtm, appUrl, host), { headers: RSS_HEADERS });
});

app.get("/feed.xml", (c) => c.redirect("/feed.rss", 301));

app.get("/kino/:slug/feed.ics", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const host = cityHost("lichtspiel.haus", city);
  const appUrl = cityUrl("lichtspiel.haus", city);
  const localUtm = buildUtm(host);
  const slug = c.req.param("slug");
  const cinema = getCinemaBySlug(slug);
  if (!cinema) return c.notFound();
  const screenings = getScreeningsInRange(todayIso(), dateOffset(60), { cinema: slug });
  return c.body(buildIcs(screenings, cinema.name, localUtm, appUrl, host), { headers: ICS_HEADERS });
});

app.get("/reihe/:slug/feed.ics", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const host = cityHost("lichtspiel.haus", city);
  const appUrl = cityUrl("lichtspiel.haus", city);
  const localUtm = buildUtm(host);
  const slug = c.req.param("slug");
  const screenings = getSeriesScreenings(slug, todayIso());
  if (screenings.length === 0) return c.notFound();
  const name = screenings[0].series?.name ?? slug;
  return c.body(buildIcs(screenings, `lichtspiel.haus — ${name}`, localUtm, appUrl, host), { headers: ICS_HEADERS });
});

app.get("/film/:id{[0-9]+}/feed.ics", (c) => {
  const city = c.get("city") ?? "frankfurt";
  const host = cityHost("lichtspiel.haus", city);
  const appUrl = cityUrl("lichtspiel.haus", city);
  const localUtm = buildUtm(host);
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const screening = getScreeningById(id);
  if (!screening) return c.notFound();
  return c.body(buildIcs([screening], `${screening.cinema.name} – ${screening.title}`, localUtm, appUrl, host), {
    headers: {
      ...ICS_HEADERS,
      "Content-Disposition": `attachment; filename="${slugify(screening.title).slice(0, 60)}-${screening.date}.ics"`,
      "Cache-Control": "public, max-age=600",
    },
  });
});

export default app;

function toIcsInput(s: DayScreening, utm: ReturnType<typeof buildUtm>, appUrl: string, host: string): IcsEventInput {
  const descLines: string[] = [];
  if (s.credits) descLines.push(s.credits);
  if (s.version) descLines.push(s.version);
  if (s.format) descLines.push(s.format);
  if (s.price_min != null) {
    descLines.push(s.price_max && s.price_max !== s.price_min ? `${s.price_min}–${s.price_max} €` : `${s.price_min} €`);
  }
  if (s.ticket_url) descLines.push(utm(s.ticket_url, "ics"));
  const linkSource = s.detail_url ?? s.ticket_url ?? `${appUrl}/film/${s.id}`;
  return {
    uid: `screening-${s.id}@${host}`,
    date: s.date,
    time: s.time ?? null,
    end_time: s.end_time ?? null,
    end_date: null,
    title: [s.title, s.subtitle].filter(Boolean).join(" — "),
    location: s.venue_room ? `${s.cinema.name} — ${s.venue_room}` : s.cinema.name,
    description: descLines.length ? descLines.join("\n") : null,
    detail_url: null,
    url: utm(linkSource, "ics"),
    status: "CONFIRMED",
    defaultDurationHours: 2,
  };
}

function buildIcs(
  screenings: DayScreening[],
  calName: string,
  utm: ReturnType<typeof buildUtm>,
  appUrl: string,
  host: string,
): string {
  return buildIcsCalendar({
    prodId: "-//lichtspiel.haus//DE",
    name: calName,
    events: screenings.map((s) => toIcsInput(s, utm, appUrl, host)),
  });
}

function buildRss(
  screenings: DayScreening[],
  city: string,
  utm: ReturnType<typeof buildUtm>,
  appUrl: string,
  host: string,
): string {
  const tr = localizeTranslations(
    {
      homeDescription: "Kinoprogramm in Frankfurt und Umgebung — die nächsten 14 Tage",
    } as any,
    city,
    "de",
  );
  const items: RssItem[] = screenings.map((s) => {
    const dateStr = s.time ? `${s.date}T${s.time}:00+02:00` : `${s.date}T00:00:00+02:00`;
    const linkSource = s.detail_url ?? s.ticket_url ?? `${appUrl}/film/${s.id}`;
    const parts: string[] = [`${s.cinema.name}${s.venue_room ? `, ${s.venue_room}` : ""}`];
    if (s.subtitle) parts.push(s.subtitle);
    if (s.version) parts.push(s.version);
    if (s.format) parts.push(s.format);
    if (s.price_min != null) {
      parts.push(s.price_max && s.price_max !== s.price_min ? `${s.price_min}–${s.price_max} €` : `${s.price_min} €`);
    }
    return {
      title: s.title + (s.time ? ` — ${s.time} Uhr` : ""),
      link: utm(linkSource, "rss"),
      guid: `screening-${s.id}@${host}`,
      pubDate: new Date(dateStr),
      category: s.cinema.name,
      description: parts.join(" — "),
    };
  });
  return buildRssFeed({
    title: "lichtspiel.haus",
    link: appUrl,
    selfLink: `${appUrl}/feed.rss`,
    description: tr.homeDescription,
    language: "de",
    items,
  });
}
