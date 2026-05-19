import { createImageProxy } from "@museumsufer/core/image-proxy";

const ALLOWED_HOSTS = new Set([
  "cdn.reservix.com",
  "diekomoedie.de",
  "galli-frankfurt.de",
  "internationales-theater.de",
  "landungsbruecken.org",
  "oper-frankfurt.de",
  "sf-6a25.kxcdn.com",
  "stalburg.de",
  "theaterwillypraml.de",
  "volksbuehne.net",
  "www.diedramatischebuehne.de",
  "www.lempenfieber.de",
  "www.neues-theater.de",
  "www.theater-alte-bruecke.de",
  "www.theaterhaus-frankfurt.de",
  "www.kellertheater-frankfurt.de",
]);

export const { handleImageProxy, imageProxyUrl } = createImageProxy({
  userAgent: "frankfurt.ins.theater/1.0 (+https://frankfurt.ins.theater)",
  allowedHosts: ALLOWED_HOSTS,
  passthroughDisallowed: true,
});
