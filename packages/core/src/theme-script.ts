/**
 * Inline FOUC bootstrap that runs before first paint to apply the user's
 * preferred light/dark theme based on localStorage + the OS preference.
 * Wrap in a <script>...</script> in <head> ahead of stylesheet links.
 *
 * Three apps were each carrying a slightly different copy of this; theaters'
 * try/catch variant wins (private-mode browsers throw on localStorage access).
 */
export const THEME_FOUC_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d))document.documentElement.classList.add('dark');else if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();";
