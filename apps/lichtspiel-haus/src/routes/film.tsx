import {
  buildUtm,
  cityHost,
  cityMeta,
  cityName,
  cityUrl,
  formatLocalisedDateLong,
  parsePostalAddress,
} from "@museumsufer/core";
import { AskAi as SharedAskAi } from "@museumsufer/core/ask-ai";
import { Hono } from "hono";
import { raw } from "hono/html";
import { getScreeningById } from "../db";
import { Footer, Head, Masthead, PosterCard, ScoreBadges } from "../frontend";
import { detectLocale, getTranslations, localizeTranslations } from "../i18n";
import { type Env, stripVersionChrome } from "../types";

const app = new Hono<{ Bindings: Env; Variables: { city: string } }>();

// One self-contained sentence pulling every important signal into a
// continuous prose passage. AI citation models extract continuous
// text -- a paragraph that names film + version + format + time +
// date + cinema + city is the optimal citable unit.
function buildScreeningSummary(opts: {
  title: string;
  date: string;
  time: string | null | undefined;
  cinemaName: string;
  city: string;
  version: string | null | undefined;
  format: string | null | undefined;
  locale: "de" | "en";
}): string {
  const tags = [opts.version, opts.format].filter(Boolean).join(", ");
  const tagSuffix = tags ? ` (${tags})` : "";
  const dateObj = new Date(`${opts.date}T12:00:00Z`);
  const dateStr = dateObj.toLocaleDateString(opts.locale === "en" ? "en-GB" : "de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  if (opts.locale === "en") {
    const when = opts.time ? `on ${dateStr} at ${opts.time}` : `on ${dateStr}`;
    return `${opts.title}${tagSuffix} screens ${when} at ${opts.cinemaName} in ${opts.city}.`;
  }
  const when = opts.time ? `am ${dateStr} um ${opts.time} Uhr` : `am ${dateStr}`;
  return `${opts.title}${tagSuffix} läuft ${when} im ${opts.cinemaName} in ${opts.city}.`;
}

app.get("/film/:id{[0-9]+}", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(id)) return c.notFound();
  const screening = getScreeningById(id);
  if (!screening) return c.notFound();

  const city = c.get("city") ?? "frankfurt";
  const host = cityHost("lichtspiel.haus", city);
  const localUtm = buildUtm(host);
  const appUrl = cityUrl("lichtspiel.haus", city);

  const locale = detectLocale(c.req.raw);
  const tr = localizeTranslations(getTranslations(locale), city, locale);
  const currentPath = `/film/${id}`;
  const dateLabel = formatLocalisedDateLong(screening.date, locale === "en" ? "en-US" : "de-DE");
  // Prefer TMDb's canonical localised title over the cinema's listing
  // title (which usually carries series chrome). Fall back through the
  // German TMDb title, then the venue's title.
  const displayTitle =
    locale === "en"
      ? (screening.title_en ?? screening.title_de ?? stripVersionChrome(screening.title))
      : (screening.title_de ?? stripVersionChrome(screening.title));
  // English visitors get the TMDb English overview when available; falls
  // back to the cinema's (German) description so we never render an empty
  // synopsis just because TMDb missed.
  const englishSynopsisAvailable = !!screening.description_en;
  const synopsis = locale === "en" ? (screening.description_en ?? screening.description) : screening.description;
  // When the EN visitor falls through to the DE description we render
  // it in <span lang="de"> with a notice so assistive tech and search
  // crawlers see that the synopsis is in a different language than
  // the page's html lang attribute.
  const synopsisIsForeign = locale === "en" && !englishSynopsisAvailable && !!screening.description;
  // TMDb attribution is required by the API terms when we surface
  // their description text. Show it adjacent to the synopsis on the
  // page where the text appears, not only in the global footer.
  const synopsisFromTmdb = !!screening.tmdb_id && !!synopsis;

  const summarySentence = buildScreeningSummary({
    title: displayTitle,
    date: screening.date,
    time: screening.time,
    cinemaName: screening.cinema.name,
    city: screening.cinema.city
      ? screening.cinema.city.charAt(0).toUpperCase() + screening.cinema.city.slice(1)
      : "Frankfurt",
    version: screening.version,
    format: screening.format,
    locale,
  });

  // Cinema addresses are stored as combined "<street>, <PLZ> <city>"
  // strings -- split them into a proper PostalAddress object so the
  // ScreeningEvent.location passes Google's Rich Results validator.
  const address = parsePostalAddress(screening.cinema.address, { fallback: "permissive" });
  const cinemaIri = `${appUrl}/kino/${screening.cinema_slug}#cinema`;

  // The Movie entity gets aggregateRating from TMDb when there are
  // enough votes to be meaningful. Threshold of 10 mirrors what the
  // listing-row badge already filters to.
  const movieRating =
    screening.tmdb_vote_average != null && (screening.tmdb_vote_count ?? 0) >= 10
      ? {
          "@type": "AggregateRating",
          ratingValue: screening.tmdb_vote_average,
          bestRating: 10,
          ratingCount: screening.tmdb_vote_count,
        }
      : undefined;
  const movieSameAs: string[] = [];
  if (screening.tmdb_id)
    movieSameAs.push(`https://www.themoviedb.org/${screening.tmdb_kind ?? "movie"}/${screening.tmdb_id}`);
  if (screening.imdb_id) movieSameAs.push(`https://www.imdb.com/title/${screening.imdb_id}/`);
  if (screening.rt_url) movieSameAs.push(screening.rt_url);

  const screeningLd = {
    "@context": "https://schema.org",
    "@type": "ScreeningEvent",
    "@id": `${appUrl}/film/${id}#screening`,
    name: displayTitle,
    description: screening.description ?? screening.subtitle ?? undefined,
    inLanguage: locale,
    startDate: screening.time ? `${screening.date}T${screening.time}:00+02:00` : screening.date,
    endDate: screening.end_time ? `${screening.date}T${screening.end_time}:00+02:00` : undefined,
    image: screening.image_url ?? undefined,
    workPresented: {
      "@type": "Movie",
      name: displayTitle,
      inLanguage: screening.language,
      sameAs: movieSameAs.length ? movieSameAs : undefined,
      aggregateRating: movieRating,
    },
    videoFormat: screening.format,
    location: {
      "@type": "MovieTheater",
      "@id": cinemaIri,
      name: screening.cinema.name,
      address,
    },
    // Skip the Offer entirely when we don't have a real price -- a
    // partial Offer (priceCurrency without price) is invalid per
    // schema.org. With a price, emit a complete object.
    offers:
      screening.ticket_url && screening.price_min != null
        ? {
            "@type": "Offer",
            url: localUtm(screening.ticket_url, "film-detail"),
            price: screening.price_min,
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
          }
        : undefined,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "lichtspiel.haus", item: appUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: screening.cinema.name,
        item: `${appUrl}/kino/${screening.cinema_slug}`,
      },
      { "@type": "ListItem", position: 3, name: displayTitle },
    ],
  };
  const jsonLd = [screeningLd, breadcrumbLd];

  const badges: string[] = [];
  if (screening.version) badges.push(screening.version);
  if (screening.format) badges.push(screening.format);
  if (screening.language && screening.language !== "other") badges.push(screening.language.toUpperCase());

  return c.html(
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={locale}>
        <head>
          <Head
            title={`${displayTitle} — ${screening.cinema.name} — lichtspiel.haus`}
            description={screening.description ?? screening.subtitle ?? `${displayTitle} im ${screening.cinema.name}`}
            canonical={`${appUrl}/film/${id}?lang=${locale}`}
            locale={locale}
            currentPath={currentPath}
            jsonLd={jsonLd}
            ogImage={screening.image_url ?? undefined}
            extraLinks={[
              {
                rel: "alternate",
                type: "text/calendar",
                href: `/film/${id}/feed.ics`,
                title: `${displayTitle} – iCal`,
              },
            ]}
          />
        </head>
        <body>
          <Masthead tr={tr} locale={locale} currentPath={currentPath} city={city} />
          <main class="film-detail">
            <p class="back-link">
              <a href={`/tag/${screening.date}?lang=${locale}#screening-${id}`}>← {tr.backToProgramme}</a>
            </p>
            <article class="film-detail__article">
              <p class="film-detail__kicker">{tr.filmKicker}</p>
              <h1 class="film-detail__title">{displayTitle}</h1>
              {screening.subtitle ? <p class="film-detail__subtitle">{screening.subtitle}</p> : null}
              <p class="film-detail__lead">{summarySentence}</p>

              <div class="film-detail__grid">
                <div class="film-detail__poster">
                  <PosterCard title={displayTitle} imageUrl={screening.image_url} priority />
                </div>
                <div class="film-detail__meta">
                  <p class="film-detail__when">
                    <span class="film-detail__time">{screening.time ?? "–"}</span>
                    <span class="film-detail__date">{dateLabel}</span>
                    {screening.availability ? (
                      <span class={`prog-entry__avail prog-entry__avail--${screening.availability.replace("_", "-")}`}>
                        {screening.availability === "sold_out" ? tr.soldOut : tr.fewLeft}
                      </span>
                    ) : null}
                  </p>
                  <p class="film-detail__where">
                    <a href={`/kino/${screening.cinema_slug}?lang=${locale}`}>{screening.cinema.name}</a>
                    {screening.venue_room ? <span class="film-detail__room"> · {screening.venue_room}</span> : null}
                  </p>
                  {badges.length > 0 ? (
                    <ul class="film-detail__badges">
                      {badges.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p class="film-detail__scores">
                    <ScoreBadges s={screening} />
                  </p>
                  {screening.credits ? (
                    <p class="film-detail__credits">
                      <span class="film-detail__credits-label">{tr.creditsLabel}: </span>
                      {screening.credits}
                    </p>
                  ) : null}
                  {screening.series ? (
                    <p class="film-detail__series">
                      <span class="film-detail__series-kicker">{tr.seriesKicker}: </span>
                      <a href={`/reihe/${screening.series.slug}?lang=${locale}`}>{screening.series.name}</a>
                    </p>
                  ) : null}
                  <div class="film-detail__actions">
                    {screening.ticket_url ? (
                      <a
                        class="film-detail__ticket"
                        href={localUtm(screening.ticket_url, "film-detail")}
                        target="_blank"
                        rel="noopener"
                      >
                        {tr.ticketsAction} ↗
                      </a>
                    ) : null}
                    <a class="film-detail__calendar" href={`/film/${id}/feed.ics`}>
                      {tr.toCalendar}
                    </a>
                    {screening.detail_url ? (
                      <a
                        class="film-detail__source"
                        href={localUtm(screening.detail_url, "film-detail")}
                        target="_blank"
                        rel="noopener"
                      >
                        {tr.websiteLink} ↗
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              {synopsis ? (
                <div class="film-detail__description">
                  {synopsisIsForeign ? <p class="film-detail__lang-note">{tr.synopsisFallbackNotice}</p> : null}
                  <p {...(synopsisIsForeign ? { lang: "de" } : {})}>{synopsis}</p>
                  {synopsisFromTmdb ? <p class="film-detail__attribution">{tr.synopsisAttribution}</p> : null}
                </div>
              ) : null}
              <SharedAskAi
                label={tr.askAiLabel}
                aria={tr.askAiAria}
                prompt={tr.askAiPromptFilm(displayTitle, screening.cinema.name, dateLabel)}
              />
            </article>
          </main>
          <Footer tr={tr} locale={locale} />
        </body>
      </html>
    </>,
    {
      headers: {
        "Content-Language": locale,
        "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600",
        Vary: "Accept-Language",
      },
    },
  );
});

export default app;
