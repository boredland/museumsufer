import { buildImprintSections, cityUrl } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { Footer, Grain, Head, Masthead } from "../frontend";
import { detectLocale, getTranslations, localizeTranslations } from "../i18n";
import type { Env } from "../types";
import { REPO_URL } from "./static";

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

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

app.get("/impressum", (c) => {
  const locale = detectLocale(c.req.raw);
  const city = c.get("city") ?? "frankfurt";
  const appUrl = cityUrl("konzert.haus", city);
  const tr = localizeTranslations(getTranslations(locale), city, locale);
  const currentPath = "/impressum";
  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title="Impressum · konzert.haus"
            description="Kontakt, Verantwortlichkeit und rechtliche Hinweise zu konzert.haus."
            canonical={`${appUrl}/impressum`}
            locale={locale}
            currentPath={currentPath}
            appUrl={appUrl}
          />
          <meta name="robots" content="noindex,follow" />
        </head>
        <body>
          <Grain />
          <Masthead tr={tr} locale={locale} currentPath={currentPath} city={city} />
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
          <Footer tr={tr} locale={locale} />
        </body>
      </html>
    </>,
    {
      headers: {
        "Content-Language": locale,
        Vary: "Accept-Language",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
});

app.get("/imprint", (c) => c.redirect("/impressum", 301));

export default app;
