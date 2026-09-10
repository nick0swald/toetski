export type Rtti = "R" | "T1" | "T2" | "I";

export type Leerweg = "BB" | "KB" | "GT";
export type VraagType =
  | "meerkeuze"
  | "juist-onjuist"
  | "open"
  | "invul"
  | "berekening"
  | "bronvraag";

export type KwaliteitOordeel = "voldoet" | "aandacht" | "ontbreekt";
export type ToetsVersie = "A" | "B";
export type Moeilijkheid = "makkelijk" | "normaal" | "moeilijk";
export type CijferModel = "lineair" | "gebroken" | "exponentieel";

/** Vakprofiel voor figuur/bron-heuristieken (NaSk e.d.). */
export type VakProfiel = "nask" | "biologie" | "generiek";

/** Eenvoudige school-lijnfiguren (geen boekillustratie). */
export type SchemaFiguurSoort = "circuit" | "krachten" | "blokken";

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
  /** Optionele bron-tabel (na context, vóór stam). */
  tabel?: VraagTabel;
  /** Optionele bron-grafiek (na context, vóór stam). */
  grafiek?: VraagGrafiek;
  /** Optioneel eenvoudig schema (circuit/krachten/blokken). */
  schemaFiguur?: SchemaFiguur;
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
