/** Gedeelde opmaakgegevens (zoals build.py): SE-kleuren, teksten, toetsmatrijs-totalen. Gebruikt door PDF en Word. */
import type { OpmaakVraag, SeCode } from "./spec.ts";

export const SE_INFO: Record<SeCode, { naam: string; kleur: string; tint: string }> = {
  "SE4.1": { naam: "Krachten en werktuigen", kleur: "#1f6fb2", tint: "#e3eef8" },
  "SE4.2": { naam: "Energie (H11), Geluid (H13), materie en Binas", kleur: "#2e8b57", tint: "#e2f2e8" },
  "SE4.3": { naam: "Elektriciteit", kleur: "#d35400", tint: "#fbeadb" },
  "SE4.4": { naam: "Arbeid en kracht (arbeid, vermogen, rendement, beweging)", kleur: "#8e44ad", tint: "#f0e4f5" },
  ALG: { naam: "Algemene vaardigheden (grafiek, aflezen, eenheden, onderzoek, rekenen)", kleur: "#6c7a7d", tint: "#eceff0" },
};
export const SE_ORDE: SeCode[] = ["SE4.1", "SE4.2", "SE4.3", "SE4.4", "ALG"];
export const seNaam = (k: SeCode) => (k === "ALG" ? "Algemeen" : k);

export const INSTRUCTIE =
  "Je mag Binas en een rekenmachine gebruiken. Gebruik g = 10 N/kg, tenzij anders vermeld. Schrijf bij rekenvragen altijd de formule, de berekening en het antwoord met de eenheid op. Bij een tekenvraag teken je in de figuur.";
export const UITLEG_SE =
  "De vragen zijn ingedeeld per SE-toets van het PTA klas 4 GT. Elke SE-toets heeft een eigen kleur; de code (bijvoorbeeld SE4.2-03) geeft de toets en het volgnummer binnen die toets. Vaardigheden die bij alle toetsen horen, staan onder Algemeen (grijs).";
export const UITLEG_DOCENT =
  "<b>Bij het antwoordmodel.</b> Het antwoordmodel volgt de opbouw van het correctievoorschrift van het CvTE: maximumscore, antwoord en de verdeling van de scorepunten. Bij een meerkeuzevraag krijgt alleen de juiste letter het scorepunt. <b>RTTI:</b> R = reproductie, T1 = toepassen in een bekende situatie, T2 = toepassen in een nieuwe situatie, I = inzicht. <b>Niveau:</b> de examenniveaus waarin dit vraagtype voorkomt. Alle berekeningen zijn in code nagerekend en alle figuren automatisch gecontroleerd. Krachtenfiguren zijn op schaal 1 : 1 afgedrukt.";

export function bandTekst(q: OpmaakVraag): { links: string; rechts: string } {
  const extra = q.niveau !== "BB/KB/GT" ? ` · <font color="#b03a2e">${q.niveau}</font>` : "";
  return {
    links: q.code,
    rechts: `Type ${q.vraagtype.nr} · ${q.vraagtype.naam} <small>(${q.vraagtype.code})</small><br/><small>Onderwerp: ${q.hoofdstuk}${extra}</small>`,
  };
}

export function rttiRegel(q: OpmaakVraag): string {
  const cse = q.vraagtype.cse ? ` (voorkomen CSE 2013–2026: BB ${q.vraagtype.cse[0]} · KB ${q.vraagtype.cse[1]} · GT ${q.vraagtype.cse[2]})` : "";
  const alt = q.ookIn ? ` · ook relevant voor: ${q.ookIn}` : "";
  return `<b>RTTI:</b> ${q.rtti} · <b>Niveau:</b> ${q.niveau}${cse}${alt}`;
}

export function antwoordKop(q: OpmaakVraag): string {
  return q.opties ? `<b>Antwoordmodel</b> — maximumscore ${q.punten} · juiste antwoord: <b>${q.antwoordmodel.juist}</b>` : `<b>Antwoordmodel</b> — maximumscore ${q.punten}`;
}

export interface Totaal {
  sleutel: string;
  vragen: number;
  punten: number;
  pct: number;
}

function totaal<K extends string>(vragen: OpmaakVraag[], sleutel: (q: OpmaakVraag) => K, orde: K[]): Totaal[] {
  const som = vragen.reduce((s, q) => s + q.punten, 0) || 1;
  return orde
    .map((k) => {
      const qs = vragen.filter((q) => sleutel(q) === k);
      const p = qs.reduce((s, q) => s + q.punten, 0);
      return { sleutel: k, vragen: qs.length, punten: p, pct: Math.round((1000 * p) / som) / 10 };
    })
    .filter((t) => t.vragen > 0);
}

export function matrijsTotalen(vragen: OpmaakVraag[]) {
  return {
    perSe: totaal(vragen, (q) => q.se, SE_ORDE),
    perRtti: totaal(vragen, (q) => q.rtti, ["R", "T1", "T2", "I"]),
    perNiveau: totaal(vragen, (q) => q.niveau, ["BB/KB/GT", "vooral KB/GT", "vooral GT"]),
    perHoofdstuk: totaal(vragen, (q) => q.hoofdstuk, [...new Set(vragen.map((q) => q.hoofdstuk))]),
    punten: vragen.reduce((s, q) => s + q.punten, 0),
    vragen: vragen.length,
  };
}

/** Vraagnummers van een vraagstuk, bv. "6–9". */
export function vraagstukBereik(vragen: OpmaakVraag[], id: string): string {
  const nrs = vragen.filter((q) => q.vraagstuk?.id === id).map((q) => q.nr);
  return nrs.length > 1 ? `${nrs[0]}–${nrs[nrs.length - 1]}` : String(nrs[0] ?? "");
}
