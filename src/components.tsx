import { dateLocale, type Locale } from "./i18n";
import { getMuseumLocations } from "./museum-config";
import { buildCalendarUrl, formatDateShort, sortByPopularity } from "./shared";
import type { EventWithLikes, ExhibitionWithLikes, MuseumInfo } from "./types";

const MUSEUM_LOCATIONS = getMuseumLocations();

function ImagePlaceholder() {
  return (
    <div class="card-img-placeholder" aria-hidden="true">
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 16l4-4 4 4m2-2l2-2 4 4M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </div>
  );
}

function CardImage({
  src,
  alt,
  detailUrl,
  lazy,
}: {
  src: string | null;
  alt: string;
  detailUrl: string | null;
  lazy: boolean;
}) {
  const imgTag = src ? (
    <img
      class="card-img"
      src={`${src}?w=120`}
      srcset={`${src}?w=120 120w, ${src}?w=200 200w`}
      sizes="(max-width: 480px) 56px, 72px"
      alt={alt}
      loading={lazy ? "lazy" : undefined}
    />
  ) : (
    <ImagePlaceholder />
  );

  if (detailUrl) {
    return (
      <a href={detailUrl} target="_blank" rel="noopener" tabindex={-1}>
        {imgTag}
      </a>
    );
  }
  return imgTag;
}

function TranslatedBadge({ translated }: { translated?: boolean }) {
  if (!translated) return null;
  return (
    <span class="card-translated" title="Translated by DeepL">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path
          d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"
          fill="currentColor"
        />
      </svg>
      DeepL
    </span>
  );
}

function LikeBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span class="card-likes">
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z" />
      </svg>
      {count}
    </span>
  );
}

function NavButton({ slug, tr }: { slug: string | undefined; tr: Record<string, string> }) {
  if (!slug || !MUSEUM_LOCATIONS[slug]) return null;
  const m = MUSEUM_LOCATIONS[slug];
  return (
    <a
      class="card-ical"
      href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&travelmode=walking`}
      target="_blank"
      rel="noopener"
      aria-label={tr.navigate}
      title={tr.navigate}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1a5 5 0 015 5c0 3.5-5 9-5 9s-5-5.5-5-9a5 5 0 015-5zm0 3a2 2 0 100 4 2 2 0 000-4z"
          stroke="currentColor"
          stroke-width="1.5"
        />
      </svg>
    </a>
  );
}

function MuseumGroupHeader({
  name,
  slug,
  museums,
  tr,
}: {
  name: string;
  slug: string | undefined;
  museums: Record<string, MuseumInfo>;
  tr: Record<string, string>;
}) {
  const info = slug ? museums[slug] : undefined;
  const url = info?.website;
  return (
    <li>
      <h3 class="museum-group-header">
        {name}
        {url && (
          <a class="museum-link" href={url} target="_blank" rel="noopener" aria-label={name}>
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" width="11" height="11">
              <path
                d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </a>
        )}
        {info?.museumsufer === false && (
          <span class="not-museumsufer" title={tr.notMuseumsufer}>
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" width="12" height="12">
              <path d="M8 2L2 6v1h12V6L8 2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
              <path d="M4 9v4M8 9v4M12 9v4M3 13h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
              <path d="M2 2l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </span>
        )}
      </h3>
    </li>
  );
}

function EndingBadge({
  endDate,
  todayIso,
  tr,
}: {
  endDate: string | null;
  todayIso: string;
  tr: Record<string, string>;
}) {
  if (!endDate) return null;
  const daysLeft = Math.ceil(
    (new Date(`${endDate}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / 86400000,
  );
  if (daysLeft > 14) return null;
  const daysUnit = daysLeft === 1 ? tr.daysSingular : tr.daysPlural;
  const label = daysLeft <= 3 ? tr.lastDays : tr.endingSoon;
  return (
    <span class="card-ending-soon" title={`${daysLeft} ${daysUnit}`}>
      {label}
    </span>
  );
}

function ExhibitionCard({
  ex,
  idx,
  todayIso,
  locale,
  tr,
}: {
  ex: ExhibitionWithLikes;
  idx: number;
  todayIso: string;
  locale: Locale;
  tr: Record<string, string>;
}) {
  const dl = dateLocale(locale);
  const dates = [
    ex.start_date ? formatDateShort(ex.start_date, dl) : "",
    ex.end_date ? formatDateShort(ex.end_date, dl) : "",
  ]
    .filter(Boolean)
    .join(" – ");

  const titleContent = ex.detail_url ? (
    <a href={ex.detail_url} target="_blank" rel="noopener">
      {ex.title}
    </a>
  ) : (
    ex.title
  );

  return (
    <li>
      <article class="card" data-item-id={ex.id} data-museum-slug={ex.museum_slug}>
        <CardImage src={ex.image_url} alt={ex.title} detailUrl={ex.detail_url} lazy={idx > 2} />
        <div class="card-body">
          <p class="card-title">
            {titleContent} <TranslatedBadge translated={ex.translated} />
          </p>
          <div class="card-meta">
            {dates && <span class="card-dates">{dates}</span>}
            <EndingBadge endDate={ex.end_date} todayIso={todayIso} tr={tr} />
            <LikeBadge count={ex.like_count} />
            <NavButton slug={ex.museum_slug} tr={tr} />
            <button
              type="button"
              class="card-visited-btn"
              aria-pressed="false"
              aria-label={tr.markVisited}
              title={tr.markVisited}
              data-item-type="exhibition"
              onclick={`onToggleVisited(${ex.id},this.dataset.itemType)`}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8.5l3.5 3.5 7-7"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
          {ex.description && (
            <details>
              <summary>
                <span aria-hidden="true" class="disclosure-icon" />
                {tr.details}
              </summary>
              <div class="card-desc">{ex.description}</div>
            </details>
          )}
        </div>
      </article>
    </li>
  );
}

function EventCard({ ev, idx, tr }: { ev: EventWithLikes; idx: number; tr: Record<string, string> }) {
  const timeStr = ev.time ? (ev.end_time ? `${ev.time}–${ev.end_time}` : ev.time) : "";
  const linkUrl = ev.detail_url || ev.url;
  const titleContent = linkUrl ? (
    <a href={linkUrl} target="_blank" rel="noopener">
      {ev.title}
    </a>
  ) : (
    ev.title
  );

  const calUrl = buildCalendarUrl(ev);

  return (
    <li>
      <article class="card" data-item-id={ev.id} data-museum-slug={ev.museum_slug}>
        <CardImage src={ev.image_url} alt={ev.title} detailUrl={linkUrl} lazy={idx > 2} />
        <div class="card-body">
          <p class="card-title">
            {titleContent} <TranslatedBadge translated={ev.translated} />
          </p>
          <p class="card-museum">{ev.museum_name || ""}</p>
          <div class="card-meta">
            {timeStr && <span class="card-time">{timeStr}</span>}
            {ev.price && <span class="card-price">{ev.price}</span>}
            <LikeBadge count={ev.like_count} />
            <NavButton slug={ev.museum_slug} tr={tr} />
            <a
              class="card-ical"
              href={calUrl}
              target="_blank"
              rel="noopener"
              aria-label={tr.addToCalendar}
              title={tr.addToCalendar}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                <path
                  d="M5 1v2m6-2v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
                <path d="M5 9h2v2H5z" fill="currentColor" />
              </svg>
            </a>
            <a
              class="card-ical"
              href={`/api/event/${ev.id}.ics`}
              download="event.ics"
              aria-label="iCal"
              title="iCal (.ics)"
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </a>
          </div>
          {ev.description && (
            <details>
              <summary>
                <span aria-hidden="true" class="disclosure-icon" />
                {tr.details}
              </summary>
              <div class="card-desc">{ev.description}</div>
            </details>
          )}
        </div>
      </article>
    </li>
  );
}

function Section({
  sectionKey,
  title,
  count,
  iconPath,
  children,
}: {
  sectionKey: string;
  title: string;
  count: number;
  iconPath: string;
  children: unknown;
}) {
  return (
    <details class="section" data-section={sectionKey} open>
      <summary class="section-header">
        <svg aria-hidden="true" class="section-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d={iconPath} stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <h2 class="section-title">{title}</h2>
        <span class="section-count" title={`${count} ${title}`}>
          {count}
        </span>
        <svg aria-hidden="true" class="section-chevron" viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </summary>
      {children}
    </details>
  );
}

export function ContentBody({
  events,
  exhibitions,
  museums,
  tr,
  locale,
  todayIso,
}: {
  date?: string;
  events: EventWithLikes[];
  exhibitions: ExhibitionWithLikes[];
  museums: Record<string, MuseumInfo>;
  tr: Record<string, string>;
  locale: Locale;
  todayIso: string;
}) {
  const sortedEvents = sortByPopularity(events);
  const sortedExhibitions = sortByPopularity(exhibitions);

  const museumsWithExhibitions = new Set(sortedExhibitions.map((ex) => ex.museum_slug));
  const museumsWithout = Object.keys(museums)
    .filter((slug) => !museumsWithExhibitions.has(slug))
    .sort((a, b) => museums[a].name.localeCompare(museums[b].name));

  return (
    <>
      <Section
        sectionKey="events"
        title={tr.events}
        count={events.length}
        iconPath="M6 2v2M14 2v2M3 8h14M5 4h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
      >
        {sortedEvents.length === 0 ? (
          <div class="empty">{tr.noEvents}</div>
        ) : (
          <ul class="card-list">
            {sortedEvents.map((ev, i) => (
              <EventCard ev={ev} idx={i} tr={tr} />
            ))}
          </ul>
        )}
      </Section>

      <Section
        sectionKey="exhibitions"
        title={tr.exhibitions}
        count={exhibitions.length}
        iconPath="M4 16V4h12v12H4zM7 4v12M13 4v12M4 10h12"
      >
        {sortedExhibitions.length === 0 && museumsWithout.length === 0 ? (
          <div class="empty">{tr.noExhibitions}</div>
        ) : (
          <ul class="card-list">
            <ExhibitionList
              exhibitions={sortedExhibitions}
              todayIso={todayIso}
              locale={locale}
              tr={tr}
              museums={museums}
            />
            <li>
              <details class="visited-section" id="visited-section">
                <summary>
                  <span aria-hidden="true" class="disclosure-icon" />
                  {tr.alreadyVisited}{" "}
                  <span class="section-count" id="visited-count">
                    0
                  </span>
                </summary>
                <ul class="card-list" id="visited-list" />
              </details>
            </li>
            {museumsWithout.map((slug) => (
              <li>
                <h3 class="museum-group-header museum-no-exhibition">
                  {museums[slug].name}
                  {museums[slug].website && (
                    <a
                      class="museum-link"
                      href={museums[slug].website!}
                      target="_blank"
                      rel="noopener"
                      aria-label={museums[slug].name}
                    >
                      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" width="11" height="11">
                        <path
                          d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </a>
                  )}
                  {museums[slug].museumsufer === false && (
                    <span class="not-museumsufer" title={tr.notMuseumsufer}>
                      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" width="12" height="12">
                        <path
                          d="M8 2L2 6v1h12V6L8 2z"
                          stroke="currentColor"
                          stroke-width="1.2"
                          stroke-linejoin="round"
                        />
                        <path
                          d="M4 9v4M8 9v4M12 9v4M3 13h10"
                          stroke="currentColor"
                          stroke-width="1.2"
                          stroke-linecap="round"
                        />
                        <path d="M2 2l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                      </svg>
                    </span>
                  )}
                  <span class="museum-permanent">{tr.permanentCollection}</span>
                </h3>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function ExhibitionList({
  exhibitions,
  todayIso,
  locale,
  tr,
  museums,
}: {
  exhibitions: ExhibitionWithLikes[];
  todayIso: string;
  locale: Locale;
  tr: Record<string, string>;
  museums: Record<string, MuseumInfo>;
}) {
  let currentMuseum = "";
  return (
    <>
      {exhibitions.map((ex, i) => {
        const museum = ex.museum_name || "";
        const showHeader = museum !== currentMuseum;
        if (showHeader) currentMuseum = museum;
        return (
          <>
            {showHeader && <MuseumGroupHeader name={museum} slug={ex.museum_slug} museums={museums} tr={tr} />}
            <ExhibitionCard ex={ex} idx={i} todayIso={todayIso} locale={locale} tr={tr} />
          </>
        );
      })}
    </>
  );
}
