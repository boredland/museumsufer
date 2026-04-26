export interface MuseumLocation {
  lat: number;
  lng: number;
}

const RIVER_LAT = 50.107;
const BRIDGE_PENALTY_KM = 0.8;

export const MUSEUM_LOCATIONS: Record<string, MuseumLocation> = {
  "archaeologisches-museum-frankfurt": { lat: 50.1073, lng: 8.6832 },
  "bibelhaus-erlebnismuseum": { lat: 50.1044, lng: 8.6926 },
  "caricatura-museum-frankfurt": { lat: 50.1109, lng: 8.6845 },
  "deutsches-architekturmuseum": { lat: 50.1049, lng: 8.6715 },
  "deutsches-ledermuseum-of": { lat: 50.0984, lng: 8.7587 },
  "deutsches-romantik-museum": { lat: 50.1118, lng: 8.6776 },
  "dff-deutsches-filminstitut-filmmuseum": { lat: 50.1052, lng: 8.6728 },
  "dommuseum-frankfurt": { lat: 50.1114, lng: 8.6855 },
  "eintracht-frankfurt-museum": { lat: 50.0685, lng: 8.6455 },
  "fotografie-forum-frankfurt": { lat: 50.1118, lng: 8.6907 },
  "frankfurter-goethe-haus": { lat: 50.1113, lng: 8.6776 },
  "frankfurter-kunstverein": { lat: 50.1108, lng: 8.6907 },
  "geldmuseum-der-deutschen-bundesbank": { lat: 50.1283, lng: 8.6208 },
  "haus-der-stadtgeschichte-of": { lat: 50.0984, lng: 8.7643 },
  "hindemith-kabinett": { lat: 50.1059, lng: 8.6969 },
  "historisches-museum-frankfurt": { lat: 50.1092, lng: 8.6819 },
  "ikonenmuseum-frankfurt": { lat: 50.1058, lng: 8.6961 },
  "institut-fuer-stadtgeschichte": { lat: 50.1088, lng: 8.6730 },
  "juedisches-museum-frankfurt": { lat: 50.1040, lng: 8.6649 },
  "juedisches-museum-museum-judengasse-frankfurt": { lat: 50.1143, lng: 8.6922 },
  "junges-museum-frankfurt": { lat: 50.1090, lng: 8.6830 },
  "klingspor-museum-of": { lat: 50.0988, lng: 8.7700 },
  "liebieghaus-skulpturensammlung": { lat: 50.0996, lng: 8.6600 },
  "momem-museum-of-modern-electronic-music": { lat: 50.1140, lng: 8.6727 },
  "museum-angewandte-kunst": { lat: 50.1056, lng: 8.6800 },
  "museum-fuer-kommunikation-frankfurt": { lat: 50.1038, lng: 8.6702 },
  "museum-mmk-museum-mmk-fuer-moderne-kunst": { lat: 50.1126, lng: 8.6878 },
  "museum-giersch-der-goethe-universitaet": { lat: 50.0986, lng: 8.6545 },
  "museum-sinclair-haus-bad-homburg": { lat: 50.2267, lng: 8.6124 },
  "portikus": { lat: 50.1077, lng: 8.6891 },
  "porzellan-museum-frankfurt": { lat: 50.0999, lng: 8.5476 },
  "schirn-kunsthalle-frankfurt": { lat: 50.1102, lng: 8.6590 },
  "senckenberg-naturmuseum": { lat: 50.1175, lng: 8.6522 },
  "staedel-museum": { lat: 50.1016, lng: 8.6721 },
  "stoltze-museum": { lat: 50.1110, lng: 8.6846 },
  "struwwelpeter-museum": { lat: 50.1112, lng: 8.6840 },
  "tower-mmk-museum-mmk-fuer-moderne-kunst": { lat: 50.1105, lng: 8.6698 },
  "weltkulturen-museum": { lat: 50.1042, lng: 8.6779 },
  "zollamt-mmk-museum-mmk-fuer-moderne-kunst": { lat: 50.1122, lng: 8.6855 },
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function walkingDistanceKm(userLat: number, userLng: number, museum: MuseumLocation): number {
  const straight = haversineKm(userLat, userLng, museum.lat, museum.lng);
  const userSouth = userLat < RIVER_LAT;
  const museumSouth = museum.lat < RIVER_LAT;
  if (userSouth !== museumSouth) {
    return straight + BRIDGE_PENALTY_KM;
  }
  return straight;
}

export function walkingMinutes(km: number): number {
  return Math.round(km / 5 * 60);
}
