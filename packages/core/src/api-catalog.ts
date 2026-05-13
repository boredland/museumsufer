/**
 * `/.well-known/api-catalog` linkset body — points at the OpenAPI spec,
 * the Scalar-rendered docs, and the primary status endpoint.
 */
export interface ApiCatalogOptions {
  apiBase: string;
  /** Path of the OpenAPI JSON (defaults to `/api/docs/openapi.json`). */
  openapiPath?: string;
  /** Path of the Scalar-rendered HTML docs (defaults to `/api/docs`). */
  docsPath?: string;
  /** Path of the canonical status endpoint (defaults to `/api/day`). */
  statusPath?: string;
}

export function buildApiCatalog(opts: ApiCatalogOptions): string {
  const openapi = opts.openapiPath ?? "/api/docs/openapi.json";
  const docs = opts.docsPath ?? "/api/docs";
  const status = opts.statusPath ?? "/api/day";
  return JSON.stringify({
    linkset: [
      {
        anchor: `${opts.apiBase}/api/`,
        "service-desc": [{ href: `${opts.apiBase}${openapi}`, type: "application/openapi+json" }],
        "service-doc": [{ href: `${opts.apiBase}${docs}`, type: "text/html" }],
        status: [{ href: `${opts.apiBase}${status}`, type: "application/json" }],
      },
    ],
  });
}
