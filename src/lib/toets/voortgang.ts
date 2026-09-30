import type { Voortgang } from "./maak-toets";

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
  /** Grove resttijd in seconden (afgerond op 5), of null als onbekend. */
  restS: number | null;
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

function rond5(ms: number): number {
  return Math.max(5, Math.round(ms / 5_000) * 5);
}

export function berekenVoortgang(v: Voortgang, t: VoortgangTijden, nu: number): VoortgangWeergave {
  const inFase = nu - t.faseStart;
  const figuurRest = v.figuurDeadline != null ? Math.max(0, v.figuurDeadline - nu) : null;
  const fig = v.figuren;
  const figTekst = fig?.gepland && fig.totaal > 0 ? ` (${fig.klaar} van ${fig.totaal})` : "";
  switch (v.fase) {
    case "vragen": {
      const [a, b] = RANGE.vragen;
      const pct = a + (b - a) * 0.97 * ease(inFase, t.verwachtVragenMs);
      const rest = Math.max(5_000, t.verwachtVragenMs - inFase) + (v.metPlaatjes ? 40_000 : 12_000);
      return { pct, label: "Vragen maken…", restS: rond5(rest), wachtOpPlaatjes: false };
    }
    case "afwerken": {
      const [a, b] = RANGE.afwerken;
      const pct = a + (b - a) * 0.95 * ease(inFase, 14_000);
      const label = v.metPlaatjes
        ? fig?.gepland
          ? fig.totaal
            ? `Afwerken en controleren · plaatjes maken en keuren${figTekst}…`
            : "Afwerken en controleren · geen plaatjes nodig…"
          : "Afwerken en controleren · plaatjes plannen…"
        : "Afwerken en controleren…";
      const rest = v.metPlaatjes && figuurRest != null ? figuurRest : Math.max(5_000, 14_000 - inFase);
      return { pct, label, restS: rond5(rest), wachtOpPlaatjes: false };
    }
    case "plaatjes": {
      const [a, b] = RANGE.plaatjes;
      // Echte voortgang (gekeurde figuren) én tijd richting de harde deadline; wat het verst is, telt.
      const echt = fig?.gepland && fig.totaal ? fig.klaar / fig.totaal : 0;
      const totaalVenster = v.figuurDeadline != null ? Math.max(1_000, v.figuurDeadline - t.faseStart) : 20_000;
      const tijd = Math.min(0.97, inFase / totaalVenster);
      const pct = a + (b - a) * Math.max(echt * 0.95, tijd);
      const label = fig?.gepland ? (fig.totaal ? `Wachten op plaatjes: maken en keuren${figTekst}…` : "Laatste controle…") : "Wachten op plaatjes: plannen…";
      return { pct, label, restS: figuurRest != null ? rond5(figuurRest) : null, wachtOpPlaatjes: true };
    }
    case "word":
      return { pct: RANGE.word[0] + 3 * ease(inFase, 3_000), label: "Word-bestand maken…", restS: 5, wachtOpPlaatjes: false };
    default:
      return { pct: 100, label: "Klaar", restS: 0, wachtOpPlaatjes: false };
  }
}
