import { ICON } from "./icons";
import { dateLocale, type Locale } from "./i18n";
import { getMuseumLocations } from "./museum-config";
import { buildCalendarUrl, buildOutlookUrl, buildYahooUrl, formatDateShort, sortByPopularity } from "./shared";
import {
  badgeCountClass,
  cardClass,
  cardListClass,
  descriptionClass,
  emptyStateClass,
  iconBtnClass,
  titleLinkClass,
} from "./tw";
import type { EventWithLikes, ExhibitionWithLikes, MuseumInfo } from "./types";

const MUSEUM_LOCATIONS = getMuseumLocations();

function ImagePlaceholder() {
  return (
    <div
      class="w-[72px] h-[54px] max-[480px]:w-14 max-[480px]:h-[42px] rounded-lg shrink-0 bg-border-light flex items-center justify-center text-border"
      aria-hidden="true"
    >
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

const imgWrapClass =
  "w-[72px] h-[54px] max-[480px]:w-14 max-[480px]:h-[42px] rounded-lg shrink-0 bg-border-light overflow-hidden";

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
  const inner = src ? (
    <div class={imgWrapClass}>
      <img
        class="w-full h-full object-cover"
        src={`${src}?w=120`}
        srcset={`${src}?w=120 120w, ${src}?w=200 200w`}
        sizes="(max-width: 480px) 56px, 72px"
        alt={alt}
        loading={lazy ? "lazy" : undefined}
      />
    </div>
  ) : (
    <ImagePlaceholder />
  );

  if (detailUrl) {
    return (
      <a href={detailUrl} target="_blank" rel="noopener" tabindex={-1} class="shrink-0">
        {inner}
      </a>
    );
  }
  return inner;
}

function TranslatedBadge({ translated }: { translated?: boolean }) {
  if (!translated) return null;
  return (
    <span class="text-[0.5625rem] text-text-tertiary inline-flex items-center gap-0.5" title="Translated by DeepL">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" class="w-2.5 h-2.5">
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
    <span class={`card-likes ${iconBtnClass} gap-1 px-1.5 !cursor-default`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3 shrink-0">
        <path d={ICON.heart} />
      </svg>
      {count}
    </span>
  );
}

function rmvUrl(name: string, lat: number, lng: number): string {
  const zid = `A=2@O=${name}@X=${Math.round(lng * 1e6)}@Y=${Math.round(lat * 1e6)}@`;
  return `https://www.rmv.de/c/de/fahrplan/verbindungssuche-hinweise/fahrplanauskunft?language=de_DE&context=TP&start=1&ZID=${encodeURIComponent(zid)}`;
}

function NavButton({ slug, name, tr }: { slug: string | undefined; name: string; tr: Record<string, string> }) {
  if (!slug || !MUSEUM_LOCATIONS[slug]) return null;
  const m = MUSEUM_LOCATIONS[slug];
  return (
    <a
      class={iconBtnClass}
      href={rmvUrl(name, m.lat, m.lng)}
      target="_blank"
      rel="noopener"
      aria-label={tr.navigate}
      title={tr.navigate}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3 shrink-0">
        <path d={ICON.navigate} />
      </svg>
    </a>
  );
}

function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" width="11" height="11" class="align-[-1px]">
      <path d={ICON.openInNew} />
    </svg>
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
    <span class="text-[0.6875rem] font-medium text-red-700 bg-red-50 px-1.5 rounded" title={`${daysLeft} ${daysUnit}`}>
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
    <a href={ex.detail_url} target="_blank" rel="noopener" class={titleLinkClass}>
      {ex.title}
    </a>
  ) : (
    ex.title
  );

  return (
    <li>
      <article class={cardClass} data-item-id={ex.id} data-museum-slug={ex.museum_slug}>
        <div class="shrink-0 w-[72px] max-[480px]:w-14 flex flex-col items-center gap-1">
          <CardImage src={ex.image_url} alt={ex.title} detailUrl={ex.detail_url} lazy={idx > 2} />
          {dates && (
            <span class="text-[0.5625rem] font-medium text-text-tertiary bg-border-light px-1 py-0.5 rounded text-center leading-tight">
              {dates}
            </span>
          )}
        </div>
        <div class="card-body min-w-0 flex flex-col">
          <p class="text-sm font-medium leading-tight mb-0.5">
            {titleContent} <TranslatedBadge translated={ex.translated} />
          </p>
          <p class="text-xs text-text-secondary">{ex.museum_name || ""}</p>
          <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <EndingBadge endDate={ex.end_date} todayIso={todayIso} tr={tr} />
            <LikeBadge count={ex.like_count} />
            <NavButton slug={ex.museum_slug} name={ex.museum_name || ""} tr={tr} />
            <button
              type="button"
              class="card-visited-btn inline-flex items-center justify-center min-w-7 min-h-7 text-text-tertiary bg-transparent border border-border p-0 rounded cursor-pointer font-sans transition-colors hover:border-accent hover:text-accent"
              aria-pressed="false"
              aria-label={tr.markVisited}
              title={tr.markVisited}
              data-item-type="exhibition"
              onclick={`onToggleVisited(${ex.id},this.dataset.itemType)`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3">
                <path d={ICON.visibility} />
              </svg>
            </button>
          </div>
          {ex.description && (
            <details class="mt-1">
              <summary class="text-[0.6875rem] text-text-tertiary cursor-pointer hover:text-accent">
                <span aria-hidden="true" class="disclosure-icon" />
                {tr.details}
              </summary>
              <div class={descriptionClass}>{ex.description}</div>
            </details>
          )}
        </div>
      </article>
    </li>
  );
}

const calLinkClass =
  "flex items-center gap-2 px-3 py-1.5 text-[0.6875rem] text-text-secondary no-underline hover:bg-border-light rounded transition-colors";

function CalendarDropdown({ ev, tr }: { ev: EventWithLikes; tr: Record<string, string> }) {
  const googleUrl = buildCalendarUrl(ev);
  const outlookUrl = buildOutlookUrl(ev);
  const yahooUrl = buildYahooUrl(ev);
  const icsUrl = `/api/event/${ev.id}.ics`;

  const popId = `cal-${ev.id}`;
  return (
    <span class="relative inline-block">
      <button
        type="button"
        class={iconBtnClass}
        aria-label={tr.addToCalendar}
        title={tr.addToCalendar}
        popovertarget={popId}
        style={`anchor-name:--${popId}`}
        onclick={`if(!CSS.supports('anchor-name','--a')){var p=document.getElementById('${popId}');var r=this.getBoundingClientRect();p.style.top=(r.bottom+4)+'px';p.style.left=Math.max(8,r.right-180)+'px'}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3 shrink-0">
          <path d={ICON.event} />
        </svg>
      </button>
      <div
        id={popId}
        popover="auto"
        style={`position-anchor:--${popId};position-area:bottom span-right`}
        class="fixed m-0 p-0 bg-surface rounded-lg shadow-search border border-border py-1 min-w-[180px]"
      >
        <a href={googleUrl} target="_blank" rel="noopener" class={calLinkClass}>
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" class="w-3.5 h-3.5 shrink-0">
            <path d="M8 1a7 7 0 110 14A7 7 0 018 1z" stroke="currentColor" stroke-width="1.2" />
            <path
              d="M5.5 8l2 2 3-4"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Google
        </a>
        <a href={outlookUrl} target="_blank" rel="noopener" class={calLinkClass}>
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" class="w-3.5 h-3.5 shrink-0">
            <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.2" />
            <path d="M2 6l6 3.5L14 6" stroke="currentColor" stroke-width="1.2" />
          </svg>
          Outlook
        </a>
        <a href={yahooUrl} target="_blank" rel="noopener" class={calLinkClass}>
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" class="w-3.5 h-3.5 shrink-0">
            <path
              d="M3 3l5 6v4M13 3L8 9"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Yahoo
        </a>
        <hr class="my-1 border-border-light" />
        <a href={icsUrl} download="event.ics" class={calLinkClass}>
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" class="w-3.5 h-3.5 shrink-0">
            <path
              d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          .ics (Apple, Proton, ...)
        </a>
      </div>
    </span>
  );
}

function EventCard({ ev, idx, tr }: { ev: EventWithLikes; idx: number; tr: Record<string, string> }) {
  const timeStr = ev.time ? (ev.end_time ? `${ev.time}–${ev.end_time}` : ev.time) : "";
  const linkUrl = ev.detail_url || ev.url;
  const titleContent = linkUrl ? (
    <a href={linkUrl} target="_blank" rel="noopener" class={titleLinkClass}>
      {ev.title}
    </a>
  ) : (
    ev.title
  );
  return (
    <li>
      <article
        class={cardClass}
        data-item-id={ev.id}
        data-museum-slug={ev.museum_slug}
        data-event-time={ev.time || undefined}
        data-event-date={ev.date}
      >
        <div class="shrink-0 w-[72px] max-[480px]:w-14 flex flex-col items-center gap-1">
          <CardImage src={ev.image_url} alt={ev.title} detailUrl={linkUrl} lazy={idx > 2} />
          {timeStr && (
            <span class="card-time text-[0.625rem] font-medium text-accent bg-accent-light px-1 py-0.5 rounded text-center leading-tight">
              {timeStr}
            </span>
          )}
        </div>
        <div class="card-body min-w-0 flex flex-col">
          <p class="text-sm font-medium leading-tight mb-0.5">
            {titleContent} <TranslatedBadge translated={ev.translated} />
          </p>
          <p class="text-xs text-text-secondary">{ev.museum_name || ""}</p>
          <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {ev.price && (
              <span class="text-[0.6875rem] font-medium text-text-secondary bg-border-light px-1.5 rounded">
                {ev.price}
              </span>
            )}
            <LikeBadge count={ev.like_count} />
            <NavButton slug={ev.museum_slug} name={ev.museum_name || ""} tr={tr} />
            <CalendarDropdown ev={ev} tr={tr} />
          </div>
          {ev.description && (
            <details class="mt-1">
              <summary class="text-[0.6875rem] text-text-tertiary cursor-pointer hover:text-accent">
                <span aria-hidden="true" class="disclosure-icon" />
                {tr.details}
              </summary>
              <div class={descriptionClass}>{ev.description}</div>
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
    <details class="section mb-10" data-section={sectionKey} open>
      <summary class="section-header flex items-center gap-2 mb-4 cursor-pointer select-none hover:[&_.section-title]:text-text-secondary">
        <svg
          aria-hidden="true"
          class="section-icon w-5 h-5 shrink-0 [&_path]:stroke-text-tertiary"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={iconPath} stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <h2 class="section-title text-[0.6875rem] font-bold uppercase tracking-widest text-text-tertiary">{title}</h2>
        <span
          class="text-[0.6875rem] font-medium text-text-tertiary bg-border-light px-2 py-0.5 rounded-full"
          title={`${count} ${title}`}
        >
          {count}
        </span>
        <svg
          aria-hidden="true"
          class="section-chevron ml-auto text-text-tertiary transition-transform shrink-0 [[open]>summary_&]:rotate-180"
          viewBox="0 0 16 16"
          fill="none"
          width="14"
          height="14"
        >
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

function MuseumRow({ slug, museum, tr }: { slug: string; museum: MuseumInfo; tr: Record<string, string> }) {
  const geo = MUSEUM_LOCATIONS[slug];
  return (
    <li>
      <div
        class="flex items-center gap-3 py-2.5 px-4 border-b border-border-light last:border-b-0"
        data-museum-slug={slug}
      >
        {museum.image_url && (
          <div class={imgWrapClass}>
            <img
              class="w-full h-full object-cover"
              src={`/img/${encodeURIComponent(museum.image_url)}?w=120`}
              alt={museum.name}
              loading="lazy"
            />
          </div>
        )}
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium leading-tight">
            {museum.website ? (
              <a
                href={museum.website}
                target="_blank"
                rel="noopener"
                class="text-inherit no-underline hover:text-accent"
              >
                {museum.name}
              </a>
            ) : (
              museum.name
            )}
            {museum.museumsufer === false && (
              <span class="text-text-tertiary ml-1 opacity-60 text-[0.625rem]" title={tr.notMuseumsufer}>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  width="10"
                  height="10"
                  class="align-[-1px] inline"
                >
                  <path d="M8 2L2 6v1h12V6L8 2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
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
          </p>
          {museum.description && <p class="text-xs text-text-tertiary mt-0.5 leading-snug">{museum.description}</p>}
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          {museum.website && (
            <a
              class="inline-flex items-center justify-center min-w-7 min-h-7 text-text-tertiary border border-border rounded transition-colors no-underline hover:border-accent hover:text-accent"
              href={museum.website}
              target="_blank"
              rel="noopener"
              aria-label={museum.name}
              title={museum.name}
            >
              <ExternalLinkIcon />
            </a>
          )}
          {geo && (
            <a
              class="inline-flex items-center justify-center min-w-7 min-h-7 text-text-tertiary border border-border rounded transition-colors no-underline hover:border-accent hover:text-accent"
              href={rmvUrl(museum.name, geo.lat, geo.lng)}
              target="_blank"
              rel="noopener"
              aria-label={tr.navigate}
              title={tr.navigate}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3">
                <path d={ICON.navigate} />
              </svg>
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export function ContentBody({
  events,
  exhibitions,
  tr,
  locale,
  todayIso,
}: {
  events: EventWithLikes[];
  exhibitions: ExhibitionWithLikes[];
  tr: Record<string, string>;
  locale: Locale;
  todayIso: string;
}) {
  const sortedEvents = sortByPopularity(events);
  const sortedExhibitions = sortByPopularity(exhibitions);

  return (
    <>
      <Section
        sectionKey="events"
        title={tr.events}
        count={events.length}
        iconPath="M6 2v2M14 2v2M3 8h14M5 4h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
      >
        {sortedEvents.length === 0 ? (
          <div class={emptyStateClass}>{tr.noEvents}</div>
        ) : (
          <ul class={cardListClass}>
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
        {sortedExhibitions.length === 0 ? (
          <div class={emptyStateClass}>{tr.noExhibitions}</div>
        ) : (
          <ul class={cardListClass}>
            <ExhibitionList exhibitions={sortedExhibitions} todayIso={todayIso} locale={locale} tr={tr} />
            <li>
              <details class="visited-section mt-4 py-2.5 px-4" id="visited-section" hidden>
                <summary class="text-[0.6875rem] font-bold uppercase tracking-wide text-text-tertiary cursor-pointer flex items-center gap-2">
                  <span aria-hidden="true" class="disclosure-icon" />
                  {tr.alreadyVisited}{" "}
                  <span class={badgeCountClass} id="visited-count">
                    0
                  </span>
                </summary>
                <ul class={`${cardListClass} mt-3`} id="visited-list" />
              </details>
            </li>
          </ul>
        )}
      </Section>
    </>
  );
}

export function MuseumsSection({ museums, tr }: { museums: Record<string, MuseumInfo>; tr: Record<string, string> }) {
  return (
    <Section
      sectionKey="museums"
      title={tr.museums}
      count={Object.keys(museums).length}
      iconPath="M10 2L2 6v1.5h16V6L10 2zM4 9.5v5h1.5v-5H4zm3.5 0v5H9v-5H7.5zm3.5 0v5h1.5v-5H11zm3.5 0v5H16v-5h-1.5zM2 16v1.5h16V16H2z"
    >
      <ul class={cardListClass}>
        {Object.entries(museums)
          .sort(([, a], [, b]) => a.name.localeCompare(b.name))
          .map(([slug, m]) => (
            <MuseumRow slug={slug} museum={m} tr={tr} />
          ))}
      </ul>
    </Section>
  );
}

function ExhibitionList({
  exhibitions,
  todayIso,
  locale,
  tr,
}: {
  exhibitions: ExhibitionWithLikes[];
  todayIso: string;
  locale: Locale;
  tr: Record<string, string>;
}) {
  return (
    <>
      {exhibitions.map((ex, i) => (
        <ExhibitionCard ex={ex} idx={i} todayIso={todayIso} locale={locale} tr={tr} />
      ))}
    </>
  );
}
