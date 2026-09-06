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
export type VakProfiel = "generiek" | "nask";

export interface RttiVerdeling {
  R: number;
  T1: number;
  T2: number;
  I: number;
}

export interface CijferNorm {
  model: CijferModel;
  /** Percentage van het maximum waarbij het cijfer 5,5 is (gebroken grafiek). */
  cesuurPct: number;
  /** k in 1 + 9 × (score/max)^k. 1 = lineair; lager = voldoende makkelijker. */
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
}

export interface VraagOptie {
  letter: string;
  tekst: string;
}

export interface VraagTabel {
  koppen: string[];
  rijen: string[][];
}

export interface VraagGrafiek {
  titel: string;
  xLabel: string;
  yLabel: string;
  punten: { x: number; y: number; label?: string }[];
}

export interface Vraag {
  nummer: number;
  type: VraagType;
  rtti: Rtti;
  domein: string;
  leerdoel: string;
  punten: number;
  context?: string;
  stam: string;
  opties?: VraagOptie[];
  tabel?: VraagTabel;
  grafiek?: VraagGrafiek;
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
  /** "matrijs" = bestaande toets, alleen matrijs (+ optionele feedback). */
  soort?: "toets" | "matrijs";
  feedbackGewenst?: boolean;
  vakProfiel?: VakProfiel;
}

export interface GenerateInput {
  titel?: string;
  vak?: string;
  leerweg: Leerweg;
  leerjaar: 1 | 2 | 3 | 4;
  duurMinuten: number;
  doelPunten: number;
  aantalVragen: number;
  rttiDoel: RttiVerdeling;
  bronmateriaal: string;
  extraEisen: string;
  bronUrl?: string;
  versie: ToetsVersie;
  moeilijkheid: Moeilijkheid;
  cijferNorm: CijferNorm;
  ronde?: number;
  parentId?: string;
  feedback?: string;
  vorigeSamenvatting?: string;
  vakProfiel?: VakProfiel;
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
