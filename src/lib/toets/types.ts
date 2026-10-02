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
  /** Docent koos zelf een RTTI-doel (anders het standaarddoel per klas). */
  rttiHandmatig?: boolean;
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
  /**
   * Titel van een doorlopende context (examenstijl). Alle vragen van één context hebben dezelfde titel;
   * de inleiding staat alleen in `context` van de eerste vraag van die context.
   */
  contextTitel?: string;
  /** Vraagtype uit de NaSk-taxonomie (bijv. G-ECHO, E-PUI, O-LICHT); OVERIG als niets past. */
  vraagtype?: string;
  /** Officieel leerdoel (syllabus-eindterm zoals "K/8.4" of SLO-kerndoel zoals "SLO-30C"); zie toets.leerdoelen. */
  leerdoelId?: string;
  /** Korte uitleg van het RTTI-label (regel: type → basis, bijgesteld op opdracht/stappen/context). */
  rttiUitleg?: string;
  /** Plan-first: RTTI uit het bouwplan (blijft staan tenzij de regel ≥ 2 stappen afwijkt). */
  rttiPlan?: Rtti;
  /** Plan-first: geplande punten (bovengrens na reparatie en puntennormalisatie). */
  puntenPlan?: number;
  /** Bronvermelding bij een bewerkte examenvraag, bijv. "naar: examen 2019 tijdvak 1". */
  bronvermelding?: string;
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
   * Oorspronkelijke tekst vóórdat gegevens/beschrijving naar een figuur verhuisden. Valt de figuur weg
   * en is de stam nog precies `na`, dan komt deze tekst terug (geen kapotte zinnen).
   */
  tekstZonderFiguur?: { stam: string; context?: string; na: string };
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
  /** Tokens en kosten (USD) van alle modelaanroepen voor deze toets (stap 1 + stap 2). */
  kosten?: ToetsKosten;
  /** Officiële leerdoelen van deze toets (vooraf gekoppeld, deterministisch) met richtpunten. */
  leerdoelen?: LeerdoelPlan;
}

export interface PlanLeerdoel {
  id: string;
  tekst: string;
  /** CE/SE (syllabus) of KD (kerndoel onderbouw). */
  deel: "CE" | "SE" | "KD";
  typen: string[];
  /** Richtpunten voor dit doel (stabiel per hoofdstuk + klas + leerweg + toetslengte). */
  doelPunten: number;
  wettelijk?: string;
}

export interface LeerdoelPlan {
  bron: "syllabus" | "kerndoelen";
  bronTitel: string;
  /** Waar de keuze vandaan komt, bijv. "Nova H13 Geluid" of "onderwerp Geluid". */
  herkomst: string;
  leerweg: string;
  leerjaar: number;
  doelen: PlanLeerdoel[];
  /** Vraagnummers waarvan het leerdoelId lokaal is toegekend (onbekend/ontbrekend na generatie). */
  hersteld?: number[];
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
  /** Geen aantallen/punten vastgezet: de server gebruikt bij NaSk de gekalibreerde lengte. */
  lengteAuto?: boolean;
  /** Blok 'Examenvragen' (echte CSE-contexten) in klas 4; undefined = standaard (aan in klas 4). */
  examenvragen?: boolean;
  /** Leeg/undefined = auto (AI kiest op basis van lesstof). */
  mcVragen?: number;
  /** Leeg/undefined = auto. */
  openVragen?: number;
  rttiDoel: RttiVerdeling;
  /** Docent schoof zelf aan het RTTI-doel; anders geldt rttiDoelVoor(leerjaar, moeilijkheid) uit config.ts. */
  rttiHandmatig?: boolean;
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

/** Past een pictogramveld bij de vraagtekst? (Een drukberekening met een gevarensymbool niet.) */
export function pictogramPastBijVraag(q: Pick<Vraag, "stam" | "context" | "leerdoel" | "opties">): boolean {
  const t = `${q.context ?? ""} ${q.stam} ${q.leerdoel ?? ""} ${(q.opties ?? []).map((o) => o.tekst).join(" ")}`;
  return /symbool|pictogram|\bbord|etiket|gevaar|gevaarlijk|veilig|bescherming|\bbril|handschoen|brandbaar|ontvlambaar|giftig|bijtend|explosie|oxider|milieu|irriter|schadelijk|lawaai|verplicht|verboden/i.test(t);
}

/** Een maatcilinder hoort alleen bij een vraag over volume/vloeistof aflezen (niet bij bijv. een veer). */
export function maatcilinderPastBijVraag(q: Pick<Vraag, "stam" | "context" | "leerdoel">): boolean {
  return /maatcilinder|volume|onderdompel|\bml\b|milliliter|vloeistof|dichtheid|afles/i.test(`${q.context ?? ""} ${q.stam} ${q.leerdoel ?? ""}`);
}

/** Wat je op het symbool/bord ZIET (zonder de betekenis te noemen): voor een vraag waarvan de figuur wegviel. */
export const PICTOGRAM_BESCHRIJVING: Record<GhsSymbool, string> = {
  ontvlambaar: "een zwarte vlam in een rode ruit",
  giftig: "een doodshoofd met gekruiste botten in een rode ruit",
  bijtend: "druppels die een hand en een plaatje aantasten, in een rode ruit",
  milieu: "een dode boom en een dode vis in een rode ruit",
  schadelijk: "een uitroepteken in een rode ruit",
  explosief: "een ontploffende bom in een rode ruit",
  oxiderend: "een vlam boven een cirkel in een rode ruit",
  "gas-onder-druk": "een gasfles in een rode ruit",
  gezondheidsgevaar: "het silhouet van een bovenlichaam met een ster op de borst in een rode ruit",
  "gebod-gehoorbescherming": "een wit hoofd met oorkappen op een blauw rond bord",
  "gebod-oogbescherming": "een wit hoofd met een veiligheidsbril op een blauw rond bord",
  "gebod-handschoenen": "een witte handschoen op een blauw rond bord",
  "gebod-veiligheidsschoenen": "een witte werkschoen op een blauw rond bord",
  "gebod-stofmasker": "een wit hoofd met een mondkapje op een blauw rond bord",
  "gebod-helm": "een wit hoofd met een helm op een blauw rond bord",
  "waarschuwing-algemeen": "een zwart uitroepteken in een gele driehoek",
  "waarschuwing-elektriciteit": "een zwarte bliksemschicht in een gele driehoek",
  "waarschuwing-heet": "golvende lijnen boven een heet oppervlak in een gele driehoek",
  "verbod-roken": "een brandende sigaret met een rode streep erdoor in een rode cirkel",
  "verbod-open-vuur": "een lucifer met vlam met een rode streep erdoor in een rode cirkel",
};

/** Kostenoverzicht per toets (zie llm.ts). */
export interface ToetsKosten {
  usd: number;
  tokensIn: number;
  tokensCache: number;
  tokensUit: number;
  tokensRedeneren: number;
  aanroepen: number;
  mislukt: number;
  perRol: Record<string, { usd: number; aanroepen: number; tokensIn: number; tokensUit: number; ms: number }>;
  duurVragenMs?: number;
  duurAfwerkenMs?: number;
}
