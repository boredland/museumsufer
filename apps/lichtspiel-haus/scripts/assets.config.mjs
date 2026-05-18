/**
 * Vendor assets for lichtspiel-haus. Consumed by `scripts/sync-assets.mjs` at
 * the repo root.
 *
 * Type system:
 *   Fraunces (variable, opsz + SOFT + WONK) — display / marquee numerals
 *   EB Garamond                              — body
 *   DM Mono                                  — technical badges
 */
export default {
  htmx: true,
  fonts: [
    {
      pkg: "@fontsource-variable/fraunces",
      css: ["full.css", "full-italic.css"],
      subsets: ["latin", "latin-ext"],
      familyAlias: ["Fraunces Variable", "Fraunces"],
    },
    {
      pkg: "@fontsource/eb-garamond",
      css: ["400.css", "500.css", "400-italic.css", "500-italic.css"],
      subsets: ["latin", "latin-ext"],
    },
    {
      pkg: "@fontsource/dm-mono",
      css: ["300.css", "400.css", "500.css", "300-italic.css", "400-italic.css", "500-italic.css"],
      subsets: ["latin", "latin-ext"],
    },
  ],
};
