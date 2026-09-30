export type Rtti = "R" | "T1" | "T2" | "I";

export type Leerweg = "BB" | "KB" | "GT";
export type VraagType =
  | "meerkeuze"
  | "juist-onjuist"
  | "open"
  | "invul"
  | "berekening"
  | "bronvraag";

export type KwaliteitOordeel = "voldoet" | "aandacht" | "ontbreekt" | "let op";
export type ToetsVersie = "A" | "B";
export type Moeilijkheid = "makkelijk" | "normaal" | "moeilijk";
export type CijferModel = "lineair" | "gebroken" | "exponentieel";

/** Vakprofiel voor figuur/bron-heuristieken (NaSk e.d.). */
export type VakProfiel = "nask" | "biologie" | "generiek";

/** Eenvoudige school-lijnfiguren (geen boekillustratie). */
export type SchemaFiguurSoort = "circuit" | "krachten" | "blokken";

/** GHS-gevarensymbool, zelf getekend (geen boekplaatje). */
export type GhsSymbool =
  | "ontvlambaar"
  | "giftig"
  | "bijtend"
  | "milieu"
  | "schadelijk"
  | "explosief"
  | "oxiderend"
  | "gas-onder-druk"
  | "gezondheidsgevaar"
  // Veiligheidsborden (NEN-EN-ISO 7010), ook zelf getekend.
  | "gebod-gehoorbescherming"
  | "gebod-oogbescherming"
  | "gebod-handschoenen"
  | "gebod-veiligheidsschoenen"
  | "gebod-stofmasker"
  | "gebod-helm"
  | "waarschuwing-algemeen"
  | "waarschuwing-elektriciteit"
  | "waarschuwing-heet"
  | "verbod-roken"
  | "verbod-open-vuur";

export const GHS_SYMBOLEN: GhsSymbool[] = [
  "ontvlambaar",
  "giftig",
  "bijtend",
  "milieu",
  "schadelijk",
  "explosief",
  "oxiderend",
  "gas-onder-druk",
  "gezondheidsgevaar",
  "gebod-gehoorbescherming",
  "gebod-oogbescherming",
  "gebod-handschoenen",
  "gebod-veiligheidsschoenen",
  "gebod-stofmasker",
  "gebod-helm",
  "waarschuwing-algemeen",
  "waarschuwing-elektriciteit",
  "waarschuwing-heet",
  "verbod-roken",
  "verbod-open-vuur",
];

/** Veiligheidsbord (gebod/waarschuwing/verbod) in plaats van een GHS-gevarensymbool. */
export function isVeiligheidsbord(s: GhsSymbool | string | undefined): boolean {
  return /^(gebod|waarschuwing|verbod)-/.test(s ?? "");
}

export const PICTOGRAM_NAAM: Record<GhsSymbool, string> = {
  ontvlambaar: "GHS02 ontvlambaar (vlam)",
  giftig: "GHS06 giftig (doodshoofd met gekruiste botten)",
  bijtend: "GHS05 bijtend (vloeistof uit twee buisjes op een hand en een plaat)",
  milieu: "GHS09 milieugevaarlijk (dode boom en dode vis)",
  schadelijk: "GHS07 schadelijk/irriterend (uitroepteken)",
  explosief: "GHS01 explosief (ontploffende bom)",
  oxiderend: "GHS03 oxiderend (vlam boven een cirkel)",
  "gas-onder-druk": "GHS04 gas onder druk (gasfles)",
  gezondheidsgevaar: "GHS08 gezondheidsgevaar (silhouet van een persoon met een sterretje op de borst)",
  "gebod-gehoorbescherming": "gebodsbord gehoorbescherming verplicht (blauwe cirkel, hoofd met oorkappen)",
  "gebod-oogbescherming": "gebodsbord oogbescherming verplicht (blauwe cirkel, hoofd met veiligheidsbril)",
  "gebod-handschoenen": "gebodsbord handschoenen verplicht (blauwe cirkel, handschoen)",
  "gebod-veiligheidsschoenen": "gebodsbord veiligheidsschoenen verplicht (blauwe cirkel, schoen)",
  "gebod-stofmasker": "gebodsbord stofmasker verplicht (blauwe cirkel, hoofd met mondkapje)",
  "gebod-helm": "gebodsbord veiligheidshelm verplicht (blauwe cirkel, hoofd met helm)",
  "waarschuwing-algemeen": "waarschuwingsbord algemeen gevaar (gele driehoek, uitroepteken)",
  "waarschuwing-elektriciteit": "waarschuwingsbord elektrische spanning (gele driehoek, bliksempijl)",
  "waarschuwing-heet": "waarschuwingsbord heet oppervlak (gele driehoek, warmtegolfjes boven een oppervlak)",
  "verbod-roken": "verbodsbord roken verboden (rode cirkel met streep, sigaret)",
  "verbod-open-vuur": "verbodsbord open vuur verboden (rode cirkel met streep, lucifer met vlam)",
};

export interface RttiVerdeling {
  R: number;
  T1: number;
  T2: number;
  I: number;
}

export interface CijferNorm {
  model: CijferModel;
  cesuurPct: number;
  exponent: number;
}

export interface ToetsMeta {
  titel: string;
  vak: string;
  leerweg: Leerweg;
  leerjaar: 1 | 2 | 3 | 4;
  duurMinuten: number;
  school: string;
  hulpmiddelen: string[];
  instructies: string[];
  onderwerp: string;
  versie: ToetsVersie;
  moeilijkheid: Moeilijkheid;
  /**
   * Extra tijd op het voorblad (bijv. "20%" of "Ja").
   * Leeg/undefined = invullijn op het Word-voorblad (niet hard "Ja").
   */
  extraTijd?: string;
}

export interface VraagOptie {
  letter: string;
  tekst: string;
}

/** Meet-/bron tabel in de leerlingtoets. */
export interface VraagTabel {
  koppen: string[];
  rijen: string[][];
}

/** Eenvoudige x/y-grafiek (B&W-vriendelijk SVG → Word-PNG). */
export interface VraagGrafiek {
  titel?: string;
  xLabel: string;
  yLabel: string;
  punten: { x: number; y: number }[];
}

/** Schema/lijnfiguur: circuit, krachten of blokken. */
export interface SchemaFiguur {
  soort: SchemaFiguurSoort;
  titel?: string;
  /** Optionele labels bij onderdelen (max ~4). */
  labels?: string[];
}

/** Maatcilinder om standen af te lezen (onderdompelmethode). */
export interface MaatcilinderFiguur {
  titel?: string;
  /** Schaalmaximum in mL. */
  maxMl: number;
  standen: { label: string; ml: number }[];
}

export interface Vraag {
  nummer: number;
  type: VraagType;
  rtti: Rtti;
  domein: string;
  leerdoel: string;
  punten: number;
  /** Optionele situatieschets/inleiding; wordt vóór de stam getoond (Cito-volgorde). */
  context?: string;
  /** Vraagtekst: bij lege context eerst inleiding, daarna vraagzin — nooit omgekeerd. */
  stam: string;
  opties?: VraagOptie[];
  /** Tabel ná de stam. Een invultabel is het antwoordgebied. */
  tabel?: VraagTabel;
  /** Optionele bron-grafiek (na context, vóór stam). */
  grafiek?: VraagGrafiek;
  /** Optioneel eenvoudig schema (circuit/krachten/blokken). */
  schemaFiguur?: SchemaFiguur;
  /** GHS-pictogram bij een gevarensymboolvraag. De stam beschrijft het symbool niet. */
  pictogram?: GhsSymbool;
  /** Maatcilinderfiguur (aflezen), geen tabel. */
  maatcilinder?: MaatcilinderFiguur;
  /**
   * Goedgekeurde, bevroren figuur (alleen na een "go" van de beeldkeuring).
   * Wordt na plaatsing nooit meer gewijzigd; zie figuren/bevriezing.ts.
   */
  figuur?: GoedgekeurdeFiguur;
  /** Verwijzing naar een bevroren figuur (voor rondes via het model, zonder beelddata). */
  figuurId?: string;
  /** Id van een figuur die de docent bij deze vraag heeft verwijderd (wordt nooit teruggezet). */
  figuurVerwijderd?: string;
}

/** Soorten figuren in de beeldpijplijn. Alles behalve "sfeerplaat" tekent de code zelf (SVG → PNG). */
export type FiguurSoort =
  | "lijngrafiek"
  | "staafdiagram"
  | "spreidingsdiagram"
  | "stroomkring"
  | "katrol"
  | "hefboom"
  | "krachtenschema"
  | "blokschema"
  | "pictogram"
  | "maatcilinder"
  | "sfeerplaat";

/** JSON-waarde (serialiseerbaar over serverfuncties). */
export type JsonWaarde = string | number | boolean | null | JsonWaarde[] | { [k: string]: JsonWaarde };

/** Gestructureerde figuurspecificatie die het model eerst schrijft (vóór er iets getekend wordt). */
export type PlaatjesModus = "auto" | "met" | "zonder";

export interface FiguurSpec {
  soort: FiguurSoort;
  titel?: string;
  /** Wat de figuur moet laten zien en waarom de vraag hem nodig heeft. */
  doel: string;
  verplichteElementen: string[];
  labels: string[];
  getallen: { label: string; waarde: number; eenheid?: string }[];
  eenheden: string[];
  /** Wat NIET in beeld mag (zodat het antwoord niet wordt weggegeven). */
  nietTonen: string[];
  /** Tekendata per soort (zie figuren/spec.ts). */
  data: { [k: string]: JsonWaarde };
}

export interface FiguurKeuring {
  besluit: "go";
  redenen: string[];
  model: string;
  tijdstip: string;
  /** Gezet als de figuur ongewijzigd uit de gedeelde figuurbank komt. */
  bank?: { sleutel: string; figuurHash: string; datum: string };
}

/** Een figuur die door de go/no-go-keuring is gekomen. Bevroren en gehasht. */
export interface GoedgekeurdeFiguur {
  id: string;
  soort: FiguurSoort;
  bron: "code" | "ai";
  mime: "image/png" | "image/jpeg";
  /** Base64 van precies de bytes die de keuring heeft gezien. */
  data: string;
  breedte: number;
  hoogte: number;
  alt: string;
  spec: FiguurSpec;
  pogingen: number;
  keuring: FiguurKeuring;
  /** sha256 over id/soort/bron/mime/data/maten/spec/keuring. */
  hash: string;
}

export type FiguurStatus = "go" | "gedropt";

export interface FiguurRapportItem {
  /** Vraagnummer op het moment van de keuring. */
  nummer: number;
  soort: FiguurSoort;
  bron: "code" | "ai";
  status: FiguurStatus;
  pogingen: number;
  redenen: string[];
  /** Wat er met de vraag gebeurde als de figuur is gedropt. */
  fallback?: "herschreven" | "vervangen" | "tabel" | "tekst" | "geen-figuur" | "verwijderd";
  figuurId?: string;
  /** Figuur kwam direct uit de gedeelde figuurbank (geen nieuwe generatie/keuring nodig). */
  uitBank?: boolean;
  /** ISO-tijd waarop de docent deze (goedgekeurde) figuur heeft verwijderd. */
  docentVerwijderd?: string;
}

export interface FiguurRapport {
  versie: 1;
  items: FiguurRapportItem[];
  /** Algemene meldingen (bijv. planner niet bereikbaar). */
  meldingen: string[];
  /** Docent koos "Zonder plaatjes": de pijplijn is overgeslagen. */
  zonderPlaatjes?: boolean;
  /** Gemeten doorlooptijden (ms) van de laatste generatie. */
  tijden?: { vragenMs?: number; afwerkenMs?: number; figurenMs?: number; totaalMs?: number };
}

export interface PuntenCriterium {
  punt: number;
  criterium: string;
}

export interface NakijkItem {
  nummer: number;
  modelantwoord: string;
  puntenverdeling: PuntenCriterium[];
  nietToekennen?: string[];
}

export interface MatrijsCel {
  vraagnummers: number[];
  punten: number;
}

export interface Toetsmatrijs {
  domeinen: string[];
  cellen: Record<string, Record<Rtti, MatrijsCel>>;
  totalen: Record<Rtti, { punten: number; percentage: number }>;
  doelverdeling: RttiVerdeling;
}

export interface Kwaliteitspunt {
  criterium: string;
  oordeel: KwaliteitOordeel;
  toelichting: string;
}

export interface Kwaliteitscheck {
  samenvatting: string;
  punten: Kwaliteitspunt[];
}

export interface Cesuur {
  nTerm: number;
  cesuurPunten: number;
  toelichting: string;
  formule: string;
}

export interface GegenereerdeToets {
  id: string;
  createdAt: string;
  bronmateriaal: string;
  extraEisen: string;
  ronde: number;
  parentId?: string;
  feedback?: string;
  cijferNorm: CijferNorm;
  meta: ToetsMeta;
  vragen: Vraag[];
  nakijkmodel: NakijkItem[];
  cesuur: Cesuur;
  matrijs: Toetsmatrijs;
  kwaliteit: Kwaliteitscheck;
  soort?: "toets" | "matrijs";
  feedbackGewenst?: boolean;
  /**
   * Gezet zodra de beeldpijplijn heeft gedraaid. Vanaf dan tonen blad en Word
   * alleen goedgekeurde figuren (vraag.figuur), nooit ongekeurde oude figuurvelden.
   */
  figuurPijplijn?: 1;
  figuurRapport?: FiguurRapport;
  /** false = docent koos "Zonder plaatjes" (geen figuren, ook niet in latere rondes). */
  metPlaatjes?: boolean;
  /** Plaatjeskeuze: automatisch (standaard), met (verplicht figuren) of zonder. */
  plaatjes?: PlaatjesModus;
  /** Verplichte inhoudscontrole (berekend): wat gevonden, gerepareerd of vervangen is. */
  controle?: ControleLog;
}

export interface ControleBevinding {
  nummer: number;
  code: string;
  uitleg: string;
}

export interface ControleLog {
  /** Aantal vragen dat onafhankelijk is nagerekend (0 = controle niet gelukt). */
  gecontroleerd: number;
  gevonden: ControleBevinding[];
  /** Vragen die na reparatie of vervanging schoon zijn. */
  opgelost: number[];
  vervangen: number[];
  /** Vervangen maar (door tijdgebrek) niet opnieuw gecontroleerd. */
  nietHercontroleerd?: number[];
  /** Aantal/oorspronkelijke nummers van vragen die onbruikbaar bleven en zijn weggehaald. */
  verwijderd?: number[];
  /** Nog open na reparatie (docent moet kijken). */
  blijft: ControleBevinding[];
  paragrafen?: { code: string; titel: string; vragen: number[] }[];
  duurMs?: number;
  fout?: string;
}

export interface GenerateInput {
  titel?: string;
  vak?: string;
  leerweg: Leerweg;
  leerjaar: 1 | 2 | 3 | 4;
  duurMinuten: number;
  doelPunten: number;
  aantalVragen: number;
  /** Leeg/undefined = auto (AI kiest op basis van lesstof). */
  mcVragen?: number;
  /** Leeg/undefined = auto. */
  openVragen?: number;
  rttiDoel: RttiVerdeling;
  bronmateriaal: string;
  extraEisen: string;
  bronUrl?: string;
  antwoordenmateriaal?: string;
  versie: ToetsVersie;
  moeilijkheid: Moeilijkheid;
  cijferNorm: CijferNorm;
  ronde?: number;
  parentId?: string;
  feedback?: string;
  vorigeSamenvatting?: string;
  stuurdocument?: string;
  /** "Met plaatjes" (standaard) of "Zonder plaatjes". */
  metPlaatjes?: boolean;
  /** Plaatjeskeuze: automatisch (standaard), met (verplicht figuren) of zonder. */
  plaatjes?: PlaatjesModus;
}

export interface GenerateMatrijsInput {
  titel?: string;
  vak?: string;
  leerweg: Leerweg;
  leerjaar: 1 | 2 | 3 | 4;
  rttiDoel: RttiVerdeling;
  bronmateriaal: string;
  extraEisen?: string;
  bronUrl?: string;
  feedbackGewenst: boolean;
}
