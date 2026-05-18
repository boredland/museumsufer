/**
 * Inline FOUC bootstrap that runs before first paint to apply the user's
 * preferred light/dark theme based on localStorage + the OS preference.
 * Wrap in a <script>...</script> in <head> ahead of stylesheet links.
 *
 * Also wires the click handler for [data-theme-toggle] / #theme-toggle on
 * DOMContentLoaded so every page (not just the home view that ships the
 * full ClientBehaviors bundle) can flip themes. Guarded with
 * window.__themeToggleWired so a second call from an app's main client
 * script is a no-op.
 */
export const THEME_FOUC_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d))document.documentElement.classList.add('dark');else if(t==='light')document.documentElement.classList.add('light');}catch(e){}function wire(){if(window.__themeToggleWired)return;var b=document.querySelector('[data-theme-toggle]')||document.getElementById('theme-toggle');if(!b)return;window.__themeToggleWired=true;b.addEventListener('click',function(){var h=document.documentElement;var dk=h.classList.contains('dark')||(!h.classList.contains('light')&&window.matchMedia('(prefers-color-scheme: dark)').matches);h.classList.toggle('dark',!dk);h.classList.toggle('light',dk);try{localStorage.setItem('theme',dk?'light':'dark');}catch(e){}});}if(document.readyState!=='loading')wire();else document.addEventListener('DOMContentLoaded',wire);})();";
