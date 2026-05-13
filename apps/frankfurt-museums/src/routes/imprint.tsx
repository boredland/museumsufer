import { langSwitchItems, THEME_FOUC_SCRIPT } from "@museumsufer/core";
import { LangSwitch } from "@museumsufer/core/langswitch";
import { Hono } from "hono";
import { raw } from "hono/html";
import { DEFAULT_LOCALE, detectLocale, getTranslations, type Locale, SUPPORTED_LOCALES } from "../i18n";
import type { Env } from "../types";

const OPERATOR = {
  name: "Jonas Strassel",
  email: "feedback@ins.museum",
};

function ImprintPage({ locale }: { locale: Locale }) {
  const tr = getTranslations(locale);
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{tr.imprintTitle}</title>
          <meta name="description" content={tr.imprintTitle} />
          <link rel="canonical" href="https://museumsufer.app/impressum" />
          <meta name="robots" content="index,follow" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
          <link rel="apple-touch-icon" href="/icon-192.png" />
          <meta name="theme-color" content="#efe7d8" media="(prefers-color-scheme: light)" />
          <meta name="theme-color" content="#14110e" media="(prefers-color-scheme: dark)" />
          <script dangerouslySetInnerHTML={{ __html: THEME_FOUC_SCRIPT }} />
          <link rel="stylesheet" href="/fonts.css" />
          <link rel="preload" as="style" href="/styles.css" />
          <link rel="stylesheet" href="/styles.css" />
        </head>
        <body>
          <div class="page page--narrow">
            <div class="imprint__head">
              <p class="imprint__back">
                <a href={locale === "de" ? "/" : `/?lang=${locale}`} class="imprint__back-link">
                  ← {tr.back}
                </a>
              </p>
              <LangSwitch
                locale={locale}
                supported={SUPPORTED_LOCALES}
                ariaLabel={tr.langSwitchAria}
                buildHref={(l) => {
                  const items = langSwitchItems({
                    locale,
                    currentPath: "/impressum",
                    supported: SUPPORTED_LOCALES,
                    fallback: DEFAULT_LOCALE,
                  });
                  return items.find((i) => i.locale === l)?.href ?? `?lang=${l}`;
                }}
              />
            </div>
            <h1 class="imprint__title">{tr.imprintHeading}</h1>

            <section class="imprint__section">
              <h2 class="imprint__section-title">{tr.imprintTmgHeading}</h2>
              <p class="imprint__body">
                {OPERATOR.name}
                <br />
                Frankfurt am Main, Germany
              </p>
            </section>

            <section class="imprint__section">
              <h2 class="imprint__section-title">{tr.imprintContactHeading}</h2>
              <p class="imprint__body">
                <a class="imprint__link" href={`mailto:${OPERATOR.email}`}>
                  {OPERATOR.email}
                </a>
              </p>
            </section>

            <section class="imprint__section">
              <h2 class="imprint__section-title">{tr.imprintResponsibleHeading}</h2>
              <p class="imprint__body">{OPERATOR.name}</p>
            </section>

            <section class="imprint__section">
              <h2 class="imprint__section-title">{tr.imprintDataSourceHeading}</h2>
              <p class="imprint__body">{tr.imprintDataSourceText}</p>
            </section>

            <section class="imprint__section">
              <h2 class="imprint__section-title">{tr.imprintDisclaimerHeading}</h2>
              <p class="imprint__body">{tr.imprintDisclaimerText}</p>
            </section>

            <p class="imprint__source">
              <a
                href="https://github.com/boredland/museumsufer/tree/main/apps/frankfurt-museums"
                target="_blank"
                rel="noopener"
                class="imprint__source-link"
              >
                Source · GitHub
              </a>
            </p>
          </div>
        </body>
      </html>
    </>
  );
}

const app = new Hono<{ Bindings: Env }>();

const handler = (path: string) =>
  app.get(path, (c) => {
    const locale = detectLocale(c.req.raw);
    return c.html(ImprintPage({ locale }), {
      headers: {
        "Content-Language": locale,
        Vary: "Accept-Language",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  });

handler("/impressum");
app.get("/imprint", (c) => {
  const lang = new URL(c.req.url).searchParams.get("lang");
  return c.redirect(lang ? `/impressum?lang=${lang}` : "/impressum", 301);
});

export default app;
