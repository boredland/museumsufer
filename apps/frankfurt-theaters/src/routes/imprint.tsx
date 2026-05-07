import { Hono } from "hono";
import { renderClientScript, renderFooter, renderGrain, renderHead } from "../frontend";
import type { Env } from "../types";
import { APP_URL, REPO_URL } from "./static";

const OPERATOR = {
  name: "Jonas Strassel",
  email: "feedback@ins.theater",
  city: "Frankfurt am Main, Germany",
};

const app = new Hono<{ Bindings: Env }>();

app.get("/impressum", (c) => {
  const head = renderHead({
    title: "Impressum · Frankfurt Theater",
    description: "Kontakt, Verantwortlichkeit und rechtliche Hinweise zu frankfurt.ins.theater.",
    canonical: `${APP_URL}/impressum`,
  });

  return c.html(
    `<!doctype html>
<html lang="de">
<head>
${head}
<meta name="robots" content="index,follow" />
</head>
<body>
${renderGrain()}

<header class="masthead masthead--legal" role="banner">
  <a class="masthead__brand" href="/" aria-label="Frankfurt Theater Startseite">
    <h1 class="wordmark"><span>Frankfurt</span><span>Theater.</span></h1>
    <p class="tagline">Impressum &amp; Verantwortliche</p>
  </a>
</header>

<main class="legal">
  <p class="legal__back"><a href="/">← Zum Spielplan</a></p>
  <h2 class="legal__title">Impressum</h2>

  <section class="legal__block">
    <h3 class="legal__kicker">Anbieter (TMG §5)</h3>
    <p>${OPERATOR.name}<br />${OPERATOR.city}</p>
  </section>

  <section class="legal__block">
    <h3 class="legal__kicker">Kontakt</h3>
    <p><a href="mailto:${OPERATOR.email}">${OPERATOR.email}</a></p>
  </section>

  <section class="legal__block">
    <h3 class="legal__kicker">Inhaltlich Verantwortlicher gemäß §18 Abs. 2 MStV</h3>
    <p>${OPERATOR.name}, ${OPERATOR.city}</p>
  </section>

  <section class="legal__block">
    <h3 class="legal__kicker">Datenherkunft</h3>
    <p>
      Spielpläne, Vorstellungstermine, Kartenpreise und Verfügbarkeiten werden automatisiert von den
      öffentlichen Webseiten der jeweiligen Frankfurter Bühnen aggregiert. Die Rechte an den Inhalten
      verbleiben bei den jeweiligen Häusern. Diese Seite hat keinerlei kommerzielle Beziehung zu den
      gelisteten Theatern und übernimmt keine Verantwortung für die Richtigkeit der angezeigten
      Daten — bitte prüfen Sie alle Angaben vor dem Kartenkauf auf der Webseite des Hauses.
    </p>
  </section>

  <section class="legal__block">
    <h3 class="legal__kicker">Haftungsausschluss</h3>
    <p>
      Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte
      externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber
      verantwortlich.
    </p>
  </section>

  <section class="legal__block">
    <h3 class="legal__kicker">Quellcode</h3>
    <p><a href="${REPO_URL}/tree/main/apps/frankfurt-theaters" target="_blank" rel="noopener">${REPO_URL.replace("https://", "")}</a></p>
  </section>
</main>

${renderFooter()}

${renderClientScript()}
</body>
</html>`,
    {
      headers: {
        "Content-Language": "de",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
});

app.get("/imprint", (c) => c.redirect("/impressum", 301));

export default app;
