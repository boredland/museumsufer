import { Hono } from "hono";
import { raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { detectLocale, getTranslations, type Locale, type Translations } from "../i18n";
import { APP_URL } from "../shared";
import type { Env } from "../types";

const OPERATOR = {
  name: "Jonas Strassel",
  email: "feedback@landau.today",
  city: "Frankfurt am Main, Germany",
};

const REPO_URL = "https://github.com/boredland/museumsufer";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;1,6..96,400&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500&display=swap";

const app = new Hono<{ Bindings: Env }>();

app.get("/impressum", (c) => {
  const locale = detectLocale(c.req.raw);
  const tr = getTranslations(locale);
  return c.html(renderImprint(locale, tr), 200, {
    "Content-Language": locale,
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    Vary: "Accept-Language",
  });
});

app.get("/imprint", (c) => c.redirect("/impressum", 301));

function ImprintPage({ locale, tr }: { locale: Locale; tr: Translations }) {
  const homeHref = locale === "fr" ? "/?lang=fr" : "/";
  return (
    <>
      {raw("<!doctype html>")}
      <html lang={locale}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <title>{`${tr.imprintTitle} · landau.today`}</title>
          <meta name="description" content={tr.imprintTitle} />
          <meta name="theme-color" content="#f2ead3" />
          <meta name="robots" content="index,follow" />
          <link rel="canonical" href={`${APP_URL}/impressum`} />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link href={FONT_HREF} rel="stylesheet" />
          <link rel="stylesheet" href="/styles.css" />
        </head>
        <body>
          <header class="masthead">
            <h1>
              <a href={homeHref}>
                Landau<span class="ampersand">&amp;</span>heute
              </a>
            </h1>
            <p class="subtitle">{tr.imprintTitle}</p>
          </header>
          <main id="content" style="max-width:48rem;margin:0 auto;padding:0 1rem 4rem">
            <p style="margin:1rem 0">
              <a href={homeHref}>← {tr.imprintBack}</a>
            </p>
            <h2>{tr.imprintTitle}</h2>
            <h3>{tr.imprintProvider}</h3>
            <p>
              {OPERATOR.name}
              <br />
              {OPERATOR.city}
            </p>
            <h3>{tr.imprintContact}</h3>
            <p>
              <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
            </p>
            <h3>{tr.imprintResponsible}</h3>
            <p>
              {OPERATOR.name}, {OPERATOR.city}
            </p>
            <h3>{tr.imprintDataSource}</h3>
            <p>{tr.imprintDataSourceBody}</p>
            <h3>{tr.imprintDisclaimer}</h3>
            <p>{tr.imprintDisclaimerBody}</p>
            <h3>{tr.imprintSource}</h3>
            <p>
              <a href={`${REPO_URL}/tree/main/apps/landau-today`} target="_blank" rel="noopener">
                {REPO_URL.replace("https://", "")}
              </a>
            </p>
          </main>
          <footer class="colophon-foot" style="max-width:48rem;margin:0 auto;padding:0 1rem 2rem">
            <span>{tr.footerLine}</span>
          </footer>
        </body>
      </html>
    </>
  );
}

function renderImprint(locale: Locale, tr: Translations): HtmlEscapedString {
  return (<ImprintPage locale={locale} tr={tr} />) as unknown as HtmlEscapedString;
}

export default app;
