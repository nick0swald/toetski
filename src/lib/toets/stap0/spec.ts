/**
 * Stap 0 (plan week 41): de vraag-SPEC. Grok schrijft later alleen deze structuur; figuren, rekencontrole en
 * opmaak zijn deterministische code. Tekstvelden mogen inline-opmaak bevatten: <b>, <i>, <sub>, <sup>.
 * De JSON-schema-versie staat in spec-schema.ts (en als bestand in spec.schema.json).
 */
export type SeCode = "SE4.1" | "SE4.2" | "SE4.3" | "SE4.4" | "ALG";
export type Rtti = "R" | "T1" | "T2" | "I";
export type Niveau = "BB/KB/GT" | "vooral KB/GT" | "vooral GT";

export interface Vraagtype {
  /** Nummer uit vraagtypen.md (1–62). */
  nr: number;
  /** Code, bv. "W-DICHT". */
  code: string;
  naam: string;
  /** Voorkomen in het CSE 2013–2026 (BB, KB, GT). */
  cse?: [number, number, number];
}

/** Een gegeven of tussenwaarde waarmee de rekencontrole werkt. */
export interface Parameter {
  naam: string;
  waarde: number;
  eenheid?: string;
  /** Waar de leerling de waarde vindt: in de tekst (moet er letterlijk staan), in de figuur (figuurcontrole) of in Binas. */
  bron: "tekst" | "figuur" | "binas";
  /** Zoals de waarde in de tekst staat, bv. "63,0". Standaard: Nederlandse notatie van `waarde`. */
  weergave?: string;
}

/** Eén rekenstap; de code rekent `formule` na met de parameters en eerdere stappen. */
export interface Berekening {
  naam: string;
  /** Rekenregel met + − * / ^, haakjes, sqrt, sin/cos (graden), log2, ceil, round. */
  formule: string;
  /** Exacte uitkomst. */
  waarde: number;
  eenheid?: string;
  /** Zoals de uitkomst in het antwoordmodel staat (Nederlandse notatie), bv. "7,9". Moet in het antwoordmodel staan. */
  afgerond?: string;
  /** Relatieve tolerantie voor `waarde` (standaard 1e-6). */
  tolerantie?: number;
}

/** Koppeling tussen een gemeten waarde in de figuur en een parameter (of een vaste verwachte waarde). */
export interface FiguurControle {
  /** Sleutel uit de meting van het figuurtype, bv. "niveau2", "F1.N", "y@8", "B.T". */
  meting: string;
  parameter?: string;
  verwacht?: number;
  /** Absolute tolerantie (standaard per figuurtype). */
  tolerantie?: number;
}

export interface Maatcilinder {
  niveau: number;
  label?: string;
  /** Teken een voorwerp aan een draadje in de cilinder. */
  voorwerp?: boolean;
}

export interface MaatcilinderFiguur {
  type: "maatcilinder";
  cilinders: Maatcilinder[];
  /** Hoogste streep met getal (mL). */
  max: number;
  /** Waarde van de kleinste streep (mL). */
  streep: number;
  /** Om de hoeveel mL een getal staat. */
  getalElke: number;
  breedteCm: number;
  controle?: FiguurControle[];
}

export type NenSoort =
  | "weerstand"
  | "variabele-weerstand"
  | "lamp"
  | "spanningsmeter"
  | "stroommeter"
  | "motor"
  | "cel"
  | "wisselbron"
  | "schakelaar"
  | "diode"
  | "led"
  | "zekering";

export interface Onderdeel {
  soort: NenSoort;
  /** Label naast het symbool, bv. "R1 = 40 Ω" of "L1". */
  label?: string;
  /** Getekend in rood (antwoordfiguur). */
  rood?: boolean;
}

/**
 * Ladderschema: bron links (verticaal), daarnaast parallelle takken; elke tak is een reeks onderdelen in serie
 * (van boven naar onder). Verbindingsstippen komen automatisch alleen op aftakkingen.
 */
export interface SchakelschemaFiguur {
  type: "schakelschema";
  bron: { soort: "cel" | "wisselbron"; label?: string };
  takken: { onderdelen: Onderdeel[]; rood?: boolean }[];
  /** Laat ruimte vrij rechts (voor een tak die de leerling tekent). */
  vrijeRuimte?: boolean;
  breedteCm: number;
  controle?: FiguurControle[];
}

export interface As {
  label: string;
  min: number;
  max: number;
  stap: number;
  fijn?: number;
  /** Getallen bij de as weglaten (leerling deelt de as zelf in). */
  zonderGetallen?: boolean;
}

export interface Reeks {
  punten: [number, number][];
  /** lijn = rechte stukken, vloeiend = monotone kromme, punten = kruisjes. */
  vorm: "lijn" | "vloeiend" | "punten";
  rood?: boolean;
}

export interface GrafiekFiguur {
  type: "grafiek";
  x: As;
  y: As;
  reeksen: Reeks[];
  /** Kleine diagrammen zonder getallen (bv. vier (v,t)-diagrammen A–D). Dan worden x/y alleen als label gebruikt. */
  panelen?: { label: string; punten: [number, number][] }[];
  breedteCm: number;
  controle?: FiguurControle[];
}

export interface Pijl {
  naam: string;
  /** Grootte in newton; de lengte volgt uit de krachtenschaal. */
  grootteN: number;
  /** Richting in graden (0 = rechts, 90 = omhoog, 270 = omlaag). */
  hoek: number;
  label?: string;
  rood?: boolean;
}

export interface KrachtenFiguur {
  type: "krachten";
  /** Afmetingen op ware grootte (1 eenheid = 1 cm). */
  breedteCm: number;
  hoogteCm: number;
  /** Krachtenschaal: 1 cm ≙ schaalN newton. */
  schaalN: number;
  voorwerp: "bloempot" | "boomstam" | "krat" | "geen";
  /** Aangrijpingspunt in cm vanaf linksonder. */
  punt: [number, number];
  puntLabel?: string;
  pijlen: Pijl[];
  /** Teken de parallellogramconstructie en de resultante (rood) van de eerste twee pijlen. */
  resultante?: { label?: string };
  controle?: FiguurControle[];
}

export interface OscPaneel {
  label?: string;
  /** Amplitude in hokjes. */
  amplitude: number;
  /** Trillingstijd in hokjes. */
  trillingstijd: number;
}

export interface OscilloscoopFiguur {
  type: "oscilloscoop";
  hokjesX: number;
  hokjesY: number;
  panelen: OscPaneel[];
  /** Onderschrift, bv. "tijdbasis: 1 hokje (horizontaal) = 0,2 ms". */
  onderschrift?: string;
  /** Tekst in een leeg paneel ernaast (bij meerdere panelen). */
  notitie?: string;
  breedteCm: number;
  controle?: FiguurControle[];
}

/**
 * Optionele AI-afbeelding (foto of gestileerde illustratie van de situatie). ALLEEN als de vraag echt een foto of
 * situatieplaatje nodig heeft — nooit voor een meet- of rekenfiguur (daar zijn de vijf deterministische typen voor).
 * Generatie gaat via de bestaande beeldstroom met een interne go/no-go vóór plaatsing en zonder nabewerking.
 * Stap 0: alleen schema + placeholder in de opmaak; er wordt geen beeld-API aangeroepen.
 */
export interface AiAfbeeldingFiguur {
  type: "ai-afbeelding";
  stijl: "foto" | "illustratie";
  /** Wat er te zien moet zijn (prompt voor de beeldstroom), zonder getallen of meetwaarden. */
  beschrijving: string;
  /** Waarom een foto/situatieplaatje nodig is (wordt gekeurd: geen meet-/rekenfiguur). */
  reden: string;
  /** Alt-tekst voor toegankelijkheid. */
  alt: string;
  /** Optionele labels bij de afbeelding, zoals in het CSE ("adapter", "luidspreker"). */
  labels?: string[];
  breedteCm: number;
  hoogteCm: number;
}

export type MeetFiguurSpec = MaatcilinderFiguur | SchakelschemaFiguur | GrafiekFiguur | KrachtenFiguur | OscilloscoopFiguur;
export type FiguurSpec = MeetFiguurSpec | AiAfbeeldingFiguur;
export type FiguurType = FiguurSpec["type"];

export interface Scorestap {
  omschrijving: string;
  punten: number;
}

export interface Antwoordmodel {
  /** Juiste letter bij meerkeuze. */
  juist?: "A" | "B" | "C" | "D" | "E";
  /** Antwoord en uitwerking (regels). */
  regels: string[];
  figuur?: FiguurSpec;
  /** Lege leerlingfiguur in de docentversie weglaten (als de antwoordfiguur alles toont). */
  verbergLeerlingFiguur?: boolean;
  opmerking?: string;
}

export interface VraagSpec {
  id: string;
  vraagtype: Vraagtype;
  se: SeCode;
  /** Hoofdstuk / onderwerp, bv. "Materie: dichtheid berekenen + Binas". */
  hoofdstuk: string;
  /** Andere SE's waar de vraag ook past. */
  ookIn?: string;
  /** Contexttitel zoals in het CSE ("Gedeeld geluid"). */
  titel?: string;
  niveau: Niveau;
  punten: number;
  context: string[];
  tabel?: string[][];
  figuur?: FiguurSpec;
  stam: string;
  opties?: string[];
  antwoordregels?: number;
  antwoordmodel: Antwoordmodel;
  scorestappen: Scorestap[];
  rtti: Rtti;
  /** Leerdoel (voor de toetsmatrijs), bv. "K/4.2 dichtheid berekenen met ρ = m/V". */
  leerdoel?: string;
  /** Het getoetste begrip of de redenering in 2–6 woorden (bv. "frequentie uit trillingstijd"); geen twee vragen met hetzelfde begrip. */
  begrip?: string;
  /**
   * De leerling tekent iets in de figuur (pijl, lijn, punten, tak). Dan is de leerlingfiguur leeg of half af en
   * staan de figuurcontroles van wat de leerling tekent in `antwoordmodel.figuur` (verplicht), niet in de leerlingfiguur.
   */
  tekenvraag?: boolean;
  parameters?: Parameter[];
  berekeningen?: Berekening[];
}

/** Deelvraag van een vraagstuk: context/figuur/parameters van het vraagstuk gelden ook hier. */
export type DeelvraagSpec = Omit<VraagSpec, "se" | "hoofdstuk" | "context"> & { context?: string[] };

export interface VraagstukSpec {
  id: string;
  soort: "vraagstuk";
  titel: string;
  se: SeCode;
  hoofdstuk: string;
  context: string[];
  figuur?: FiguurSpec;
  parameters?: Parameter[];
  deelvragen: DeelvraagSpec[];
}

export type Fixture = ({ soort: "vraag" } & VraagSpec) | VraagstukSpec;

/** Platte vraag zoals de opmaak hem gebruikt (deelvragen erven van het vraagstuk). */
export interface OpmaakVraag extends VraagSpec {
  nr: number;
  /** SE-code + volgnummer, bv. "SE4.2-03" (klas 4); in klas 1–3 onderwerpletter + volgnummer, bv. "E-03". */
  code: string;
  /** Leerjaar van de toets (uit ToetsSpec.klas); bepaalt SE- of onderwerpteksten. */
  jaar?: number;
  /** Klas 1–3: onderwerplabel van deze SE-groep op basis van de inhoud van de toets (bv. "Geluid"). */
  onderwerp?: string;
  vraagstuk?: { id: string; titel: string; eerste: boolean; deel: number; aantal: number };
  /** Gedeelde context van het vraagstuk (alleen bij de eerste deelvraag) resp. de context van de vraag zelf. */
  gedeeldeContext?: string[];
  /** Eigen context van een deelvraag: staat in het CSE op de regel van het vraagnummer, vóór de opdracht (→). */
  aanloop?: string[];
}

/** Toets-niveau: welke vragen, in welke leerlingdelen, en de cijferberekening. */
export interface ToetsSpec {
  titel: string;
  ondertitel?: string;
  /** Fixture-ids in volgorde. */
  vragen: string[];
  /** Leerlingdelen (bv. A/B). Zonder delen is er één leerlingdeel. Elk id staat in precies één deel. */
  delen?: { naam: string; vragen: string[] }[];
  /** Normeringsterm N (standaard 1,0): cijfer = 9 · score / max + N, met de CvTE-grenzen. */
  nTerm?: number;
  /** Tijd in minuten (op het voorblad). */
  minuten?: number;
  /** Voorblad van het leerlingdeel (opbouw als de schooltoetsen/CSE + Toetski-leerlingblad). */
  voorblad?: Voorblad;
  /** Klas en leerweg: in klas 1–3 geen SE-/PTA-teksten maar een indeling per onderwerp. Zonder klas: klas 4 (SE). */
  klas?: { leerjaar: number; leerweg: string };
}

/** Velden van het voorblad. Alles optioneel; lege velden worden weggelaten (invulvelden blijven altijd staan). */
export interface Voorblad {
  /** Kop rechtsboven, bv. "Toets Krachten en Geluid". Standaard de toetstitel. */
  kop?: string;
  /** Leerweg/niveau achter de kop, bv. "VMBO-GL en TL". */
  leerweg?: string;
  /** Groot rechtsboven, bv. "2026-2027". */
  schooljaar?: string;
  /** Rechterblok onder het schooljaar, bv. "SE4" en "O 01 - W 2". */
  seCode?: string;
  toetscode?: string;
  /** Tekst in de zwarte balk, bv. "natuur- en scheikunde 1 – SE4 GL en TL". */
  vak?: string;
  /** Hulpmiddelen, elk als eigen regel ("Gebruik het BINAS informatieboek."). */
  hulpmiddelen?: string[];
  /** "Bij deze toets hoort een uitwerkbijlage." */
  uitwerkbijlage?: boolean;
  /** Interne code linksonder op het voorblad (zoals "4-03W2 - …" op de schooltoetsen). Standaard leeg. */
  voetcode?: string;
  /** Vrij veld voor school/docent (linksboven). Standaard leeg: dan staat er niets. */
  schoolveld?: string;
  /** Cesuur op het voorblad tonen (Toetski-leerlingblad). Standaard aan. */
  cesuur?: boolean;
}
