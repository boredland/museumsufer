import { Hono } from "hono";
import { raw } from "hono/html";
import { detectLocale, getTranslations, type Locale } from "../i18n";
import type { Env } from "../types";

const OPERATOR = {
  name: "Jonas Strassel",
  email: "info@jonas-strassel.de",
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
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){const t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else if(t==='light'){document.documentElement.classList.add('light')}})()`,
            }}
          />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link
            rel="preload"
            as="style"
            href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
            onload="this.onload=null;this.rel='stylesheet'"
          />
          <noscript>
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
            />
          </noscript>
          <link rel="preload" as="style" href="/styles.css" />
          <link rel="stylesheet" href="/styles.css" />
        </head>
        <body>
          <div class="max-w-[640px] mx-auto pt-10 pb-16 px-5 max-[480px]:pt-8 max-[480px]:pb-12">
            <p class="mb-8">
              <a
                href={locale === "de" ? "/" : `/?lang=${locale}`}
                class="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-text-tertiary hover:text-river no-underline"
              >
                ← {tr.back}
              </a>
            </p>
            <h1 class="font-display italic font-normal leading-[0.95] tracking-[-0.02em] text-text-primary text-[clamp(2rem,6vw,3rem)] mb-8">
              {tr.imprintHeading}
            </h1>

            <section class="mb-8">
              <h2 class="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-text-tertiary mb-2">
                {tr.imprintTmgHeading}
              </h2>
              <p class="leading-relaxed">
                {OPERATOR.name}
                <br />
                Frankfurt am Main, Germany
              </p>
            </section>

            <section class="mb-8">
              <h2 class="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-text-tertiary mb-2">
                {tr.imprintContactHeading}
              </h2>
              <p class="leading-relaxed">
                <a class="text-river hover:underline" href={`mailto:${OPERATOR.email}`}>
                  {OPERATOR.email}
                </a>
              </p>
            </section>

            <section class="mb-8">
              <h2 class="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-text-tertiary mb-2">
                {tr.imprintResponsibleHeading}
              </h2>
              <p class="leading-relaxed">{OPERATOR.name}</p>
            </section>

            <section class="mb-8">
              <h2 class="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-text-tertiary mb-2">
                {tr.imprintDataSourceHeading}
              </h2>
              <p class="leading-relaxed">{tr.imprintDataSourceText}</p>
            </section>

            <section class="mb-8">
              <h2 class="font-mono text-[0.75rem] uppercase tracking-[0.16em] text-text-tertiary mb-2">
                {tr.imprintDisclaimerHeading}
              </h2>
              <p class="leading-relaxed">{tr.imprintDisclaimerText}</p>
            </section>

            <p class="mt-12 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-text-tertiary">
              <a
                href="https://github.com/boredland/museumsufer"
                target="_blank"
                rel="noopener"
                class="hover:text-river no-underline"
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
