/**
 * Shared theme toggle. Renders a single button with a sun/moon SVG that
 * flips between modes; THEME_FOUC_SCRIPT (loaded inline in each app's
 * <head>) wires the click handler and reads the current value from
 * localStorage. The button must keep id="theme-toggle" for the script
 * to find it.
 *
 * Styling lives in each app's stylesheet — class hooks: .theme-toggle,
 * .theme-toggle__icon, .theme-toggle__sun, .theme-toggle__moon.
 */
export interface ThemeToggleProps {
  /** Localised "switch theme" hover/aria label. */
  label: string;
}

export function ThemeToggle({ label }: ThemeToggleProps) {
  // Emits both id="theme-toggle" and data-theme-toggle so both existing
  // client-script wiring patterns (getElementById vs. querySelector) keep
  // working without per-app changes.
  return (
    <button type="button" id="theme-toggle" data-theme-toggle class="theme-toggle" title={label} aria-label={label}>
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="theme-toggle__icon"
        aria-hidden="true"
      >
        <path
          class="theme-toggle__moon"
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
          fill="currentColor"
          stroke="none"
        />
        <circle class="theme-toggle__sun" cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
        <path
          class="theme-toggle__sun"
          d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          stroke="currentColor"
        />
      </svg>
    </button>
  );
}
