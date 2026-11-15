/**
 * Wires the `data-loading="true"` body attribute on the body element while
 * htmx requests are in flight. Pair with a top-of-viewport `.htmx-progress`
 * bar styled via `[data-loading] .htmx-progress { animation: ... }` so date
 * swaps don't feel inert while the network is in flight.
 *
 * Also adds the page's language to every htmx GET that doesn't name one. The
 * strip and pill links are written as `/partial/content?date=...`; without a
 * `lang`, the server falls back to Accept-Language, so a Spanish page opened
 * with ?lang=es swapped in German (or English) dates for a German (or English)
 * browser. `<html lang>` is the locale every app renders the page in.
 *
 * Use as an inline <script> body. Safe to concatenate with other inline JS.
 */
export const HTMX_LIFECYCLE_SCRIPT = `
(function(){
  document.body.addEventListener('htmx:beforeRequest', function(){ document.body.dataset.loading = 'true'; });
  document.body.addEventListener('htmx:afterRequest', function(){ delete document.body.dataset.loading; });
  document.body.addEventListener('htmx:configRequest', function(e){
    var d = e.detail, lang = document.documentElement.lang;
    if (!lang || d.verb !== 'get' || /[?&]lang=/.test(d.path)) return;
    d.parameters['lang'] = lang;
  });
})();
`.trim();
