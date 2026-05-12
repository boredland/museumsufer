import { dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getEventsInRange } from "../db";
import { Event, Footer, GENRE_LABELS, Grain, Head, Masthead } from "../frontend";
import { type Env, parseGenre } from "../types";
import { APP_URL } from "./static";

const app = new Hono<{ Bindings: Env }>();

app.get("/genre/:slug", (c) => {
  const genre = parseGenre(c.req.param("slug"));
  if (!genre) return c.notFound();
  const slug = genre;
  const events = getEventsInRange(todayIso(), dateOffset(60), { genre });
  const label = GENRE_LABELS[genre];

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="de">
        <head>
          <Head
            title={`${label} — konzert.haus`}
            description={`${label}-Konzerte in Frankfurt und Umgebung. ${events.length} Termin${events.length === 1 ? "" : "e"} in den nächsten 60 Tagen.`}
            canonical={`${APP_URL}/genre/${slug}`}
            extraLinks={[
              { rel: "alternate", type: "text/calendar", href: `/genre/${slug}/feed.ics`, title: `${label} – iCal` },
            ]}
          />
        </head>
        <body>
          <Grain />
          <Masthead />
          <main class="programme">
            <section class="venue-hero">
              <p class="venue-hero__kicker">Genre</p>
              <h2 class="venue-hero__name">{label}</h2>
              <p class="venue-hero__meta">
                <a href={`/genre/${slug}/feed.ics`}>iCal abonnieren</a>
              </p>
            </section>

            {events.length === 0 ? (
              <div class="empty">
                <p class="empty__mark">∅</p>
                <p>Aktuell keine angekündigten {label}-Konzerte.</p>
              </div>
            ) : (
              <ol class="concerts">
                {events.map((e, i) => (
                  <Event key={e.id} e={e} opts={{ index: i }} />
                ))}
              </ol>
            )}
          </main>
          <Footer />
        </body>
      </html>
    </>,
  );
});

export default app;
