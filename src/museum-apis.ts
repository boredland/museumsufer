export type ApiType = "tribe-events" | "historisches" | "juedisches" | "staedel" | "senckenberg" | "my-calendar";

export interface MuseumApiConfig {
  slug: string;
  type: ApiType;
  endpoint: string;
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
];

export function getApiConfig(slug: string): MuseumApiConfig | undefined {
  return MUSEUM_APIS.find((c) => c.slug === slug);
}
