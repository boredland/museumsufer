/**
 * Cloudflare Turnstile server-side verification.
 *
 * Pass the token from the form (field name `cf-turnstile-response`) and the
 * secret from a Worker secret binding. Returns true if the token is valid for
 * this site. Use Cloudflare's well-known test keys during local development:
 *
 *   Site key (always passes):   1x00000000000000000000AA
 *   Secret key (always passes): 1x0000000000000000000000000000000AA
 *
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Inline JS snippet that lazy-injects the Turnstile widget script only
 * when the user actually opens a form gated by Turnstile. Loading the
 * script eagerly costs ~6 audits in Lighthouse (deprecations,
 * legacy-javascript, dom-size, bf-cache, errors-in-console,
 * uses-long-cache-ttl) — all caused by Turnstile's bundle, none by our
 * code. Lazy loading clears every one.
 *
 * Usage: drop this snippet into your inline client-script blob; call
 * `window.__loadTurnstile()` right before showing the gated dialog.
 * Turnstile auto-scans for `.cf-turnstile` elements once the script
 * resolves, so the widget materialises inside the dialog without
 * further wiring.
 */
export const TURNSTILE_LAZY_LOAD_SCRIPT = `
window.__loadTurnstile = (function(){
  var loading = false;
  return function(){
    if (loading || window.turnstile) return;
    loading = true;
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  };
})();
`.trim();

export interface TurnstileVerifyResult {
  success: boolean;
  errorCodes?: string[];
  hostname?: string;
  challengeTs?: string;
  action?: string;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  secret: string,
  remoteIp?: string | null,
): Promise<TurnstileVerifyResult> {
  if (!token) return { success: false, errorCodes: ["missing-input-response"] };

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteIp) body.append("remoteip", remoteIp);

  const res = await fetch(VERIFY_URL, { method: "POST", body });
  if (!res.ok) return { success: false, errorCodes: [`http-${res.status}`] };

  const data = (await res.json()) as {
    success: boolean;
    "error-codes"?: string[];
    hostname?: string;
    challenge_ts?: string;
    action?: string;
  };
  return {
    success: data.success === true,
    errorCodes: data["error-codes"],
    hostname: data.hostname,
    challengeTs: data.challenge_ts,
    action: data.action,
  };
}
