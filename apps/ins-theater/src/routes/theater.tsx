import {
  buildUtm,
  cityAdj,
  cityHost,
  cityMeta,
  cityName,
  cityUrl,
  dateOffset,
  parsePostalAddress,
  todayIso,
} from "@museumsufer/core";
import { AskAi as SharedAskAi } from "@museumsufer/core/ask-ai";
import { Hono } from "hono";
import { raw } from "hono/html";
import { type DayPerformance, getPerformancesInRange } from "../db";
import { buildPerformanceJsonLd, ClientScript, Footer, Grain, Head, Masthead, Performance } from "../frontend";
import { renderTheaterMarkdown, wantsMarkdown } from "../markdown";
import { THEATERS } from "../theater-config";
import type { Env } from "../types";

const APEX = "ins.theater";

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

const MONTH_NAMES_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
const WEEKDAYS_DE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function GroupedPerformances({ performances }: { performances: DayPerformance[] }) {
  const byDate = new Map<string, DayPerformance[]>();
  for (const p of performances) {
    const arr = byDate.get(p.date);
    if (arr) arr.push(p);
    else byDate.set(p.date, [p]);
  }
  let i = 0;
  return (
    <>
      {[...byDate.entries()].map(([date, perfs]) => {
        if (!perfs.length) return null;
        const dp = new Date(`${date}T12:00:00Z`);
        const wk = WEEKDAYS_DE[dp.getUTCDay()];
        const month = MONTH_NAMES_DE[dp.getUTCMonth()];
        const day = dp.getUTCDate();
        return (
          <section key={date} class="theater-day">
            <header class="theater-day__head">
              <p class="theater-day__weekday">{wk}</p>
              <h3 class="theater-day__date">
                {day}. {month}
              </h3>
            </header>
            <ol class="performances">
              {perfs.map((p) => {
                const row = <Performance key={p.id} p={p} opts={{ index: i, hideTheater: true }} />;
                i++;
                return row;
              })}
            </ol>
          </section>
        );
      })}
    </>
  );
}

app.get("/theater/:slug", async (c) => {
  const slug = c.req.param("slug");
  const config = THEATERS.find((t) => t.slug === slug);
  if (!config) return c.notFound();

  const today = todayIso();
  const performances = await getPerformancesInRange(today, dateOffset(60), slug);

  if (wantsMarkdown(c.req.raw)) {
    return c.body(renderTheaterMarkdown(config, performances), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=1800",
      },
    });
  }

  // The theater's own city drives all content (its host, schema region,
  // brand) — not the request host, so a deep link resolves correctly.
  const city = config.city ?? "frankfurt";
  const meta = cityMeta(city);
  const appUrl = cityUrl(APEX, city);
  const host = cityHost(APEX, city);
  const brand = `${meta.short} Theater`;
  const cityFull = cityName(city, "de", "full");
  const utm = buildUtm(host);

  const theaterIri = `${appUrl}/theater/${slug}#theater`;
  const sameAs: string[] = [];
  if (config.website_url) sameAs.push(config.website_url);
  if (config.wikidata) sameAs.push(`https://www.wikidata.org/wiki/${config.wikidata}`);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "PerformingArtsTheater",
      "@id": theaterIri,
      name: config.name,
      url: `${appUrl}/theater/${slug}`,
      ...(config.description && { description: config.description }),
      address: parsePostalAddress(config.address, { region: meta.region }),
      geo:
        config.lat && config.lon
          ? { "@type": "GeoCoordinates", latitude: config.lat, longitude: config.lon }
          : undefined,
      hasMap: config.lat && config.lon ? `https://www.google.com/maps?q=${config.lat},${config.lon}` : undefined,
      containedInPlace: {
        "@type": "City",
        name: cityFull,
        sameAs: `https://www.wikidata.org/wiki/${meta.wikidata}`,
      },
      ...(config.telephone && { telephone: config.telephone }),
      ...(sameAs.length > 0 && { sameAs }),
      image: `${appUrl}/theater/${slug}/og.svg`,
      hasOfferCatalog:
        performances.length > 0
          ? {
              "@type": "OfferCatalog",
              name: `Spielplan ${config.name}`,
              numberOfItems: performances.length,
            }
          : undefined,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: brand, item: appUrl },
        { "@type": "ListItem", position: 2, name: config.name, item: `${appUrl}/theater/${slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Vorstellungen — ${config.name}`,
      numberOfItems: performances.length,
      itemListElement: performances.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: buildPerformanceJsonLd(p),
      })),
    },
  ];

  const turnstileSiteKey = c.env.TURNSTILE_SITE_KEY;

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="de">
        <head>
          <Head
            title={`${config.name} — Spielplan · ${brand}`}
            description={`Aktueller Spielplan und Karten für ${config.name} in ${cityFull}. ${performances.length} kommende Vorstellung${
              performances.length === 1 ? "" : "en"
            }.`}
            canonical={`${appUrl}/theater/${slug}`}
            appUrl={appUrl}
            ogImage={`${appUrl}/theater/${slug}/og.svg`}
            jsonLd={jsonLd}
            turnstileSiteKey={turnstileSiteKey}
            extraLinks={[
              {
                rel: "alternate",
                type: "text/calendar",
                href: `/theater/${slug}/feed.ics`,
                title: `${config.name} – iCal`,
              },
              {
                rel: "alternate",
                type: "application/json",
                href: `/api/theater/${slug}`,
                title: `${config.name} – JSON`,
              },
            ]}
          />
        </head>
        <body>
          <Grain />
          <Masthead city={city} sublabel={`${cityAdj(city, "de")} Bühnen, kuratiert nach Tag.`} />
          <main class="programme programme--theater">
            <header class="theater-hero">
              <p class="theater-hero__line" />
              <p class="theater-hero__kicker">Spielplan</p>
              <h2 class="theater-hero__name">{config.name}</h2>
              {config.address ? <p class="theater-hero__address">{config.address}</p> : null}
              {config.description ? <p class="theater-hero__lead">{config.description}</p> : null}
              <p class="theater-hero__meta">
                {config.website_url ? (
                  <a href={utm(config.website_url, "theater_website")} target="_blank" rel="noopener">
                    Website ↗
                  </a>
                ) : null}
                <a href={`/theater/${slug}/feed.ics`}>iCal abonnieren</a>
                <a href={`/api/theater/${slug}`}>JSON</a>
              </p>
            </header>
            <SharedAskAi
              label="Frag eine KI"
              aria={`Frag eine KI nach dem Spielplan im ${config.name}`}
              prompt={`Was läuft in den nächsten Wochen im ${config.name} in ${cityFull}? Bitte gruppiere nach Vorstellungen. Quelle: ${appUrl}/theater/${slug}`}
            />
            {performances.length === 0 ? (
              <div class="empty">
                <p class="empty__mark">∅</p>
                <p>Noch kein angekündigtes Programm.</p>
              </div>
            ) : (
              <GroupedPerformances performances={performances} />
            )}
          </main>
          <Footer turnstileSiteKey={turnstileSiteKey} />
          <ClientScript />
        </body>
      </html>
    </>,
  );
});

export default app;
