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
  | "gezondheidsgevaar";

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
];

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
