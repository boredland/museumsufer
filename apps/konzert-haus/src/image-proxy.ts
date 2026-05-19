import { createImageProxy } from "@museumsufer/core/image-proxy";

const ALLOWED_HOSTS = new Set([
  "oper-frankfurt.de",
  "www.alteoper.de",
  "www.brotfabrik.de",
  "www.ensemble-modern.com",
  "www.frankfurter-buergerstiftung.de",
  "www.hfmdk-frankfurt.de",
  "www.hr-bigband.de",
  "www.hr-sinfonieorchester.de",
  "www.jazz-frankfurt.de",
  "www.palmengarten.de",
  "www.rheingau-musik-festival.de",
  "www.romanfabrik.de",
]);

export const { handleImageProxy, imageProxyUrl } = createImageProxy({
  userAgent: "konzert.haus/1.0 (+https://frankfurt.konzert.haus)",
  allowedHosts: ALLOWED_HOSTS,
  passthroughDisallowed: true,
});
