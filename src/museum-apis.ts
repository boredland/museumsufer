export type ApiType =
  | "tribe-events"
  | "historisches"
  | "juedisches"
  | "staedel"
  | "senckenberg"
  | "my-calendar"
  | "liebieghaus"
  | "mak"
  | "stadtgeschichte-rss"
  | "dommuseum"
  | "junges-museum"
  | "ledermuseum"
  | "bibelhaus"
  | "fkv"
  | "fdh";

export interface MuseumApiConfig {
  slug: string;
  type: ApiType;
  endpoint: string;
  proxy?: true;
}

export interface ProxyConfig {
  url: string;
  token?: string;
}

export const MUSEUM_APIS: MuseumApiConfig[] = [
  {
    slug: "historisches-museum-frankfurt",
    type: "historisches",
    endpoint: "https://historisches-museum-frankfurt.de/api/calendar",
  },
  {
    slug: "juedisches-museum-frankfurt",
    type: "juedisches",
    endpoint: "https://www.juedischesmuseum.de/besuch/feed.json?records%5BL%5D=0&records%5Buid%5D=329",
  },
  {
    slug: "staedel-museum",
    type: "staedel",
    endpoint: "https://www.staedelmuseum.de/de/api/finder",
  },
  {
    slug: "deutsches-architekturmuseum",
    type: "tribe-events",
    endpoint: "https://dam-online.de/wp-json/tribe/events/v1/events",
  },
  {
    slug: "dff-deutsches-filminstitut-filmmuseum",
    type: "tribe-events",
    endpoint: "https://www.dff.film/wp-json/tribe/events/v1/events",
  },
  {
    slug: "senckenberg-naturmuseum",
    type: "senckenberg",
    endpoint: "https://museumfrankfurt.senckenberg.de/wp-json/wp/v2/events?per_page=100",
  },
  {
    slug: "museum-fuer-kommunikation-frankfurt",
    type: "my-calendar",
    endpoint: "https://www.mfk-frankfurt.de/wp-json/my-calendar/v1/events",
  },
  {
    slug: "liebieghaus-skulpturensammlung",
    type: "liebieghaus",
    endpoint: "https://www.liebieghaus.de/de/kalender",
  },
  {
    slug: "museum-angewandte-kunst",
    type: "mak",
    endpoint: "https://www.museumangewandtekunst.de/de/kalender/",
  },
  {
    slug: "institut-fuer-stadtgeschichte",
    type: "stadtgeschichte-rss",
    endpoint: "https://www.stadtgeschichte-ffm.de/rss/isg_rss.php?L=de",
  },
  {
    slug: "dommuseum-frankfurt",
    type: "dommuseum",
    endpoint: "https://dommuseum-frankfurt.de/besuchen/kalender",
  },
  {
    slug: "junges-museum-frankfurt",
    type: "junges-museum",
    endpoint: "https://junges-museum-frankfurt.de/kalender",
  },
  {
    slug: "deutsches-ledermuseum-of",
    type: "ledermuseum",
    endpoint: "https://www.ledermuseum.de/programm",
  },
  {
    slug: "bibelhaus-erlebnismuseum",
    type: "bibelhaus",
    endpoint: "https://www.bibelhaus-frankfurt.de/de/programm",
    proxy: true,
  },
  {
    slug: "frankfurter-kunstverein",
    type: "fkv",
    endpoint: "https://www.fkv.de/current-events/",
  },
  {
    slug: "deutsches-romantik-museum",
    type: "fdh",
    endpoint: "https://deutsches-romantik-museum.de/programm/",
  },
  {
    slug: "frankfurter-goethe-haus",
    type: "fdh",
    endpoint: "https://www.goethehaus-frankfurt.de/programm/",
  },
];

export function getApiConfig(slug: string): MuseumApiConfig | undefined {
  return MUSEUM_APIS.find((c) => c.slug === slug);
}
