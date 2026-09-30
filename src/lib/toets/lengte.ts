import type { Leerweg, Moeilijkheid } from "./types";
import { gekalibreerdeLengte, isNaskVak } from "./kalibratie.ts";

/** Minuten per punt: BB rustiger, GT sneller (richtlijn sectie: 1 punt per 1,5–2 minuten). */
const MIN_PER_PUNT: Record<Leerweg, number> = { BB: 2, KB: 1.75, GT: 1.5 };

/**
 * Standaardlengte van een toets uit de toetsduur, leerweg en moeilijkheid.
 * Voorbeeld (algemeen): 45 min KB normaal → 26 punten, 14 vragen.
 * NaSk (vak "NaSk"/natuurkunde, of vak leeg) met leerjaar: gekalibreerd op de schooltoetsen
 * (minuten per vraag en punten per vraag), bijv. 3GT 40 min → 21 vragen / 30 punten.
 */
export function toetsLengte(
  minuten: number,
  leerweg: Leerweg,
  moeilijkheid: Moeilijkheid = "normaal",
  opts?: { leerjaar?: number; vak?: string },
): { punten: number; vragen: number } {
  if (opts?.leerjaar && (!opts.vak?.trim() || isNaskVak(opts.vak))) {
    return gekalibreerdeLengte(minuten, leerweg, opts.leerjaar, moeilijkheid);
  }
  const m = Math.max(10, Math.min(180, minuten || 45));
  let p = m / MIN_PER_PUNT[leerweg];
  if (moeilijkheid === "makkelijk") p *= 1.1; // meer korte R/T1-vragen in dezelfde tijd
  if (moeilijkheid === "moeilijk") p *= 0.9; // grotere denkstappen kosten meer tijd per punt
  const punten = Math.max(10, Math.min(100, Math.round(p)));
  const vragen = Math.max(6, Math.min(40, Math.round(punten / 1.85)));
  return { punten, vragen };
}
