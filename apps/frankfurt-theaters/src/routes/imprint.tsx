import { buildImprintSections } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { ClientScript, Footer, Grain, Head } from "../frontend";
import type { Env } from "../types";
import { APP_URL, REPO_URL } from "./static";

const OPERATOR = {
  name: "Jonas Strassel",
  email: "feedback@ins.theater",
  city: "Frankfurt am Main, Germany",
};

const SECTIONS = buildImprintSections({
  operator: OPERATOR,
  dataSourceCopy:
    "Spielpläne, Vorstellungstermine, Kartenpreise und Verfügbarkeiten werden automatisiert von den öffentlichen " +
    "Webseiten der jeweiligen Frankfurter Bühnen aggregiert. Die Rechte an den Inhalten verbleiben bei den jeweiligen " +
    "Häusern. Diese Seite hat keinerlei kommerzielle Beziehung zu den gelisteten Theatern und übernimmt keine " +
    "Verantwortung für die Richtigkeit der angezeigten Daten — bitte prüfen Sie alle Angaben vor dem Kartenkauf auf " +
    "der Webseite des Hauses.",
  sourceUrl: `${REPO_URL}/tree/main/apps/frankfurt-theaters`,
});

const app = new Hono<{ Bindings: Env }>();

app.get("/impressum", (c) => {
  const turnstileSiteKey = c.env.TURNSTILE_SITE_KEY;
  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="de">
        <head>
          <Head
            title="Impressum · Frankfurt Theater"
            description="Kontakt, Verantwortlichkeit und rechtliche Hinweise zu frankfurt.ins.theater."
            canonical={`${APP_URL}/impressum`}
            turnstileSiteKey={turnstileSiteKey}
          />
          <meta name="robots" content="index,follow" />
        </head>
        <body>
          <Grain />
          <header class="masthead masthead--legal">
            <a class="masthead__brand" href="/" aria-label="Frankfurt Theater Startseite">
              <h1 class="wordmark">
                <span>Frankfurt</span>
                <span>Theater.</span>
              </h1>
              <p class="tagline">Impressum &amp; Verantwortliche</p>
            </a>
          </header>
          <main class="legal">
            <p class="legal__back">
              <a href="/">← Zum Spielplan</a>
            </p>
            <h2 class="legal__title">Impressum</h2>

            {SECTIONS.map((s) => (
              <section key={s.heading} class="legal__block">
                <h3 class="legal__kicker">{s.heading}</h3>
                {s.body.length > 0 ? (
                  <p>
                    {s.body.map((line, i) => (
                      <>
                        {i > 0 ? <br /> : null}
                        {line}
                      </>
                    ))}
                  </p>
                ) : null}
                {s.links?.map((l) => (
                  <p key={l.href}>
                    <a
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noopener" : undefined}
                    >
                      {l.label}
                    </a>
                  </p>
                ))}
              </section>
            ))}
          </main>
          <Footer turnstileSiteKey={turnstileSiteKey} />
          <ClientScript />
        </body>
      </html>
    </>,
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
