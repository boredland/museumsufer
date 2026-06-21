import { langSwitchItems } from "@museumsufer/core";
import { HtmlHead } from "@museumsufer/core/html-head";
import { LangSwitch } from "@museumsufer/core/langswitch";
import { Hono } from "hono";
import { raw } from "hono/html";
import {
  DEFAULT_LOCALE,
  detectLocale,
  getTranslations,
  type Locale,
  localizeTranslations,
  SUPPORTED_LOCALES,
} from "../i18n";
import type { Env } from "../types";

const OPERATOR = {
  name: "Jonas Strassel",
  email: "feedback@ins.museum",
};

function ImprintPage({ locale, city }: { locale: Locale; city: string }) {
  const tr = localizeTranslations(getTranslations(locale), city, locale);
  const appUrl = city === "frankfurt" ? "https://museumsufer.app" : `https://${city}.ins.museum`;
  const brand = city === "frankfurt" ? "Museumsufer Frankfurt" : `${city}.ins.museum`;
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <HtmlHead
            title={tr.imprintTitle}
            description={tr.imprintTitle}
            canonical={`${appUrl}/impressum`}
            ogImage={`${appUrl}/og-image.png`}
            ogSiteName={brand}
            themeColor={[
              { content: "#efe7d8", media: "(prefers-color-scheme: light)" },
              { content: "#14110e", media: "(prefers-color-scheme: dark)" },
            ]}
            icons={{ svg: "/favicon.svg", png192: "/icon-192.png", appleTouch: "/icon-192.png" }}
            stylesheetHref="/styles.css"
          />
          <meta name="robots" content="noindex,follow" />
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
                href="https://github.com/boredland/museumsufer/tree/main/apps/museumsufer"
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

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

const handler = (path: string) =>
  app.get(path, (c) => {
    const locale = detectLocale(c.req.raw);
    const city = c.get("city") ?? "frankfurt";
    return c.html(ImprintPage({ locale, city }), {
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
