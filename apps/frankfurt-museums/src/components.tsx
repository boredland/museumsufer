import { dateLocale, type Locale } from "./i18n";
import { getMuseumLocations } from "./museum-config";
import { buildCalendarUrl, buildOutlookUrl, buildYahooUrl, formatDateShort, sortByPopularity } from "./shared";
import {
  cardClass,
  cardListClass,
  descriptionClass,
  emptyStateClass,
  iconBtnClass,
  iconBtnGhost,
  quietCountClass,
  titleLinkClass,
} from "./tw";
import type { EventWithLikes, ExhibitionWithLikes, MuseumInfo } from "./types";

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

function utm(url: string, content: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "museumsufer.app");
    u.searchParams.set("utm_medium", "referral");
    u.searchParams.set("utm_content", content);
    return u.toString();
  } catch {
    return url;
  }
}

function ImagePlaceholder({ hero }: { hero?: boolean }) {
  const cls = hero
    ? "w-[112px] h-[112px] max-[480px]:w-20 max-[480px]:h-20 rounded-lg shrink-0 bg-border-light flex items-center justify-center text-border"
    : "w-[72px] h-[54px] max-[480px]:w-14 max-[480px]:h-[42px] rounded-lg shrink-0 bg-border-light flex items-center justify-center text-border";
  return (
    <div class={cls} aria-hidden="true">
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

const imgWrapClass =
  "w-[72px] h-[54px] max-[480px]:w-14 max-[480px]:h-[42px] rounded-lg shrink-0 bg-border-light overflow-hidden";

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
  const wrapClass = hero
    ? "w-[112px] h-[112px] max-[480px]:w-20 max-[480px]:h-20 rounded-lg shrink-0 bg-border-light overflow-hidden"
    : imgWrapClass;
  const w = hero ? 112 : 72;
  const h = hero ? 112 : 54;
  const inner = src ? (
    <div class={wrapClass}>
      <img
        class="w-full h-full object-cover"
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
      <a href={utm(detailUrl, utmContent)} target="_blank" rel="noopener" tabindex={-1} class="shrink-0">
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
    <span class={`card-likes ${quietCountClass}`} title={`${count} likes`}>
      <Icon id="i-heart" class="w-3 h-3 shrink-0 fill-current" />
      {count}
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

const navLinkClass =
  "flex items-center gap-2 px-3 py-1.5 text-[0.6875rem] text-text-secondary no-underline hover:bg-border-light rounded transition-colors";

const positionPopover = `var p=document.getElementById(this.getAttribute('popovertarget'));var r=this.getBoundingClientRect();p.style.top=(r.bottom+4)+'px';p.style.left=Math.max(8,Math.min(r.right-180,innerWidth-188))+'px'`;

function NavButton({ slug, name, tr }: { slug: string | undefined; name: string; tr: Record<string, string> }) {
  if (!slug || !MUSEUM_LOCATIONS[slug]) return null;
  const m = MUSEUM_LOCATIONS[slug];
  const urls = navUrls(name, m.lat, m.lng);
  const popId = `nav-${slug}`;
  return (
    <span class="relative inline-block">
      <button
        type="button"
        class={iconBtnClass}
        aria-label={tr.navigate}
        title={tr.navigate}
        aria-haspopup="menu"
        popovertarget={popId}
        onclick={positionPopover}
      >
        <Icon id="i-navigate" class="w-3 h-3 shrink-0 fill-current" />
      </button>
      <div
        id={popId}
        popover="auto"
        role="menu"
        class="fixed m-0 p-0 bg-surface rounded-lg shadow-search border border-border py-1 min-w-[180px]"
      >
        <a
          href={urls.rmvApp}
          target="_blank"
          rel="noopener"
          role="menuitem"
          class={`${navLinkClass} hidden max-[1024px]:flex`}
        >
          <Icon id="i-rmv" class="w-3.5 h-3.5 shrink-0 fill-current" />
          RMV
        </a>
        <a
          href={urls.rmvWeb}
          target="_blank"
          rel="noopener"
          role="menuitem"
          class={`${navLinkClass} max-[1024px]:hidden`}
        >
          <Icon id="i-rmv" class="w-3.5 h-3.5 shrink-0 fill-current" />
          RMV
        </a>
        <a href={urls.google} target="_blank" rel="noopener" role="menuitem" class={navLinkClass}>
          <Icon id="i-gmaps" class="w-3.5 h-3.5 shrink-0" />
          Google Maps
        </a>
        <a href={urls.apple} target="_blank" rel="noopener" role="menuitem" class={navLinkClass}>
          <Icon id="i-apple" class="w-3.5 h-3.5 shrink-0" />
          Apple Maps
        </a>
      </div>
    </span>
  );
}

function ExternalLinkIcon() {
  return <Icon id="i-open" class="w-[11px] h-[11px] align-[-1px] fill-current" />;
}

function ReportButton({
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
      class={iconBtnGhost}
    >
      <Icon id="i-report" class="w-3 h-3 shrink-0 fill-current" />
    </button>
  );
}

function ShareButton({
  type,
  id,
  title,
  museum,
  tr,
}: {
  type: "event" | "exhibition" | "museum";
  id: string | number;
  title: string;
  museum?: string;
  tr: Record<string, string>;
}) {
  return (
    <button
      type="button"
      data-share-type={type}
      data-share-id={id}
      data-share-title={title}
      data-share-museum={museum || ""}
      aria-label={tr.shareLabel}
      title={tr.shareLabel}
      class={iconBtnGhost}
    >
      <Icon id="i-share" class="w-3 h-3 shrink-0 fill-current" />
    </button>
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
    <span
      class={`ending-badge inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] ${urgent ? "text-red-700 dark:text-red-500" : "text-text-tertiary"}`}
      title={`${daysLeft} ${daysUnit}`}
    >
      <span
        aria-hidden="true"
        class={`inline-block w-1.5 h-1.5 rounded-full ${urgent ? "bg-red-700 dark:bg-red-500" : "bg-text-tertiary"}`}
      />
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
    <a href={utm(ex.detail_url, "exhibition_title")} target="_blank" rel="noopener" class={titleLinkClass}>
      {ex.title}
    </a>
  ) : (
    ex.title
  );

  const hero = idx === 0;
  return (
    <li data-search={searchHaystack(ex.title, ex.museum_name, ex.description)}>
      <article
        class={`${cardClass}${hero ? " is-hero" : ""}`}
        data-item-id={ex.id}
        data-share-key={`exhibition-${ex.id}`}
        data-museum-slug={ex.museum_slug}
      >
        <div
          class={`shrink-0 ${hero ? "w-[112px] max-[480px]:w-20" : "w-[72px] max-[480px]:w-14"} flex flex-col items-center gap-1.5`}
        >
          <CardImage
            src={ex.image_url}
            alt={ex.title}
            detailUrl={ex.detail_url}
            lazy={idx > 2}
            utmContent="exhibition_image"
            hero={hero}
            priority={idx === 0}
          />
          {dates && (
            <span class="text-[0.5625rem] font-mono font-medium text-text-tertiary px-1 py-0.5 text-center leading-tight tracking-tight">
              {dates}
            </span>
          )}
        </div>
        <div class="card-body min-w-0 flex flex-col">
          <p class={hero ? "card-title mb-1.5" : "text-sm font-medium leading-tight mb-0.5"}>
            {titleContent} <TranslatedBadge translated={ex.translated} />
          </p>
          <p class="text-xs text-text-secondary">{ex.museum_name || ""}</p>
          <div class="flex items-center gap-1.5 mt-1 flex-wrap max-[480px]:gap-1">
            <EndingBadge endDate={ex.end_date} todayIso={todayIso} tr={tr} />
            <LikeBadge count={ex.like_count} />
            <NavButton slug={ex.museum_slug} name={ex.museum_name || ""} tr={tr} />
            <button
              type="button"
              class={`card-visited-btn ${iconBtnGhost}`}
              aria-pressed="false"
              aria-label={tr.markVisited}
              title={tr.markVisited}
              data-item-type="exhibition"
              onclick={`onToggleVisited(${ex.id},this.dataset.itemType)`}
            >
              <Icon id="i-visibility" class="w-3 h-3 shrink-0 fill-current" />
            </button>
            <ReportButton
              type="exhibition"
              title={ex.title}
              museum={ex.museum_name || ""}
              url={ex.detail_url}
              tr={tr}
            />
            <ShareButton type="exhibition" id={ex.id} title={ex.title} museum={ex.museum_name || ""} tr={tr} />
          </div>
          {ex.description && (
            <details class="mt-1" open={hero}>
              <summary class="card-disclosure text-[0.75rem] text-text-tertiary cursor-pointer hover:text-river inline-flex items-center">
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
        aria-haspopup="menu"
        popovertarget={popId}
        onclick={positionPopover}
      >
        <Icon id="i-event" class="w-3 h-3 shrink-0 fill-current" />
      </button>
      <div
        id={popId}
        popover="auto"
        role="menu"
        class="fixed m-0 p-0 bg-surface rounded-lg shadow-search border border-border py-1 min-w-[180px]"
      >
        <a href={googleUrl} target="_blank" rel="noopener" role="menuitem" class={calLinkClass}>
          <Icon id="i-cal-google" class="w-3.5 h-3.5 shrink-0" />
          Google
        </a>
        <a href={outlookUrl} target="_blank" rel="noopener" role="menuitem" class={calLinkClass}>
          <Icon id="i-cal-outlook" class="w-3.5 h-3.5 shrink-0" />
          Outlook
        </a>
        <a href={yahooUrl} target="_blank" rel="noopener" role="menuitem" class={calLinkClass}>
          <Icon id="i-cal-yahoo" class="w-3.5 h-3.5 shrink-0" />
          Yahoo
        </a>
        <hr class="my-1 border-border-light" />
        <a href={icsUrl} download="event.ics" role="menuitem" class={calLinkClass}>
          <Icon id="i-cal-ics" class="w-3.5 h-3.5 shrink-0" />
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
  ev: EventWithLikes;
  idx: number;
  tr: Record<string, string>;
  hero?: boolean;
}) {
  const timeStr = ev.time ? (ev.end_time ? `${ev.time}–${ev.end_time}` : ev.time) : "";
  const linkUrl = ev.detail_url || ev.url;
  const hero = heroProp !== undefined ? heroProp : idx === 0;
  const titleContent = linkUrl ? (
    <a href={utm(linkUrl, "event_title")} target="_blank" rel="noopener" class={titleLinkClass}>
      {ev.title}
    </a>
  ) : (
    ev.title
  );
  return (
    <li data-search={searchHaystack(ev.title, ev.museum_name, ev.description)}>
      <article
        class={`${cardClass}${hero ? " is-hero" : ""}`}
        data-item-id={ev.id}
        data-share-key={`event-${ev.id}`}
        data-museum-slug={ev.museum_slug}
        data-event-time={ev.time || undefined}
        data-event-date={ev.date}
      >
        <div
          class={`shrink-0 ${hero ? "w-[112px] max-[480px]:w-20" : "w-[72px] max-[480px]:w-14"} flex flex-col items-center gap-1.5`}
        >
          <CardImage
            src={ev.image_url}
            alt={ev.title}
            detailUrl={linkUrl}
            lazy={idx > 2}
            utmContent="event_image"
            hero={hero}
            priority={idx === 0}
          />
          {timeStr && (
            <span class="card-time text-[0.625rem] font-mono font-medium text-river bg-river-light px-1 py-0.5 rounded text-center leading-tight tabular-nums tracking-tight">
              {timeStr}
            </span>
          )}
        </div>
        <div class="card-body min-w-0 flex flex-col">
          <p class={hero ? "card-title mb-1.5" : "text-sm font-medium leading-tight mb-0.5"}>
            {titleContent} <TranslatedBadge translated={ev.translated} />
          </p>
          <p class="text-xs text-text-secondary">{ev.museum_name || ""}</p>
          <div class="flex items-center gap-1.5 mt-1 flex-wrap max-[480px]:gap-1">
            <NavButton slug={ev.museum_slug} name={ev.museum_name || ""} tr={tr} />
            <CalendarDropdown ev={ev} tr={tr} />
            <LikeBadge count={ev.like_count} />
            {ev.price && (
              <span class="text-[0.625rem] font-mono font-medium text-text-secondary tracking-tight">{ev.price}</span>
            )}
            <ReportButton type="event" title={ev.title} museum={ev.museum_name || ""} url={linkUrl} tr={tr} />
            <ShareButton type="event" id={ev.id} title={ev.title} museum={ev.museum_name || ""} tr={tr} />
          </div>
          {ev.description && (
            <details class="mt-1" open={hero}>
              <summary class="card-disclosure text-[0.75rem] text-text-tertiary cursor-pointer hover:text-river inline-flex items-center">
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
    <details class="section mb-12" data-section={sectionKey} open={defaultOpen}>
      <summary class="section-header mb-5 cursor-pointer select-none group">
        <div class="flex items-baseline gap-3">
          <h2 class="section-display flex-1 group-hover:text-river transition-colors">{title}</h2>
          <span
            class="section-count font-mono text-[0.6875rem] font-medium text-text-tertiary tabular-nums shrink-0"
            title={`${count} ${title}`}
            data-total={count}
          >
            {String(count).padStart(2, "0")}
          </span>
          <svg
            aria-hidden="true"
            class="section-chevron text-text-tertiary transition-transform shrink-0 [[open]>summary_&]:rotate-180"
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
        {description && (
          <p class="mt-1 text-[0.75rem] text-text-tertiary leading-snug font-display italic">{description}</p>
        )}
      </summary>
      {children}
    </details>
  );
}

function MuseumRow({ slug, museum, tr }: { slug: string; museum: MuseumInfo; tr: Record<string, string> }) {
  return (
    <li class="museum-cell" data-search={searchHaystack(museum.name, slug)}>
      <div
        class="group relative flex flex-col h-full bg-surface rounded-lg border border-border-light overflow-hidden transition-colors hover:border-river"
        data-museum-slug={slug}
        data-share-key={`museum-${slug}`}
      >
        <div class="aspect-[4/3] bg-border-light overflow-hidden">
          {museum.image_url ? (
            <img
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              src={`/img/${encodeURIComponent(museum.image_url)}?w=320`}
              srcset={`/img/${encodeURIComponent(museum.image_url)}?w=200 200w, /img/${encodeURIComponent(museum.image_url)}?w=320 320w`}
              sizes="(max-width: 480px) 45vw, (max-width: 720px) 30vw, 220px"
              width={320}
              height={240}
              alt={museum.name}
              loading="lazy"
            />
          ) : (
            <div class="w-full h-full flex items-center justify-center text-border">
              <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 6v2h20V6L12 2zM4 11v6h2v-6H4zm4 0v6h2v-6H8zm4 0v6h2v-6h-2zm4 0v6h2v-6h-2zM2 19v2h20v-2H2z"
                  fill="currentColor"
                />
              </svg>
            </div>
          )}
        </div>
        <div class="flex-1 flex flex-col gap-2 p-3">
          <p class="font-display italic text-[0.9375rem] leading-tight line-clamp-2 max-[480px]:text-[0.8125rem]">
            {museum.website ? (
              <a
                href={utm(museum.website, "museum_name")}
                target="_blank"
                rel="noopener"
                class="text-inherit no-underline hover:text-river focus-visible:outline-2 focus-visible:outline-river focus-visible:outline-offset-2 focus-visible:rounded-sm"
              >
                {museum.name}
              </a>
            ) : (
              museum.name
            )}
          </p>
          {museum.museumsufer === false && (
            <span
              class="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-text-tertiary opacity-70 -mt-1"
              title={tr.notMuseumsufer}
            >
              Card excl.
            </span>
          )}
          <div class="flex items-center gap-1 mt-auto">
            {museum.website && (
              <a
                class="inline-flex items-center justify-center w-7 h-7 text-text-tertiary border border-border rounded transition-colors no-underline hover:border-river hover:text-river"
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

export function ContentBody({
  events,
  exhibitions,
  tr,
  locale,
  todayIso,
  groupByDate,
}: {
  events: EventWithLikes[];
  exhibitions: ExhibitionWithLikes[];
  tr: Record<string, string>;
  locale: Locale;
  todayIso: string;
  groupByDate?: boolean;
}) {
  const sortedEvents = groupByDate
    ? [...events].sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || "").localeCompare(b.time || ""),
      )
    : sortByPopularity(events);
  const sortedExhibitions = sortByPopularity(exhibitions);

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
          <div class={emptyStateClass}>{tr.noEvents}</div>
        ) : groupByDate ? (
          <GroupedEventList events={sortedEvents} locale={locale} tr={tr} />
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
        description={tr.exhibitionsDescription}
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
                <summary class="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-text-tertiary cursor-pointer flex items-center gap-2 hover:text-river">
                  <span aria-hidden="true" class="disclosure-icon" />
                  {tr.alreadyVisited}
                  <span id="visited-count" class="font-mono text-[0.625rem] tabular-nums opacity-70">
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
      description={tr.museumsDescription}
      count={Object.keys(museums).length}
      iconPath="M10 2L2 6v1.5h16V6L10 2zM4 9.5v5h1.5v-5H4zm3.5 0v5H9v-5H7.5zm3.5 0v5h1.5v-5H11zm3.5 0v5H16v-5h-1.5zM2 16v1.5h16V16H2z"
      defaultOpen={false}
    >
      <ul class="museum-grid grid grid-cols-2 sm:grid-cols-3 gap-3 list-none p-0">
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

function GroupedEventList({
  events,
  locale,
  tr,
}: {
  events: EventWithLikes[];
  locale: Locale;
  tr: Record<string, string>;
}) {
  const dl = dateLocale(locale);
  const groups: Record<string, EventWithLikes[]> = {};
  for (const ev of events) {
    (groups[ev.date] ||= []).push(ev);
  }
  const dates = Object.keys(groups).sort();
  let cardIdx = 0;
  return (
    <div class="flex flex-col gap-8 lg:gap-10">
      {dates.map((date) => {
        const dayDate = new Date(`${date}T00:00:00`);
        const weekday = dayDate.toLocaleDateString(dl, { weekday: "long" });
        const dayMonth = dayDate.toLocaleDateString(dl, { day: "numeric", month: "long" });
        return (
          <section class="lg:grid lg:grid-cols-[6.5rem_1fr] lg:gap-6 lg:items-start">
            <header class="day-spine flex items-baseline gap-3 mb-3 px-1 lg:flex-col lg:items-end lg:gap-1 lg:mb-0 lg:px-0 lg:text-right lg:sticky lg:top-4 lg:self-start">
              <span class="font-display italic text-2xl text-river leading-none tabular-nums lg:text-[2.75rem] lg:tracking-tight">
                {dayDate.getDate()}
              </span>
              <span class="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-text-tertiary">{weekday}</span>
              <span class="font-mono text-[0.6875rem] text-text-tertiary opacity-60 lg:hidden">·</span>
              <span class="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-text-tertiary">{dayMonth}</span>
            </header>
            <ul class={cardListClass}>
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
