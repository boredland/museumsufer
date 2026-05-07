/**
 * Standard security headers shared by museums and theaters. Both apps' index.tsx
 * had near-identical middlewares; this collapses them to one factory.
 *
 * The CSP and Permissions-Policy are opt-in because museums currently ships
 * them but theaters does not (and a strict CSP would silently break theaters'
 * inline scripts and Formspree fallback). Keep the API surface minimal:
 * default = the four always-on headers; pass `csp` / `permissionsPolicy` to
 * add them.
 *
 * Returned as a Hono-compatible middleware. We avoid importing Hono's
 * MiddlewareHandler type so this module stays peer-dep-light — the function
 * signature is structurally compatible with `app.use("*", …)`.
 */
export interface SecurityHeadersOptions {
  /** Content-Security-Policy value. If omitted, no CSP header is set. */
  csp?: string;
  /** Permissions-Policy value. If omitted, no header is set. */
  permissionsPolicy?: string;
  /** Override the default HSTS max-age. */
  hstsMaxAge?: number;
}

interface MinimalHonoContext {
  header(name: string, value: string): void;
}

export function securityHeaders(opts: SecurityHeadersOptions = {}) {
  const hstsMaxAge = opts.hstsMaxAge ?? 31536000;
  return async (c: MinimalHonoContext, next: () => Promise<void>) => {
    await next();
    c.header("Strict-Transport-Security", `max-age=${hstsMaxAge}; includeSubDomains; preload`);
    c.header("X-Frame-Options", "DENY");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    if (opts.permissionsPolicy) c.header("Permissions-Policy", opts.permissionsPolicy);
    if (opts.csp) c.header("Content-Security-Policy", opts.csp);
  };
}
