import { buildImprintSections, type ImprintLabels } from "@museumsufer/core";
import { Hono } from "hono";
import { detectLocale, getTranslations, type Locale, type Translations } from "../i18n";
import { APP_URL } from "../shared";
import type { Env } from "../types";

const OPERATOR = {
  name: "Jonas Strassel",
  email: "feedback@landau.today",
  city: "Frankfurt am Main, Germany",
};

const REPO_URL = "https://github.com/boredland/museumsufer";

const SOURCE_COPY_DE =
  "Veranstaltungstermine werden automatisiert aus öffentlichen Quellen aggregiert: " +
  "Kulturnetz Landau, Stadt Landau, Stiftung Hambacher Schloss, RPTU Kaiserslautern-Landau, " +
  "Pfalz.de und Südliche Weinstraße Tourismus. Die Rechte an den Inhalten verbleiben " +
  "bei den jeweiligen Veranstaltern. Diese Seite hat keinerlei kommerzielle Beziehung zu " +
  "den gelisteten Veranstaltern und übernimmt keine Verantwortung für die Richtigkeit " +
  "der angezeigten Daten — bitte prüfen Sie alle Angaben vor Ihrem Besuch beim Veranstalter.";

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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderImprint(locale: Locale, tr: Translations): string {
  const homeHref = locale === "fr" ? "/?lang=fr" : "/";
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(tr.imprintTitle)} · landau.today</title>
<meta name="description" content="${esc(tr.imprintTitle)}" />
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
  <h1><a href="${homeHref}">Landau<span class="ampersand">&amp;</span>heute</a></h1>
  <p class="subtitle">${esc(tr.imprintTitle)}</p>
</header>
<main id="content" style="max-width:48rem;margin:0 auto;padding:0 1rem 4rem">
  <p style="margin:1rem 0"><a href="${homeHref}">← ${esc(tr.imprintBack)}</a></p>
  <h2>${esc(tr.imprintTitle)}</h2>

  <h3>${esc(tr.imprintProvider)}</h3>
  <p>${OPERATOR.name}<br />${OPERATOR.city}</p>

  <h3>${esc(tr.imprintContact)}</h3>
  <p><a href="mailto:${OPERATOR.email}">${OPERATOR.email}</a></p>

  <h3>${esc(tr.imprintResponsible)}</h3>
  <p>${OPERATOR.name}, ${OPERATOR.city}</p>

  <h3>${esc(tr.imprintDataSource)}</h3>
  <p>${esc(tr.imprintDataSourceBody)}</p>

  <h3>${esc(tr.imprintDisclaimer)}</h3>
  <p>${esc(tr.imprintDisclaimerBody)}</p>

  <h3>${esc(tr.imprintSource)}</h3>
  <p>
    <a href="${REPO_URL}/tree/main/apps/landau-today" target="_blank" rel="noopener">
      ${REPO_URL.replace("https://", "")}
    </a>
  </p>
</main>
<footer class="colophon-foot" style="max-width:48rem;margin:0 auto;padding:0 1rem 2rem">
  <span>${esc(tr.footerLine)}</span>
</footer>
</body>
</html>`;
}

export default app;
