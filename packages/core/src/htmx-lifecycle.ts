/**
 * Wires the `data-loading="true"` body attribute on the body element while
 * htmx requests are in flight. Pair with a top-of-viewport `.htmx-progress`
 * bar styled via `[data-loading] .htmx-progress { animation: ... }` so date
 * swaps don't feel inert while the network is in flight.
 *
 * Use as an inline <script> body. Safe to concatenate with other inline JS.
 */
export const HTMX_LIFECYCLE_SCRIPT = `
(function(){
  document.body.addEventListener('htmx:beforeRequest', function(){ document.body.dataset.loading = 'true'; });
  document.body.addEventListener('htmx:afterRequest', function(){ delete document.body.dataset.loading; });
})();
`.trim();
