import { buildGoogleCalendarUrl, buildOutlookCalendarUrl, buildYahooCalendarUrl, type CalendarEvent } from "./calendar";

const ICON_CAL = (
  <svg
    viewBox="0 0 16 16"
    width="13"
    height="13"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
  >
    <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
    <path d="M2.5 6h11M5.5 2v3M10.5 2v3M5 9h2M9 9h2M5 11h2" stroke-linecap="round" />
  </svg>
);

const ICON_GCAL = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
    <path d="M19.5 4.5h-3V3a1 1 0 1 0-2 0v1.5h-5V3a1 1 0 1 0-2 0v1.5h-3A1.5 1.5 0 0 0 3 6v13.5A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5zM19 19H5V10h14v9zM5 8.5V6.5h14v2H5z" />
  </svg>
);

const ICON_OUTLOOK = (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
  >
    <rect x="3" y="6" width="13" height="12" rx="1.5" />
    <path d="M9.5 9.5a2.5 3 0 1 1 0 5 2.5 3 0 1 1 0-5z" />
    <path d="M16 10l4-1.5v7L16 14" stroke-linejoin="round" />
  </svg>
);

const ICON_YAHOO = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
    <path d="M3 5h4l3 5 3-5h4l-5 8v6h-4v-6L3 5z" />
  </svg>
);

const ICON_DOWNLOAD = (
  <svg
    viewBox="0 0 16 16"
    width="13"
    height="13"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5" />
    <path d="M3 13h10" />
  </svg>
);

export interface CalendarPopoverProps {
  event: CalendarEvent;
  popoverId: string;
  icsHref: string;
  buttonClass?: string;
}

export function CalendarPopover({ event, popoverId, icsHref, buttonClass = "ics-btn" }: CalendarPopoverProps) {
  return (
    <span class="nav-wrap">
      <button
        type="button"
        class={buttonClass}
        data-popover-target={popoverId}
        aria-label="Zum Kalender hinzufügen"
        title="Zum Kalender hinzufügen"
        popovertarget={popoverId}
        aria-haspopup="menu"
      >
        {ICON_CAL}
      </button>
      <div id={popoverId} popover="auto" role="menu" class="nav-popover">
        <a
          role="menuitem"
          class="nav-popover__link"
          href={buildGoogleCalendarUrl(event)}
          target="_blank"
          rel="noopener"
        >
          <span class="nav-popover__icon" aria-hidden="true">
            {ICON_GCAL}
          </span>{" "}
          Google Calendar
        </a>
        <a
          role="menuitem"
          class="nav-popover__link"
          href={buildOutlookCalendarUrl(event)}
          target="_blank"
          rel="noopener"
        >
          <span class="nav-popover__icon" aria-hidden="true">
            {ICON_OUTLOOK}
          </span>{" "}
          Outlook
        </a>
        <a role="menuitem" class="nav-popover__link" href={buildYahooCalendarUrl(event)} target="_blank" rel="noopener">
          <span class="nav-popover__icon" aria-hidden="true">
            {ICON_YAHOO}
          </span>{" "}
          Yahoo
        </a>
        <a role="menuitem" class="nav-popover__link" href={icsHref} download>
          <span class="nav-popover__icon" aria-hidden="true">
            {ICON_DOWNLOAD}
          </span>{" "}
          .ics (Apple, Proton, …)
        </a>
      </div>
    </span>
  );
}

export const POPOVER_POSITIONING_SCRIPT = `
(function(){
  function positionPopover(btn){
    var pop = document.getElementById(btn.getAttribute('data-popover-target') || btn.getAttribute('popovertarget'));
    if (!pop) return;
    var r = btn.getBoundingClientRect();
    var w = pop.offsetWidth || 224;
    var h = pop.offsetHeight || 280;
    var maxLeft = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    var spaceBelow = window.innerHeight - r.bottom;
    var top = (spaceBelow >= h + 12) ? (r.bottom + 4) : Math.max(8, r.top - h - 4);
    pop.style.top = top + 'px';
    pop.style.left = maxLeft + 'px';
    pop.style.right = 'auto';
  }
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-popover-target]');
    if (!btn) return;
    requestAnimationFrame(function(){ positionPopover(btn); });
  });
})();
`.trim();
