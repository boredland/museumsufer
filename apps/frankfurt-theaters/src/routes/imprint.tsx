import { buildImprintSections, cityAdj, cityHost, cityMeta, cityUrl } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { ClientScript, Footer, Grain, Head } from "../frontend";
import type { Env } from "../types";
import { REPO_URL } from "./static";

const APEX = "ins.theater";

// Operator is a single legal entity based in Frankfurt regardless of which
// city's programme is served — its address is not localized.
const OPERATOR = {
  name: "Jonas Strassel",
  email: "feedback@ins.theater",
  city: "Frankfurt am Main, Germany",
};

function sectionsFor(city: string) {
  return buildImprintSections({
    operator: OPERATOR,
    dataSourceCopy:
      `Spielpläne, Vorstellungstermine, Kartenpreise und Verfügbarkeiten werden automatisiert von den öffentlichen ` +
      `Webseiten der jeweiligen ${cityAdj(city, "de")} Bühnen aggregiert. Die Rechte an den Inhalten verbleiben bei den jeweiligen ` +
      "Häusern. Diese Seite hat keinerlei kommerzielle Beziehung zu den gelisteten Theatern und übernimmt keine " +
      "Verantwortung für die Richtigkeit der angezeigten Daten — bitte prüfen Sie alle Angaben vor dem Kartenkauf auf " +
      "der Webseite des Hauses.",
    sourceUrl: `${REPO_URL}/tree/main/apps/frankfurt-theaters`,
  });
}

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

app.get("/impressum", (c) => {
  const turnstileSiteKey = c.env.TURNSTILE_SITE_KEY;
  const city = c.get("city") ?? "frankfurt";
  const appUrl = cityUrl(APEX, city);
  const brand = `${cityMeta(city).short} Theater`;
  const SECTIONS = sectionsFor(city);
  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="de">
        <head>
          <Head
            title={`Impressum · ${brand}`}
            description={`Kontakt, Verantwortlichkeit und rechtliche Hinweise zu ${cityHost(APEX, city)}.`}
            canonical={`${appUrl}/impressum`}
            appUrl={appUrl}
            turnstileSiteKey={turnstileSiteKey}
          />
          <meta name="robots" content="noindex,follow" />
        </head>
        <body>
          <Grain />
          <header class="masthead masthead--legal">
            <a class="masthead__brand" href="/" aria-label={`${brand} Startseite`}>
              <h1 class="wordmark">
                <span>{cityMeta(city).short}</span>
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
