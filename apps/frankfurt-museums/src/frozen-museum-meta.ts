/**
 * Pinned museum metadata that previously came from the museumsufer.de
 * scrape. Captured from the live `scrape-data.ts` bundle on 2026-05-25
 * so the directory survives the museumsufer.de removal.
 *
 * `scraper.ts` uses this as the canonical source for name + description
 * + image_url + museumsufer_url. Per-museum scrapers can still override
 * image_url at runtime.
 */
export interface FrozenMuseumMeta {
  name: string;
  description?: string;
  image_url?: string;
  museumsufer_url?: string;
}

export const FROZEN_MUSEUM_META: Record<string, FrozenMuseumMeta> = {
  "archaeologisches-museum-frankfurt": {
    name: "Archäologisches Museum Frankfurt",
    description:
      "Das Archäologische Museum bewahrt, erforscht, präsentiert und vermittelt die Geschichte Frankfurts von der Altsteinzeit bis zur frühen Neuzeit.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/archaeologisches_museum_aussenansicht_uwe_dettmar_archaeologisches_museum_frankfurt_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/archaeologisches-museum-frankfurt/",
  },
  atelierfrankfurt: {
    name: "Atelierfrankfurt",
    description: "Offene Ateliers und Ausstellungsräume für zeitgenössische Kunst im Ostend.",
    image_url: "https://www.atelierfrankfurt.de/wp-content/uploads/2021/02/Willkommen-im-AF-Link-Preview-1.png",
  },
  "bibelhaus-erlebnismuseum": {
    name: "Bibelhaus ErlebnisMuseum",
    description:
      "Geschichten und Schriften aus dem antiken Orient sind die Blaupause für Religionen, Literatur, Kunst und Kultur von vor über 2000 Jahren bis heute.",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/f/f2/Frankfurt_am_Main%2C_Bibelhaus_ErlebnisMuseum_-_Au%C3%9Fenansicht.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/bibelhaus-erlebnismuseum/",
  },
  "caricatura-museum-frankfurt": {
    name: "Caricatura Museum Frankfurt – Museum für Komische Kunst",
    description: "Es ist eines der schönsten Museen der Welt und hat es faustdick hinter den Mauern.",
    image_url: "https://www.museumsufer.de/media/sliderimages/cmf_aussenaufnahme_copyright_k_schliephake_1_klein.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/caricatura-museum-frankfurt/",
  },
  "deutsches-architekturmuseum": {
    name: "Deutsches Architekturmuseum (DAM)",
    description:
      "Das Deutsche Architekturmuseum (DAM) wurde 1984 als das erste Architekturmuseum in Deutschland eröffnet.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/2_dam_aussenansicht_2019_tag_foto_moritzbernoully_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/deutsches-architekturmuseum/",
  },
  "deutsches-ledermuseum-of": {
    name: "Deutsches Ledermuseum Offenbach am Main",
    description:
      "Die Vielfalt von Leder wird in den Ausstellungen des 1917 gegründeten Deutschen Ledermuseums durch Alltags- wie Luxusobjekte erfahrbar.",
    image_url: "https://www.museumsufer.de/media/sliderimages/dlm_aussenansicht_c_dlm_l._brichta_1040_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/deutsches-ledermuseum-of/",
  },
  "deutsches-romantik-museum": {
    name: "Deutsches Romantik-Museum / Freies Deutsches Hochstift",
    description: "Die Eröffnung des Deutschen Romantik-Museums war am 14. September 2021.",
    image_url: "https://www.museumsufer.de/media/sliderimages/drm_fassade_202_c_fdh_a.p.englert.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/deutsches-romantik-museum/",
  },
  "dff-deutsches-filminstitut-filmmuseum": {
    name: "DFF – Deutsches Filminstitut & Filmmuseum",
    description:
      "Das DFF vereint auf einzigartige Weise Museum, Kino, Archive und Sammlungen, Festivals, Digitalisierungsprojekte, Forschung sowie zahlreiche Bildungsangebote.",
    image_url: "https://www.museumsufer.de/media/sliderimages/fassade_2019_quer_kleiner_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/dff-deutsches-filminstitut-filmmuseum/",
  },
  dialogmuseum: {
    name: "Dialogmuseum",
    description: "Ausstellung im Dunkeln — die Welt mit anderen Sinnen erleben.",
    image_url: "https://dialogmuseum.de/wp-content/uploads/2026/04/Wasserwesen-Banner-Web-Ready.webp",
  },
  "dommuseum-frankfurt": {
    name: "Dommuseum Frankfurt",
    description:
      "Das Dommuseum Frankfurt zeigt kirchliche Schatzkunst, eine reiche Sammlung mittelalterlicher und barocker Messgewänder und bedeutende Exponate.",
    image_url: "https://www.museumsufer.de/media/sliderimages/foto_eingang_axel_schneider_ausschnitt_.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/dommuseum-frankfurt/",
  },
  "eintracht-frankfurt-museum": {
    name: "Eintracht Frankfurt Museum",
    description:
      "Frankfurt: Das ist Goethe, Äppelwoi, Römer, Wolkenkratzer – und die Eintracht. Seit über 120 Jahren elektrisiert der Fußballverein die Stadt.",
    image_url: "https://www.museumsufer.de/media/sliderimages/eingang_eintracht_frankfurt_museum_6_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/eintracht-frankfurt-museum/",
  },
  experiminta: {
    name: "EXPERIMINTA ScienceCenter",
    description: "Interaktive Experimentierstationen zu Naturwissenschaft, Technik und Mathematik.",
    image_url: "https://www.experiminta.de/wp-content/uploads/2025/08/Dauerausstellung-9-350x240.jpeg",
  },
  "fotografie-forum-frankfurt": {
    name: "Fotografie Forum Frankfurt",
    description:
      "Das Fotografie Forum Frankfurt (FFF) gehört zu den führenden eigenständigen Zentren für Fotografie in Europa.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/eingang_fotografie_forum_frankfurt_foto_georg_doerr_www.lumenphoto.de_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/fotografie-forum-frankfurt/",
  },
  "frankfurter-buergerstiftung": {
    name: "Frankfurter Bürgerstiftung im Holzhausenschlösschen",
    description: "Kulturelle Veranstaltungen und Ausstellungen im historischen Holzhausenschlösschen.",
    image_url:
      "https://www.frankfurter-buergerstiftung.de/db/image/text/1120x630/76_holzhausenschloesschen-c-barbara-staubach.jpg",
  },
  "frankfurter-feldbahnmuseum": {
    name: "Frankfurter Feldbahnmuseum",
    description: "Historische Feldbahnen und Schmalspurlokomotiven zum Anfassen und Mitfahren.",
    image_url: "https://www.feldbahn-ffm.de/wp-content/uploads/2021/11/ffm_aktuelles_21-10_20.jpg",
  },
  "frankfurter-goethe-haus": {
    name: "Frankfurter Goethe-Haus / Freies Deutsches Hochstift",
    description: "Das Goethe-Haus zählt zu den bedeutendsten Dichter-Gedenkstätten Deutschlands.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/goethe-haus-fassade_querformat_freies_deutsches_hochstift_frankfurter_goethe-museum_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/frankfurter-goethe-haus/",
  },
  "frankfurter-kunstverein": {
    name: "Frankfurter Kunstverein",
    description:
      "Der Frankfurter Kunstverein ist ein interdisziplinäres Ausstellungshaus für zeitgenössische Kunst und Kultur.",
    image_url: "https://www.museumsufer.de/media/sliderimages/fkv-aussen-norbert_miguletz-quer_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/frankfurter-kunstverein/",
  },
  "geldmuseum-der-deutschen-bundesbank": {
    name: "Geldmuseum der Deutschen Bundesbank",
    description:
      "Das Geldmuseum der Deutschen Bundesbank ist ein einzigartiger Lern- und Erlebnisort zu Bargeld, Buchgeld, Geldpolitik und Geld global.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/geldmuseum_deutsche_bundesbank_foto_walter_vorjohann_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/geldmuseum-der-deutschen-bundesbank/",
  },
  "haus-der-stadtgeschichte-of": {
    name: "Haus der Stadtgeschichte Offenbach am Main",
    description: "Die Präsentation umreißt einen Ausstellungszeitraum von knapp 10.000 Jahren.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/bernardbau_eingang_hds_logo_c_thomas_lemnitzer_2017_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/haus-der-stadtgeschichte-of/",
  },
  "hindemith-kabinett": {
    name: "Hindemith Kabinett im Kuhhirtenturm",
    description:
      "Der Kuhhirtenturm beheimatet eine Erinnerungsstätte für den Komponisten Paul Hindemith, der von 1923 bis 1927 hier lebte.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/kuhhirtenturm_aussen_fondation_hindemith_blonay_ch_foto_mara_monetti_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/hindemith-kabinett/",
  },
  "historisches-museum-frankfurt": {
    name: "Historisches Museum Frankfurt",
    description:
      "Das Historische Museum Frankfurt ist das älteste Museum der Mainmetropole und eines der größten Stadtmuseen Europas.",
    image_url: "https://www.museumsufer.de/media/sliderimages/6_roemer_museum_moritz_bernoully_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/historisches-museum-frankfurt/",
  },
  "ikonenmuseum-frankfurt": {
    name: "Ikonenmuseum Frankfurt",
    description:
      "Das Ikonenmuseum der Stadt Frankfurt am Main präsentiert die Highlights seiner bedeutenden Sammlung in einer völlig neu inszenierten Dauerausstellung.",
    image_url: "https://www.museumsufer.de/media/sliderimages/aussenansicht_nacht.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/ikonenmuseum-frankfurt/",
  },
  "institut-fuer-stadtgeschichte": {
    name: "Institut für Stadtgeschichte",
    description:
      "Das Institut für Stadtgeschichte ist eines der bedeutendsten Kommunalarchive Deutschlands und eine der ältesten Kultureinrichtungen der Stadt.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/aussenansicht_institut_fuer_stadtgeschichte_frankfurt_c_ifs_foto_uwe_dettmar_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/institut-fuer-stadtgeschichte/",
  },
  "juedisches-museum-frankfurt": {
    name: "Jüdisches Museum Frankfurt",
    description:
      "Tauchen Sie ein in die Vielfalt jüdischer Kulturen und erfahren Sie mehr über die bedeutende Geschichte und vielfältige Gegenwart.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/juedisches_museum_neubau_mit_skulptur_von_ariel_schlesinger_untitled_c_norbert_migluetz_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/juedisches-museum-frankfurt/",
  },
  "juedisches-museum-museum-judengasse-frankfurt": {
    name: "Jüdisches Museum / Museum Judengasse Frankfurt",
    description:
      "Inmitten der archäologischen rekonstruierten Ausgrabungen der ehemaligen Judengasse entfaltet die Dauerausstellung ein Panorama jüdischen Alltagslebens.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/museum-judengasse-aussenansicht-eingang_foto_norbert_miguletz_2_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/juedisches-museum-museum-judengasse-frankfurt/",
  },
  "junges-museum-frankfurt": {
    name: "Junges Museum Frankfurt",
    description: "Das Junge Museum ist ein anregender Lernort für alle und bietet Wissen zum Anfassen.",
    image_url: "https://www.museumsufer.de/media/sliderimages/ohne_titel.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/junges-museum-frankfurt/",
  },
  "klingspor-museum-of": {
    name: "Klingspor Museum – Offenbach am Main",
    description:
      "Das Klingspor Museum sammelt zeitgenössische internationale Buch- und Schriftkunst. Seinen Grundstock bildet die Sammlung Karl Klingspors.",
    image_url: "https://www.museumsufer.de/media/sliderimages/blick_auf_die_aussenfassade_2012_c_klingspor_museum.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/klingspor-museum-of/",
  },
  "kunststiftung-dz-bank": {
    name: "Kunststiftung DZ BANK",
    description: "Zeitgenössische Fotokunst und Medienkunst im Herzen Frankfurts.",
    image_url: "https://kunststiftungdzbank.de/wp-content/uploads/2026/02/Cwynar_Scroll-1-Still_akt.jpg",
  },
  "liebieghaus-skulpturensammlung": {
    name: "Liebieghaus Skulpturensammlung",
    description:
      "Das Liebieghaus zählt mit über 3.000 Werken auf rund 1.600 Quadratmetern Ausstellungsfläche zu den international wichtigsten Skulpturenmuseen.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/aussenansicht_foto_liebieghaus_skulpturensammlung_-_norbert_miguletz_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/liebieghaus-skulpturensammlung/",
  },
  "momem-museum-of-modern-electronic-music": {
    name: "MOMEM – Museum of Modern Electronic Music",
    description:
      "Der Verein Friends of MOMEM e.V. hat ein weltweit einzigartiges Kultur- und Musikprojekt ins Leben gerufen.",
    image_url: "https://www.museumsufer.de/media/sliderimages/momem.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/momem-museum-of-modern-electronic-music/",
  },
  "museum-angewandte-kunst": {
    name: "Museum Angewandte Kunst",
    description:
      "Das Museum Angewandte Kunst nimmt eine Position mit Modellcharakter für zeitgemäße Museumskonzepte im 21. Jahrhundert ein.",
    image_url: "https://www.museumsufer.de/media/sliderimages/foto_anja_jahn_c_museum_angewandte_kunst_2014_2_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/museum-angewandte-kunst/",
  },
  "museum-fuer-kommunikation-frankfurt": {
    name: "Museum für Kommunikation Frankfurt",
    description:
      "Im mehrfach preisgekrönten Museumsbau am Schaumainkai erhält das Publikum einen umfassenden Einblick in die Geschichte der Kommunikation.",
    image_url: "https://www.museumsufer.de/media/sliderimages/mfk_aussen_01_c_thomas_gessner_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/museum-fuer-kommunikation-frankfurt/",
  },
  "museum-giersch-der-goethe-universitaet": {
    name: "MGGU – Museum Giersch der Goethe-Universität",
    description:
      "Das MGGU – Museum Giersch der Goethe-Universität: Ein multidisziplinäres Forum für Kunst und Wissenschaft.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/museum_vorderseite_c_museum_giersch_der_goethe-universitaet_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/museum-giersch-der-goethe-universitaet/",
  },
  "museum-mmk-museum-mmk-fuer-moderne-kunst": {
    name: "MUSEUM MMK – MUSEUM MMK FÜR MODERNE KUNST",
    description: "Achtung: Das MUSEUM MMK ist derzeit wegen Brandschutzsanierung geschlossen!",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/museum_mmk_fuer_moderne_kunst_c_foto_fabian_frinzel_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/museum-mmk-museum-mmk-fuer-moderne-kunst/",
  },
  "museum-sinclair-haus-bad-homburg": {
    name: "Museum Sinclair-Haus Bad Homburg",
    description:
      "Das Museum Sinclair-Haus zeigt seit 1982 Wechselausstellungen, in denen die vielschichtigen Verhältnisse des Menschen zur Natur im Mittelpunkt stehen.",
    image_url: "https://www.museumsufer.de/media/sliderimages/museum_sinclair-haus_foto_michael_habes_2_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/museum-sinclair-haus-bad-homburg/",
  },
  portikus: {
    name: "Portikus",
    description: "Der Portikus ist eine bekannte Institution für zeitgenössische Kunst.",
    image_url:
      "https://www.museumsufer.de/media/sliderimages/aussenansicht_portikus_c_diana_pfammatter_slash_portikus_frankfurt_am_main_hochformat_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/portikus/",
  },
  "porzellan-museum-frankfurt": {
    name: "Porzellan Museum Frankfurt",
    description:
      "Das Porzellan Museum Frankfurt zeigt die umfangreichste, öffentlich zugängliche Sammlung von Höchster Fayencen und Porzellanen.",
    image_url: "https://upload.wikimedia.org/wikipedia/commons/c/cf/Kronberger_Haus_H%C3%B6chst.JPG",
    museumsufer_url: "https://www.museumsufer.de/de/museen/porzellan-museum-frankfurt/",
  },
  "schirn-kunsthalle-frankfurt": {
    name: "SCHIRN KUNSTHALLE FRANKFURT",
    description:
      "Die SCHIRN KUNSTHALLE FRANKFURT ist eines der angesehensten und profiliertesten Ausstellungshäuser in Europa.",
    image_url: "https://www.museumsufer.de/media/sliderimages/schirn_in_bockenheim.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/schirn-kunsthalle-frankfurt/",
  },
  "schirn-in-bockenheim": {
    name: "SCHIRN in Bockenheim",
    description: "Satellitenstandort der SCHIRN KUNSTHALLE FRANKFURT im Stadtteil Bockenheim.",
    image_url: "https://www.museumsufer.de/media/sliderimages/schirn_in_bockenheim.jpg",
  },
  "senckenberg-naturmuseum": {
    name: "Senckenberg Naturmuseum",
    description: "Das Senckenberg Naturmuseum ist eines der größten naturhistorischen Museen Europas.",
    image_url: "https://www.museumsufer.de/media/sliderimages/senckenberg_naturmuseum_c_sven_traenkner_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/senckenberg-naturmuseum/",
  },
  "staedel-museum": {
    name: "Städel Museum",
    description:
      "1815 als Stiftung des Bankiers und Kaufmanns Johann Friedrich Städel begründet, gilt das Städel Museum als älteste und renommierteste Museumsstiftung Deutschlands.",
    image_url: "https://www.museumsufer.de/media/sliderimages/st_presse_fassade_2019_6_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/staedel-museum/",
  },
  "stoltze-museum": {
    name: "Stoltze-Museum der Frankfurter Sparkasse",
    description:
      "Das Stoltze-Museum der Frankfurter Sparkasse zu Leben und Werk Friedrich Stoltzes (1816 – 1891) wurde 1978 gegründet.",
    image_url: "https://upload.wikimedia.org/wikipedia/commons/2/27/Frankfurt_am_Main_-_Stoltze-Museum_-_aussen.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/stoltze-museum/",
  },
  "struwwelpeter-museum": {
    name: "Struwwelpeter Museum",
    description: 'In der neuen Altstadt wird die Welt des „Struwwelpeter" und seines Verfassers lebendig.',
    image_url: "https://www.museumsufer.de/media/sliderimages/struwwelpeter_museum_foyer_aussen_uwe_dettmar_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/struwwelpeter-museum/",
  },
  "tower-mmk-museum-mmk-fuer-moderne-kunst": {
    name: "TOWER MMK – MUSEUM MMK FÜR MODERNE KUNST",
    description: "Seit 2014 hat das MUSEUM MMK einen Standort im TaunusTurm.",
    image_url: "https://www.museumsufer.de/media/sliderimages/tower_mmk_foto_thomas_schroeder_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/tower-mmk-museum-mmk-fuer-moderne-kunst/",
  },
  "verkehrsmuseum-frankfurt": {
    name: "Verkehrsmuseum Frankfurt am Main",
    description: "Verkehrsgeschichte mit historischen Straßenbahnen, Bussen und Schienenfahrzeugen.",
    image_url: "https://hsf-ffm.com/wp-content/uploads/2025/10/LinusWambach_23.03.2025-scaled.webp",
  },
  "weltkulturen-museum": {
    name: "Weltkulturen Museum",
    description:
      "Das Weltkulturen Museum, untergebracht in drei Gründerzeitvillen am Museumsufer, ist ein zentraler Ort der interdisziplinären Zusammenarbeit.",
    image_url: "https://www.museumsufer.de/media/sliderimages/weltkulturen_museum_foto_wolfgang_guenzel_web.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/weltkulturen-museum/",
  },
  "wollheim-memorial-frankfurt": {
    name: "Wollheim Memorial",
    description:
      "Mahnmal auf dem Campus Westend zur Erinnerung an die KZ-Häftlinge, die im IG Farben-Werk Buna/Monowitz Zwangsarbeit leisten mussten.",
    image_url: "https://upload.wikimedia.org/wikipedia/commons/4/49/Wollheim_Memorial.jpg",
  },
  "zollamt-mmk-museum-mmk-fuer-moderne-kunst": {
    name: "ZOLLAMT MMK – MUSEUM MMK FÜR MODERNE KUNST",
    description: "Seit 2007 ist das ehemalige Frankfurter Hauptzollamt ein Ausstellungsort des MUSEUM MMK.",
    image_url: "https://www.museumsufer.de/media/sliderimages/zollamt_mmk_c_foto_fabian_frinzel.jpg",
    museumsufer_url: "https://www.museumsufer.de/de/museen/zollamt-mmk-museum-mmk-fuer-moderne-kunst/",
  },
};
