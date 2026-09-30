import type { Voortgang } from "./maak-toets";

/** Doel: totale wachttijd ± 60 s; figuren mogen uitlopen tot het harde maximum. */
export const DOEL_TOTAAL_MS = 60_000;
/** Hard maximum voor de hele toets inclusief figuren (Nick: max 100 s). */
export const MAX_TOTAAL_MS = 100_000;
/**
 * Figuren krijgen minstens zoveel tijd na het verschijnen van de vragen (binnen MAX_TOTAAL_MS).
 * Figuren die eerder klaar zijn, laten de toets ook eerder klaar zijn; alleen trage figuren benutten dit.
 */
export const MIN_FIGUURVENSTER_MS = 60_000;

export function figuurDeadline(t0: number, tVragen: number): number {
  return Math.min(t0 + MAX_TOTAAL_MS, Math.max(t0 + DOEL_TOTAAL_MS, tVragen + MIN_FIGUURVENSTER_MS));
}

/** Typische duur van de figuren na de vragen (voor de afteller; gemeten 20–35 s). */
export const TYPISCH_FIGUREN_MS = 30_000;
/** Typische duur van afwerken incl. verplichte inhoudscontrole + reparatie (gemeten 25–45 s). */
export const TYPISCH_AFWERKEN_MS = 35_000;

/**
 * Voortgangsbalk: tijdgestuurde easing binnen een fase, sprongen bij echte gebeurtenissen.
 * Pure functie (testbaar); het component houdt de weergave monotoon (nooit terug).
 */
export interface VoortgangTijden {
  start: number;
  /** Moment waarop de huidige fase begon. */
  faseStart: number;
  /** Verwachte duur van de vragenfase (ms). */
  verwachtVragenMs: number;
}

export interface VoortgangWeergave {
  /** 0–100 */
  pct: number;
  label: string;
  /** Geschatte resttijd in ms (voor de afteller), of null als onbekend. */
  restMs: number | null;
  wachtOpPlaatjes: boolean;
}

const RANGE = {
  vragen: [2, 55],
  afwerken: [55, 85],
  plaatjes: [80, 96],
  word: [96, 100],
  klaar: [100, 100],
} as const;

/** Verwachte vragentijd: gemeten ± 8 s + 1,4 s per vraag (grok-4.20 niet-redenerend). */
export function verwachteVragenMs(aantalVragen: number): number {
  return 8_000 + 1_400 * Math.max(4, Math.min(80, aantalVragen));
}

function ease(verstreken: number, verwacht: number): number {
  // 1 - e^(-2t/T): ± 86 % bij de verwachte duur; loopt daarna steeds trager door, nooit 100 %.
  return 1 - Math.exp((-2 * Math.max(0, verstreken)) / Math.max(1_000, verwacht));
}

/** Figuren: typische eindtijd, maar nooit later dan de harde deadline. */
function figuurRestMs(v: Voortgang, nu: number): number | null {
  if (v.figuurDeadline == null) return null;
  const hard = Math.max(0, v.figuurDeadline - nu);
  const typisch = v.figuurStart != null ? v.figuurStart + TYPISCH_FIGUREN_MS - nu : hard;
  const fig = v.figuren;
  if (fig?.gepland && fig.totaal === 0) return Math.min(hard, 4_000);
  return Math.min(hard, Math.max(4_000, typisch));
}

export function berekenVoortgang(v: Voortgang, t: VoortgangTijden, nu: number): VoortgangWeergave {
  const inFase = nu - t.faseStart;
  const figuurRest = figuurRestMs(v, nu);
  const fig = v.figuren;
  const figTekst = fig?.gepland && fig.totaal > 0 ? ` (${fig.klaar} van ${fig.totaal})` : "";
  switch (v.fase) {
    case "vragen": {
      const [a, b] = RANGE.vragen;
      const pct = a + (b - a) * 0.97 * ease(inFase, t.verwachtVragenMs);
      const rest = Math.max(5_000, t.verwachtVragenMs - inFase) + Math.max(TYPISCH_AFWERKEN_MS, v.metPlaatjes ? TYPISCH_FIGUREN_MS : 0);
      return { pct, label: "Vragen maken…", restMs: rest, wachtOpPlaatjes: false };
    }
    case "afwerken": {
      const [a, b] = RANGE.afwerken;
      const pct = a + (b - a) * 0.95 * ease(inFase, TYPISCH_AFWERKEN_MS);
      const label = v.metPlaatjes
        ? fig?.gepland
          ? fig.totaal
            ? `Afwerken en controleren · plaatjes maken en keuren${figTekst}…`
            : "Afwerken en controleren · geen plaatjes nodig…"
          : "Afwerken en controleren · plaatjes plannen…"
        : "Afwerken en controleren…";
      const afwerkRest = Math.max(3_000, TYPISCH_AFWERKEN_MS - inFase);
      const rest = v.metPlaatjes && figuurRest != null ? Math.max(figuurRest, afwerkRest) : afwerkRest;
      return { pct, label, restMs: rest, wachtOpPlaatjes: false };
    }
    case "plaatjes": {
      const [a, b] = RANGE.plaatjes;
      // Echte voortgang (gekeurde figuren) én tijd richting de harde deadline; wat het verst is, telt.
      const echt = fig?.gepland && fig.totaal ? fig.klaar / fig.totaal : 0;
      const totaalVenster = v.figuurDeadline != null ? Math.max(1_000, v.figuurDeadline - t.faseStart) : 20_000;
      const tijd = Math.min(0.97, inFase / totaalVenster);
      const pct = a + (b - a) * Math.max(echt * 0.95, tijd);
      const label = fig?.gepland ? (fig.totaal ? `Wachten op plaatjes: maken en keuren${figTekst}…` : "Laatste controle…") : "Wachten op plaatjes: plannen…";
      return { pct, label, restMs: figuurRest, wachtOpPlaatjes: true };
    }
    case "word":
      return { pct: RANGE.word[0] + 3 * ease(inFase, 3_000), label: "Word-bestand maken…", restMs: 2_000, wachtOpPlaatjes: false };
    default:
      return { pct: 100, label: "Klaar", restMs: 0, wachtOpPlaatjes: false };
  }
}

/** Eerste figuurronde bij "Met plaatjes" stopt standaard hier (ruimte voor een extra ronde binnen 100 s). */
export const MET_EERSTE_RONDE_MS = 72_000;

/**
 * Einde van de eerste figuurronde bij "Met plaatjes": minstens 72 s na start, maar altijd ≥ 40 s na de
 * vragen (anders krijgen keuringen geen kans als de vragen traag waren), en nooit later dan 100 s − 16 s.
 */
export function eersteRondeEinde(t0: number, tVragen: number): number {
  return Math.min(t0 + MAX_TOTAAL_MS - 16_000, Math.max(t0 + MET_EERSTE_RONDE_MS, tVragen + 40_000));
}


/** Afwerkbudget: maximaal 60 s, en zo dat de hele toets binnen ~100 s klaar is (≥ 30 s voor de controle). */
export function afwerkBudget(verstrekenMs?: number): number {
  if (verstrekenMs === undefined) return 60_000;
  return Math.max(30_000, Math.min(60_000, 100_000 - 10_000 - verstrekenMs));
}
