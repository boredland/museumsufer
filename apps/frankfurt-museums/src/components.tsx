import { buildUtm, dateFormatter } from "@museumsufer/core";
import { dateLocale, type Locale } from "./i18n";
import { getMuseumLocations, MUSEUMS } from "./museum-config";
import { buildCalendarUrl, buildOutlookUrl, buildYahooUrl, formatDateShort } from "./shared";
import type { Event, Exhibition, MuseumInfo } from "./types";

function Icon({ id, class: cls }: { id: string; class: string }) {
  return (
    <svg aria-hidden="true" class={cls}>
      <use href={`#${id}`} />
    </svg>
  );
}

const MUSEUM_LOCATIONS = getMuseumLocations();

function searchHaystack(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const utm = buildUtm("museumsufer.app");

function ImagePlaceholder({ hero }: { hero?: boolean }) {
  return (
    <div class={`thumb thumb-placeholder${hero ? " thumb--hero" : ""}`} aria-hidden="true">
      <svg aria-hidden="true" width={hero ? 32 : 24} height={hero ? 32 : 24} viewBox="0 0 24 24" fill="none">
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
  utmContent,
  hero,
  priority,
}: {
  src: string | null;
  alt: string;
  detailUrl: string | null;
  lazy: boolean;
  utmContent: string;
  hero?: boolean;
  priority?: boolean;
}) {
  const wrapClass = `thumb${hero ? " thumb--hero" : ""}`;
  const w = hero ? 112 : 72;
  const h = hero ? 112 : 54;
  const inner = src ? (
    <div class={wrapClass}>
      <img
        class="thumb__img"
        src={`${src}?w=${w * 2}`}
        srcset={`${src}?w=${w} ${w}w, ${src}?w=${w * 2} ${w * 2}w`}
        sizes={hero ? "(max-width: 480px) 80px, 112px" : "(max-width: 480px) 56px, 72px"}
        width={w}
        height={h}
        alt={alt}
        loading={lazy ? "lazy" : undefined}
        fetchpriority={priority ? "high" : undefined}
      />
    </div>
  ) : (
    <ImagePlaceholder hero={hero} />
  );

  if (detailUrl) {
    return (
      <a href={utm(detailUrl, utmContent)} target="_blank" rel="noopener" tabindex={-1} class="thumb-link">
        {inner}
      </a>
    );
  }
  return inner;
}

function TranslatedBadge({ translated }: { translated?: boolean }) {
  if (!translated) return null;
  return (
    <span class="translated-badge" title="Translated by DeepL">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" class="translated-badge__icon">
        <path
          d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"
          fill="currentColor"
        />
      </svg>
      DeepL
    </span>
  );
}

function navUrls(name: string, lat: number, lng: number) {
  const zid = `A=2@O=${name}@X=${Math.round(lng * 1e6)}@Y=${Math.round(lat * 1e6)}@`;
  return {
    rmvApp: `https://www.rmv.de/go/?ZID=${encodeURIComponent(zid)}`,
    rmvWeb: `https://www.rmv.de/c/de/fahrplan/verbindungssuche-hinweise/fahrplanauskunft?language=de_DE&context=TP&start=1&ZID=${encodeURIComponent(zid)}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    apple: `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=r`,
  };
}

const positionPopover = `var p=document.getElementById(this.getAttribute('popovertarget'));var r=this.getBoundingClientRect();p.style.top=(r.bottom+4)+'px';p.style.left=Math.max(8,Math.min(r.right-180,innerWidth-188))+'px'`;

/** Navigation button for museums — opens popover menu with RMV, Google Maps, and Apple Maps links */
export function NavButton({ slug, name, tr }: { slug: string | undefined; name: string; tr: Record<string, string> }) {
  if (!slug || !MUSEUM_LOCATIONS[slug]) return null;
  const m = MUSEUM_LOCATIONS[slug];
  const urls = navUrls(name, m.lat, m.lng);
  const popId = `nav-${slug}`;
  return (
    <span class="popover-wrap">
      <button
        type="button"
        class="icon-btn"
        aria-label={tr.navigate}
        title={tr.navigate}
        aria-haspopup="menu"
        popovertarget={popId}
        onclick={positionPopover}
      >
        <Icon id="i-navigate" class="icon-btn__icon" />
      </button>
      <div id={popId} popover="auto" role="menu" class="nav-popover">
        <a
          href={urls.rmvApp}
          target="_blank"
          rel="noopener"
          role="menuitem"
          class="nav-popover__link nav-popover__link--rmv-app"
        >
          <Icon id="i-rmv" class="nav-popover__icon" />
          RMV
        </a>
        <a
          href={urls.rmvWeb}
          target="_blank"
          rel="noopener"
          role="menuitem"
          class="nav-popover__link nav-popover__link--rmv-web"
        >
          <Icon id="i-rmv" class="nav-popover__icon" />
          RMV
        </a>
        <a href={urls.google} target="_blank" rel="noopener" role="menuitem" class="nav-popover__link">
          <Icon id="i-gmaps" class="nav-popover__icon" />
          Google Maps
        </a>
        <a href={urls.apple} target="_blank" rel="noopener" role="menuitem" class="nav-popover__link">
          <Icon id="i-apple" class="nav-popover__icon" />
          Apple Maps
        </a>
      </div>
    </span>
  );
}

function ExternalLinkIcon() {
  return <Icon id="i-open" class="icon-open" />;
}

/** Report button for submitting feedback about events, exhibitions, or museums */
export function ReportButton({
  type,
  title,
  museum,
  url,
  tr,
}: {
  type: "event" | "exhibition" | "museum";
  title: string;
  museum?: string;
  url?: string | null;
  tr: Record<string, string>;
}) {
  return (
    <button
      type="button"
      data-report-type={type}
      data-report-title={title}
      data-report-museum={museum || ""}
      data-report-url={url || ""}
      aria-label={tr.reportLabel}
      title={tr.reportLabel}
      class="icon-btn-ghost"
    >
      <Icon id="i-report" class="icon-btn-ghost__icon" />
    </button>
  );
}

/** Share button for sharing events, exhibitions, or museums on social media */
export function ShareButton({
  type,
  id,
  title,
  museum,
  date,
  tr,
}: {
  type: "event" | "exhibition" | "museum";
  id: string | number;
  title: string;
  museum?: string;
  date?: string;
  tr: Record<string, string>;
}) {
  return (
    <button
      type="button"
      data-share-type={type}
      data-share-id={id}
      data-share-title={title}
      data-share-museum={museum || ""}
      data-share-date={date || ""}
      aria-label={tr.shareLabel}
      title={tr.shareLabel}
      class="icon-btn-ghost"
    >
      <Icon id="i-share" class="icon-btn-ghost__icon" />
    </button>
  );
}

const CATEGORY_STYLES: Record<string, { icon: string; mod: string; trKey: string }> = {
  Film: { icon: "i-film", mod: "film", trKey: "categoryFilm" },
  Führung: { icon: "i-navigate", mod: "guide", trKey: "categoryFuehrung" },
  Workshop: { icon: "i-edit", mod: "workshop", trKey: "categoryWorkshop" },
  Vortrag: { icon: "i-chat", mod: "talk", trKey: "categoryVortrag" },
  Familie: { icon: "i-user", mod: "family", trKey: "categoryFamilie" },
  Vernissage: { icon: "i-star", mod: "vernissage", trKey: "categoryVernissage" },
  Konzert: { icon: "i-music", mod: "concert", trKey: "categoryKonzert" },
};

function EventTag({ category, tr }: { category: string | null; tr: Record<string, string> }) {
  if (!category) return null;
  const config = CATEGORY_STYLES[category];
  const label = config ? tr[config.trKey] || category : category;
  const cls = config ? `event-tag event-tag--${config.mod}` : "event-tag";
  const icon = config?.icon ?? "i-tag";
  return (
    <span class={cls}>
      <Icon id={icon} class="event-tag__icon" />
      {label}
    </span>
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
  const urgent = daysLeft <= 3;
  return (
    <span class={`ending-badge${urgent ? " ending-badge--urgent" : ""}`} title={`${daysLeft} ${daysUnit}`}>
      <span aria-hidden="true" class="ending-badge__dot" />
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
  ex: Exhibition;
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
    <a href={utm(ex.detail_url, "exhibition_title")} target="_blank" rel="noopener" class="title-link">
      {ex.title}
    </a>
  ) : (
    ex.title
  );

  const hero = idx === 0;
  return (
    <li data-search={searchHaystack(ex.title, ex.museum_name, ex.description)}>
      <article
        class={`card${hero ? " is-hero" : ""}`}
        data-item-id={ex.id}
        data-share-key={`exhibition-${ex.id}`}
        data-museum-slug={ex.museum_slug}
      >
        <div class={`card-thumb-col${hero ? " card-thumb-col--hero" : ""}`}>
          <CardImage
            src={ex.image_url ?? null}
            alt={ex.title}
            detailUrl={ex.detail_url ?? null}
            lazy={idx > 2}
            utmContent="exhibition_image"
            hero={hero}
            priority={idx === 0}
          />
          {dates && <span class="card-date-pill">{dates}</span>}
        </div>
        <div class="card-body">
          <p class={hero ? "card-title card-title-line--hero" : "card-title-line card-title-line--sm"}>
            {titleContent} <TranslatedBadge translated={ex.translated} />
          </p>
          <p class="card-venue">
            {ex.museum_slug ? (
              <a href={`/museum/${ex.museum_slug}`} class="museum-link">
                {ex.museum_name || ""}
              </a>
            ) : (
              ex.museum_name || ""
            )}
          </p>
          <div class="card-badges">
            <EndingBadge endDate={ex.end_date ?? null} todayIso={todayIso} tr={tr} />
            <NavButton slug={ex.museum_slug} name={ex.museum_name || ""} tr={tr} />
            <button
              type="button"
              class="card-visited-btn icon-btn-ghost"
              aria-pressed="false"
              aria-label={tr.markVisited}
              title={tr.markVisited}
              data-item-type="exhibition"
              onclick={`onToggleVisited(${ex.id},this.dataset.itemType)`}
            >
              <Icon id="i-visibility" class="icon-btn-ghost__icon" />
            </button>
            <ReportButton
              type="exhibition"
              title={ex.title}
              museum={ex.museum_name || ""}
              url={ex.detail_url}
              tr={tr}
            />
            <ShareButton
              type="exhibition"
              id={ex.id}
              title={ex.title}
              museum={ex.museum_name || ""}
              date={todayIso}
              tr={tr}
            />
          </div>
          {ex.description && (
            <details class="card-disclosure" open={hero}>
              <summary class="card-disclosure__summary">
                <span aria-hidden="true" class="disclosure-icon" />
                {tr.details}
              </summary>
              <div class="card-description">{ex.description}</div>
            </details>
          )}
        </div>
      </article>
    </li>
  );
}

function CalendarDropdown({ ev, tr }: { ev: Event; tr: Record<string, string> }) {
  // CalendarEvent (in @museumsufer/core) uses `string | null` semantics.
  // Our optional Event fields land as `string | undefined` after stripping;
  // coerce here so the helper signatures stay narrow.
  const calEv = {
    date: ev.date,
    time: ev.time ?? null,
    end_time: ev.end_time ?? null,
    end_date: ev.end_date ?? null,
    title: ev.title,
    description: ev.description ?? null,
    detail_url: ev.detail_url ?? null,
  };
  const googleUrl = buildCalendarUrl(calEv);
  const outlookUrl = buildOutlookUrl(calEv);
  const yahooUrl = buildYahooUrl(calEv);
  const icsUrl = `/event/${ev.id}/feed.ics`;

  const popId = `cal-${ev.id}`;
  return (
    <span class="popover-wrap">
      <button
        type="button"
        class="icon-btn"
        aria-label={tr.addToCalendar}
        title={tr.addToCalendar}
        aria-haspopup="menu"
        popovertarget={popId}
        onclick={positionPopover}
      >
        <Icon id="i-event" class="icon-btn__icon" />
      </button>
      <div id={popId} popover="auto" role="menu" class="nav-popover">
        <a href={googleUrl} target="_blank" rel="noopener" role="menuitem" class="nav-popover__link">
          <Icon id="i-cal-google" class="nav-popover__icon" />
          Google
        </a>
        <a href={outlookUrl} target="_blank" rel="noopener" role="menuitem" class="nav-popover__link">
          <Icon id="i-cal-outlook" class="nav-popover__icon" />
          Outlook
        </a>
        <a href={yahooUrl} target="_blank" rel="noopener" role="menuitem" class="nav-popover__link">
          <Icon id="i-cal-yahoo" class="nav-popover__icon" />
          Yahoo
        </a>
        <hr class="nav-popover__divider" />
        <a href={icsUrl} download="event.ics" role="menuitem" class="nav-popover__link">
          <Icon id="i-cal-ics" class="nav-popover__icon" />
          .ics (Apple, Proton, ...)
        </a>
      </div>
    </span>
  );
}

function EventCard({
  ev,
  idx,
  tr,
  hero: heroProp,
}: {
  ev: Event;
  idx: number;
  tr: Record<string, string>;
  hero?: boolean;
}) {
  const timeStr = ev.time ? (ev.end_time ? `${ev.time}–${ev.end_time}` : ev.time) : "";
  const linkUrl = ev.detail_url || ev.url || null;
  const hero = heroProp !== undefined ? heroProp : idx === 0;
  const titleContent = linkUrl ? (
    <a href={utm(linkUrl, "event_title")} target="_blank" rel="noopener" class="title-link">
      {ev.title}
    </a>
  ) : (
    ev.title
  );
  return (
    <li data-search={searchHaystack(ev.title, ev.museum_name, ev.description)}>
      <article
        class={`card${hero ? " is-hero" : ""}`}
        data-item-id={ev.id}
        data-share-key={`event-${ev.id}`}
        data-museum-slug={ev.museum_slug}
        data-event-time={ev.time || undefined}
        data-event-date={ev.date}
      >
        <div class={`card-thumb-col${hero ? " card-thumb-col--hero" : ""}`}>
          <CardImage
            src={ev.image_url ?? null}
            alt={ev.title}
            detailUrl={linkUrl}
            lazy={idx > 2}
            utmContent="event_image"
            hero={hero}
            priority={idx === 0}
          />
          {timeStr && <span class="card-time">{timeStr}</span>}
        </div>
        <div class="card-body">
          <p class={hero ? "card-title card-title-line--hero" : "card-title-line card-title-line--sm"}>
            {titleContent} <TranslatedBadge translated={ev.translated} />
          </p>
          <p class="card-venue">
            {ev.museum_slug ? (
              <a href={`/museum/${ev.museum_slug}`} class="museum-link">
                {ev.museum_name || ""}
              </a>
            ) : (
              ev.museum_name || ""
            )}
          </p>
          <div class="card-badges">
            <NavButton slug={ev.museum_slug} name={ev.museum_name || ""} tr={tr} />
            <CalendarDropdown ev={ev} tr={tr} />
            <EventTag category={ev.category ?? null} tr={tr} />
            {ev.price && <span class="card-price">{ev.price}</span>}
            <ReportButton type="event" title={ev.title} museum={ev.museum_name || ""} url={linkUrl} tr={tr} />
            <ShareButton
              type="event"
              id={ev.id}
              title={ev.title}
              museum={ev.museum_name || ""}
              date={ev.date}
              tr={tr}
            />
          </div>
          {ev.description && (
            <details class="card-disclosure" open={hero}>
              <summary class="card-disclosure__summary">
                <span aria-hidden="true" class="disclosure-icon" />
                {tr.details}
              </summary>
              <div class="card-description">{ev.description}</div>
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
  description,
  count,
  iconPath: _iconPath,
  children,
  defaultOpen = true,
}: {
  sectionKey: string;
  title: string;
  description?: string;
  count: number;
  iconPath: string;
  children: unknown;
  defaultOpen?: boolean;
}) {
  return (
    <details class="section" data-section={sectionKey} open={defaultOpen}>
      <summary class="section__summary">
        <div class="section__title-row">
          <h2 class="section-display section__title">{title}</h2>
          <span class="section-count section__count" title={`${count} ${title}`} data-total={count}>
            {String(count).padStart(2, "0")}
          </span>
          <svg
            aria-hidden="true"
            class="section-chevron section__chevron"
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
        </div>
        {description && <p class="section__description">{description}</p>}
      </summary>
      {children}
    </details>
  );
}

function MuseumRow({ slug, museum, tr }: { slug: string; museum: MuseumInfo; tr: Record<string, string> }) {
  return (
    <li class="museum-cell" data-search={searchHaystack(museum.name, slug)}>
      <div class="museum-tile" data-museum-slug={slug} data-share-key={`museum-${slug}`}>
        <div class="museum-tile__media">
          {museum.image_url ? (
            <img
              class="museum-tile__media-img"
              src={`/img/${encodeURIComponent(museum.image_url)}?w=320`}
              srcset={`/img/${encodeURIComponent(museum.image_url)}?w=200 200w, /img/${encodeURIComponent(museum.image_url)}?w=320 320w`}
              sizes="(max-width: 480px) 45vw, (max-width: 720px) 30vw, 220px"
              width={320}
              height={240}
              alt={museum.name}
              loading="lazy"
            />
          ) : (
            <div class="museum-tile__media-placeholder">
              <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 6v2h20V6L12 2zM4 11v6h2v-6H4zm4 0v6h2v-6H8zm4 0v6h2v-6h-2zm4 0v6h2v-6h-2zM2 19v2h20v-2H2z"
                  fill="currentColor"
                />
              </svg>
            </div>
          )}
        </div>
        <div class="museum-tile__body">
          <p class="museum-tile__title">
            <a href={`/museum/${slug}`} class="museum-tile__title-link">
              {museum.name}
            </a>
          </p>
          {MUSEUMS[slug]?.abbreviation && <p class="museum-tile__abbrev">{MUSEUMS[slug]?.abbreviation}</p>}
          {museum.museumsufer === false && (
            <span class="museum-tile__excl" title={tr.notMuseumsufer}>
              Card excl.
            </span>
          )}
          <div class="museum-tile__actions">
            {museum.website && (
              <a
                class="museum-tile__website"
                href={utm(museum.website, "museum_link")}
                target="_blank"
                rel="noopener"
                aria-label={museum.name}
                title={museum.name}
              >
                <ExternalLinkIcon />
              </a>
            )}
            <NavButton slug={slug} name={museum.name} tr={tr} />
            <ReportButton type="museum" title={museum.name} url={museum.website} tr={tr} />
            <ShareButton type="museum" id={slug} title={museum.name} tr={tr} />
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Quiet editorial cross-link to the two sibling Frankfurt apps. Sits
 * after the events + exhibitions block — a soft suggestion for visitors
 * who didn't find anything in today's museum line-up.
 */
function SiblingStrap({ tr }: { tr: Record<string, string> }) {
  const template = tr.siblingTemplate;
  const [before, midRaw] = template.split("{first}");
  const [mid, after] = (midRaw ?? "").split("{second}");
  return (
    <section class="sibling-strap">
      <hr class="sibling-strap__rule" />
      <p class="sibling-strap__text">
        {before}
        <a href="https://frankfurt.ins.theater" class="sibling-strap__link">
          {tr.siblingTheaterLabel}
        </a>
        {mid}
        <a href="https://frankfurt.konzert.haus" class="sibling-strap__link">
          {tr.siblingKonzertLabel}
        </a>
        {after}
      </p>
    </section>
  );
}

/** Main content section with events and exhibitions — used on landing page and partial updates */
export function ContentBody({
  events,
  exhibitions,
  tr,
  locale,
  todayIso,
  groupByDate,
}: {
  events: Event[];
  exhibitions: Exhibition[];
  tr: Record<string, string>;
  locale: Locale;
  todayIso: string;
  groupByDate?: boolean;
}) {
  const sortedEvents = [...events].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || "").localeCompare(b.time || ""),
  );
  const sortedExhibitions = [...exhibitions].sort((a, b) => (a.museum_name || "").localeCompare(b.museum_name || ""));

  return (
    <>
      <Section
        sectionKey="events"
        title={tr.events}
        description={tr.eventsDescription}
        count={events.length}
        iconPath="M6 2v2M14 2v2M3 8h14M5 4h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
      >
        {sortedEvents.length === 0 ? (
          <div class="empty-state">{tr.noEvents}</div>
        ) : groupByDate ? (
          <GroupedEventList events={sortedEvents} locale={locale} tr={tr} />
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
        description={tr.exhibitionsDescription}
        count={exhibitions.length}
        iconPath="M4 16V4h12v12H4zM7 4v12M13 4v12M4 10h12"
      >
        {sortedExhibitions.length === 0 ? (
          <div class="empty-state">{tr.noExhibitions}</div>
        ) : (
          <ul class="card-list">
            <ExhibitionList exhibitions={sortedExhibitions} todayIso={todayIso} locale={locale} tr={tr} />
            <li>
              <details class="visited-section" id="visited-section" hidden>
                <summary class="visited-section__summary">
                  <span aria-hidden="true" class="disclosure-icon" />
                  {tr.alreadyVisited}
                  <span id="visited-count" class="visited-section__count">
                    0
                  </span>
                </summary>
                <ul class="card-list visited-section__list" id="visited-list" />
              </details>
            </li>
          </ul>
        )}
      </Section>

      <SiblingStrap tr={tr} />
    </>
  );
}

/** Museums grid section — displays all museums as cards with images and navigation buttons */
export function MuseumsSection({ museums, tr }: { museums: Record<string, MuseumInfo>; tr: Record<string, string> }) {
  return (
    <Section
      sectionKey="museums"
      title={tr.museums}
      description={tr.museumsDescription}
      count={Object.keys(museums).length}
      iconPath="M10 2L2 6v1.5h16V6L10 2zM4 9.5v5h1.5v-5H4zm3.5 0v5H9v-5H7.5zm3.5 0v5h1.5v-5H11zm3.5 0v5H16v-5h-1.5zM2 16v1.5h16V16H2z"
      defaultOpen={false}
    >
      <ul class="museum-grid">
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
  exhibitions: Exhibition[];
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

function GroupedEventList({ events, locale, tr }: { events: Event[]; locale: Locale; tr: Record<string, string> }) {
  const dl = dateLocale(locale);
  const weekdayFmt = dateFormatter(dl, { weekday: "long" });
  const dayMonthFmt = dateFormatter(dl, { day: "numeric", month: "long" });
  const groups: Record<string, Event[]> = {};
  for (const ev of events) {
    (groups[ev.date] ||= []).push(ev);
  }
  const dates = Object.keys(groups).sort();
  let cardIdx = 0;
  return (
    <div class="event-groups">
      {dates.map((date) => {
        const dayDate = new Date(`${date}T00:00:00`);
        const weekday = weekdayFmt.format(dayDate);
        const dayMonth = dayMonthFmt.format(dayDate);
        return (
          <section class="event-group">
            <header class="event-group__spine day-spine">
              <span class="event-group__day">{dayDate.getDate()}</span>
              <span class="event-group__weekday">{weekday}</span>
              <span class="event-group__sep">·</span>
              <span class="event-group__month">{dayMonth}</span>
            </header>
            <ul class="card-list">
              {groups[date].map((ev, i) => {
                const globalIdx = cardIdx++;
                return <EventCard ev={ev} idx={globalIdx} hero={i === 0} tr={tr} />;
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
