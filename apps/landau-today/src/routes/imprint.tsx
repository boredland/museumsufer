import { Hono } from "hono";
import { APP_URL } from "../shared";
import type { Env } from "../types";

const OPERATOR = {
  name: "Jonas Strassel",
  email: "feedback@landau.today",
  city: "Frankfurt am Main, Germany",
};

const REPO_URL = "https://github.com/boredland/museumsufer";

const app = new Hono<{ Bindings: Env }>();

app.get("/impressum", (c) =>
  c.html(renderImprint(), 200, {
    "Content-Language": "de",
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  }),
);

app.get("/imprint", (c) => c.redirect("/impressum", 301));

function renderImprint(): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Impressum · landau.today</title>
<meta name="description" content="Kontakt, Verantwortlichkeit und rechtliche Hinweise zu landau.today." />
<meta name="theme-color" content="#f2ead3" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${APP_URL}/impressum" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;1,6..96,400&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500&display=swap"
  rel="stylesheet"
/>
<link rel="stylesheet" href="/styles.css" />
</head>
<body>
<header class="masthead">
  <h1><a href="/">Landau<span class="ampersand">&amp;</span>heute</a></h1>
  <p class="subtitle">Impressum &amp; Verantwortliche</p>
</header>
<main id="content" style="max-width:48rem;margin:0 auto;padding:0 1rem 4rem">
  <p style="margin:1rem 0"><a href="/">← Zurück zum Veranstaltungsblatt</a></p>
  <h2>Impressum</h2>

  <h3>Anbieter (TMG §5)</h3>
  <p>${OPERATOR.name}<br />${OPERATOR.city}</p>

  <h3>Kontakt</h3>
  <p><a href="mailto:${OPERATOR.email}">${OPERATOR.email}</a></p>

  <h3>Inhaltlich Verantwortlicher gemäß §18 Abs. 2 MStV</h3>
  <p>${OPERATOR.name}, ${OPERATOR.city}</p>

  <h3>Datenherkunft</h3>
  <p>
    Veranstaltungstermine werden automatisiert aus öffentlichen Quellen aggregiert:
    Kulturnetz Landau, Stadt Landau, Stiftung Hambacher Schloss, RPTU Kaiserslautern-Landau,
    Pfalz.de und Südliche Weinstraße Tourismus. Die Rechte an den Inhalten verbleiben
    bei den jeweiligen Veranstaltern. Diese Seite hat keinerlei kommerzielle Beziehung zu
    den gelisteten Veranstaltern und übernimmt keine Verantwortung für die Richtigkeit
    der angezeigten Daten — bitte prüfen Sie alle Angaben vor Ihrem Besuch beim Veranstalter.
  </p>

  <h3>Haftungsausschluss</h3>
  <p>
    Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die
    Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich
    deren Betreiber verantwortlich.
  </p>

  <h3>Quellcode</h3>
  <p>
    <a href="${REPO_URL}/tree/main/apps/landau-today" target="_blank" rel="noopener">
      ${REPO_URL.replace("https://", "")}
    </a>
  </p>
</main>
<footer class="colophon-foot" style="max-width:48rem;margin:0 auto;padding:0 1rem 2rem">
  <span>Landau heute · Heimatzeitung für Veranstaltungen</span>
</footer>
</body>
</html>`;
}

export default app;
