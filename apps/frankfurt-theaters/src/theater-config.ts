import type { TicketingProvider } from "./types";

export interface TheaterConfig {
  slug: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  website_url: string;
  ticketing_provider: TicketingProvider;
  scraper: "schauspiel" | "oper" | "english-theatre";
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
  },
  {
    slug: "oper-frankfurt",
    name: "Oper Frankfurt",
    address: "Untermainanlage 11, 60311 Frankfurt am Main",
    lat: 50.1077,
    lon: 8.6726,
    website_url: "https://oper-frankfurt.de",
    ticketing_provider: "eventim_inhouse",
    scraper: "oper",
  },
  {
    slug: "english-theatre-frankfurt",
    name: "The English Theatre Frankfurt",
    address: "Gallusanlage 7, 60329 Frankfurt am Main",
    lat: 50.1083,
    lon: 8.6712,
    website_url: "https://english-theatre.de",
    ticketing_provider: "eventim_inhouse",
    scraper: "english-theatre",
  },
];
