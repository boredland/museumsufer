import { dateOffset, todayIso } from "@museumsufer/core";
import { Hono } from "hono";
import { getEventsInRange } from "../db";
import {
  escapeHtml,
  GENRE_LABELS,
  renderEvent,
  renderFooter,
  renderGrain,
  renderHead,
  renderMasthead,
} from "../frontend";
import { type Env, parseGenre } from "../types";
import { APP_URL } from "./static";

const app = new Hono<{ Bindings: Env }>();

app.get("/genre/:slug", (c) => {
  const genre = parseGenre(c.req.param("slug"));
  if (!genre) return c.notFound();
  const slug = genre;
  const events = getEventsInRange(todayIso(), dateOffset(60), { genre });
  const label = GENRE_LABELS[genre];

  const head = renderHead({
    title: `${label} — konzert.haus`,
    description: `${label}-Konzerte in Frankfurt und Umgebung. ${events.length} Termin${events.length === 1 ? "" : "e"} in den nächsten 60 Tagen.`,
    canonical: `${APP_URL}/genre/${slug}`,
    extraLinks: [
      { rel: "alternate", type: "text/calendar", href: `/genre/${slug}/feed.ics`, title: `${label} – iCal` },
    ],
  });

  return c.html(`<!doctype html>
<html lang="de">
<head>
${head}
</head>
<body>
${renderGrain()}
${renderMasthead()}

<main class="programme">
  <section class="venue-hero">
    <p class="venue-hero__kicker">Genre</p>
    <h2 class="venue-hero__name">${escapeHtml(label)}</h2>
    <p class="venue-hero__meta">
      <a href="/genre/${slug}/feed.ics">iCal abonnieren</a>
    </p>
  </section>

  ${
    events.length === 0
      ? `<div class="empty"><p class="empty__mark">∅</p><p>Aktuell keine angekündigten ${escapeHtml(label)}-Konzerte.</p></div>`
      : `<ol class="concerts">${events.map((e, i) => renderEvent(e, { index: i })).join("")}</ol>`
  }
</main>

${renderFooter()}
</body>
</html>`);
});

export default app;
