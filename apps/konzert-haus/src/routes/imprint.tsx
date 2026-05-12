import { buildImprintSections } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { Footer, Grain, Head } from "../frontend";
import { DEFAULT_LOCALE, getTranslations } from "../i18n";
import type { Env } from "../types";
import { APP_URL, REPO_URL } from "./static";

const OPERATOR = {
  name: "Jonas Strassel",
  email: "feedback@konzert.haus",
  city: "Frankfurt am Main, Germany",
};

const SECTIONS = buildImprintSections({
  operator: OPERATOR,
  dataSourceCopy:
    "Konzerttermine, Programme und Kartenpreise werden automatisiert von den öffentlichen Webseiten der jeweiligen " +
    "Spielorte aggregiert. Die Rechte an den Inhalten verbleiben bei den jeweiligen Veranstaltern. Diese Seite hat " +
    "keinerlei kommerzielle Beziehung zu den gelisteten Häusern und übernimmt keine Verantwortung für die Richtigkeit " +
    "der angezeigten Daten — bitte prüfen Sie alle Angaben vor dem Kartenkauf auf der Webseite des Veranstalters.",
  sourceUrl: `${REPO_URL}/tree/main/apps/konzert-haus`,
});

const app = new Hono<{ Bindings: Env }>();

app.get("/impressum", (c) =>
  c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="de">
        <head>
          <Head
            title="Impressum · konzert.haus"
            description="Kontakt, Verantwortlichkeit und rechtliche Hinweise zu konzert.haus."
            canonical={`${APP_URL}/impressum`}
          />
          <meta name="robots" content="index,follow" />
        </head>
        <body>
          <Grain />
          <header class="masthead">
            <a class="masthead__brand" href="/">
              <h1 class="wordmark">
                <span class="wordmark__konzert">konzert</span>
                <span class="wordmark__dot">.</span>
                <span class="wordmark__haus">haus</span>
              </h1>
              <p class="tagline">Impressum &amp; Verantwortliche</p>
            </a>
            <hr class="masthead__rule" />
          </header>
          <main class="programme">
            <p>
              <a href="/">← Zum Programm</a>
            </p>
            <h2>Impressum</h2>
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h3>{s.heading}</h3>
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
          <Footer tr={getTranslations(DEFAULT_LOCALE)} locale={DEFAULT_LOCALE} />
        </body>
      </html>
    </>,
    {
      headers: {
        "Content-Language": "de",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  ),
);

app.get("/imprint", (c) => c.redirect("/impressum", 301));

export default app;
