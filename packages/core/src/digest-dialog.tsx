/**
 * Shared "Push-Digest" subscription dialog. Each app's footer + push-cue
 * button trigger it via [data-digest-open]; the form posts to
 * /api/push/subscribe (VAPID, anonymous).
 *
 * Three schedule choices are universal across apps (morning / afternoon /
 * Sunday). The optional filter-chip list is the per-app variation point —
 * museums passes museum slugs, theaters theatre slugs, konzert genre slugs,
 * landau category slugs.
 */
export interface DigestSchedule {
  /** Value submitted: e.g. "morning", "afternoon", "weekly". */
  value: string;
  /** Localised label, e.g. "Jeden Morgen". */
  label: string;
  /** Right-aligned time hint, e.g. "07:00" or "So 09:00". */
  time: string;
  /** Sub-line beneath the label. */
  desc?: string;
}

export interface DigestFilterChip {
  /** Value sent on the form. */
  value: string;
  /** Display label. */
  label: string;
  /** Optional dot colour shown before the label (e.g. genre swatch). */
  dotColor?: string;
}

export interface DigestDialogTr {
  title: string;
  close: string;
  intro?: string;
  filterLabel?: string;
  filterHint?: string;
  iosHint?: string;
  unsupported?: string;
  submit: string;
  unsubAll?: string;
}

export interface DigestDialogProps {
  tr: DigestDialogTr;
  /** Schedule rows shown in the body — typically 3 rows. */
  schedules: DigestSchedule[];
  /** Optional filter-chip list to scope notifications. */
  filterChips?: DigestFilterChip[];
  /** Optional filter input `name` — defaults to "filter". */
  filterName?: string;
}

export function DigestDialog({ tr, schedules, filterChips, filterName = "filter" }: DigestDialogProps) {
  return (
    <dialog id="digest-dialog" class="dialog">
      <form id="digest-form" class="dialog__form">
        <div class="dialog__head">
          <h2 class="dialog__title">{tr.title}</h2>
          <button type="button" data-digest-close aria-label={tr.close} class="dialog__close">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          </button>
        </div>

        {tr.intro ? <p class="dialog__intro">{tr.intro}</p> : null}

        <fieldset class="digest-options" aria-label={tr.title}>
          {schedules.map((s) => (
            <label key={s.value} class="digest-option">
              <input type="checkbox" name="schedule" value={s.value} class="digest-option__radio" />
              <span class="digest-option__label">
                <span class="digest-option__name">{s.label}</span>
                <span class="digest-option__time">{s.time}</span>
              </span>
              {s.desc ? <span class="digest-option__desc">{s.desc}</span> : null}
            </label>
          ))}
        </fieldset>

        {filterChips && filterChips.length > 0 ? (
          <details class="digest-filter">
            <summary class="digest-filter__summary">
              <span class="digest-filter__label">
                <span class="digest-filter__caret">▸</span>
                {tr.filterLabel}
              </span>
              {tr.filterHint ? <span class="digest-filter__hint">{tr.filterHint}</span> : null}
            </summary>
            <fieldset class="digest-filter__list" aria-label={tr.filterLabel}>
              {filterChips.map((c) => (
                <label key={c.value} class="digest-filter__chip">
                  <input type="checkbox" name={filterName} value={c.value} class="digest-filter__chip-input" />
                  {c.dotColor ? <span class="digest-filter__chip-dot" style={`background:${c.dotColor}`} /> : null}
                  <span>{c.label}</span>
                </label>
              ))}
            </fieldset>
          </details>
        ) : null}

        {tr.iosHint ? (
          <div id="digest-ios-hint" hidden class="dialog__hint" dangerouslySetInnerHTML={{ __html: tr.iosHint }} />
        ) : null}

        {tr.unsupported ? (
          <div id="digest-unsupported" hidden class="dialog__error">
            {tr.unsupported}
          </div>
        ) : null}

        <div class="dialog__footer">
          <p id="digest-status" hidden class="dialog__status" aria-live="polite" />
          {tr.unsubAll ? (
            <button type="button" id="digest-unsubscribe-all" hidden class="btn-link">
              {tr.unsubAll}
            </button>
          ) : null}
          <button type="submit" id="digest-submit" class="btn-primary">
            {tr.submit}
          </button>
        </div>
      </form>
    </dialog>
  );
}
