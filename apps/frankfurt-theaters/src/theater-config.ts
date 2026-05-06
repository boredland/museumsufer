import type { TicketingProvider } from "./types";

export interface TheaterConfig {
  slug: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  website_url: string;
  ticketing_provider: TicketingProvider;
  scraper: "schauspiel";
  /** Eventim Inhouse host for the live availability enricher, if applicable. */
  eventim_inhouse_host?: string;
}

export const THEATERS: TheaterConfig[] = [
  {
    slug: "schauspiel-frankfurt",
    name: "Schauspiel Frankfurt",
    address: "Neue Mainzer Straße 17, 60311 Frankfurt am Main",
    lat: 50.1078,
    lon: 8.6745,
    website_url: "https://www.schauspielfrankfurt.de",
    ticketing_provider: "eventim_inhouse",
    scraper: "schauspiel",
    eventim_inhouse_host: "schauspielfrankfurt.eventim-inhouse.de",
  },
];
