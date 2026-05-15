import { buildImprintSections } from "@museumsufer/core";
import { Hono } from "hono";
import { raw } from "hono/html";
import { Footer, Foxing, Head, Masthead } from "../frontend";
import { detectLocale, getTranslations } from "../i18n";
import type { Env } from "../types";
import { APP_URL, REPO_URL } from "./static";

const OPERATOR = {
  name: "Jonas Strassel",
  email: "feedback@lehr.salon",
  city: "Frankfurt am Main, Germany",
};

const SECTIONS = buildImprintSections({
  operator: OPERATOR,
  dataSourceCopy:
    "Termine, Beschreibungen und Programminformationen werden automatisiert von den öffentlichen Webseiten der jeweiligen " +
    "Institutionen aggregiert. Die Rechte an den Inhalten verbleiben bei den jeweiligen Veranstaltern. Diese Seite hat " +
    "keinerlei kommerzielle Beziehung zu den gelisteten Häusern und übernimmt keine Verantwortung für die Richtigkeit " +
    "der angezeigten Daten — bitte prüfen Sie alle Angaben vor einem Besuch auf der Webseite des Veranstalters.",
  sourceUrl: `${REPO_URL}/tree/main/apps/lehrhaus`,
});

const app = new Hono<{ Bindings: Env }>();

app.get("/impressum", (c) => {
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  const currentPath = "/impressum";
  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title="Impressum · lehr.salon"
            description="Kontakt, Verantwortlichkeit und rechtliche Hinweise zu lehr.salon."
            canonical={`${APP_URL}/impressum`}
            locale={locale}
            currentPath={currentPath}
          />
          <meta name="robots" content="index,follow" />
        </head>
        <body>
          <Foxing />
          <Masthead tr={tr} locale={locale} currentPath={currentPath} />
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
