import { vormAantallen, type Kalibratie } from "./kalibratie.ts";

/**
 * Lange toetsen (NaSk: 18+ vragen) in twee parallelle modelaanroepen: deel 1 = gesloten vragen
 * (juist/onjuist + meerkeuze, 1 punt), deel 2 = open vragen, berekeningen en contexten. Zo blijft de
 * generatie binnen het tijdsbudget van 100 s terwijl de aantallen de schooltoetsen volgen.
 */

export interface Deel {
  soort: "gesloten" | "open";
  aantal: number;
  punten: number;
  startNr: number;
  jn: number;
  mc: number;
}

export function deelPlan(k: Kalibratie, aantalVragen: number, doelPunten: number): Deel[] | null {
  if (aantalVragen < 18) return null;
  const a = vormAantallen({ ...k, items: aantalVragen });
  const gesloten = a.jn + a.mc;
  const open = aantalVragen - gesloten;
  if (gesloten < 5 || open < 4) return null;
  return [
    { soort: "gesloten", aantal: gesloten, punten: gesloten, startNr: 1, jn: a.jn, mc: a.mc },
    { soort: "open", aantal: open, punten: Math.max(open, doelPunten - gesloten), startNr: gesloten + 1, jn: 0, mc: 0 },
  ];
}

export function deelOpdracht(d: Deel, andere: Deel): string {
  if (d.soort === "gesloten") {
    return `DEELOPDRACHT (deel 1 van 2, voor dit antwoord gaat dit vóór de totalen hierboven): lever ALLEEN de gesloten vragen: ${d.jn ? `${d.jn} juist/onjuist-stellingen en ` : ""}${d.mc} meerkeuzevragen, elk 1 punt, samen ${d.aantal} vragen, genummerd ${d.startNr} t/m ${d.startNr + d.aantal - 1}. Vooral kennis en begrippen (R/T1) verdeeld over alle paragrafen. Een ander deel maakt ${andere.aantal} open vragen en berekeningen; maak daarom geen rekenvragen en geen contexten met contextTitel.`;
  }
  return `DEELOPDRACHT (deel 2 van 2, voor dit antwoord gaat dit vóór de totalen hierboven): lever ALLEEN de open vragen (kort antwoord, invullen, berekening, uitleggen, tekenen) en eventuele contexten/examenvragen: ${d.aantal} vragen, samen ${d.punten} punten, genummerd ${d.startNr} t/m ${d.startNr + d.aantal - 1}. Een ander deel maakt al ${andere.aantal} gesloten vragen (juist/onjuist en meerkeuze); maak hier GEEN meerkeuze of juist/onjuist. Verdeel over alle paragrafen.`;
}

interface MiniPayload {
  vragen: { nummer: number }[];
  nakijkmodel: { nummer: number }[];
}

/** Twee deelresultaten samenvoegen: gesloten eerst, doornummeren 1…n, nakijkmodel mee. */
export function voegDelenSamen<P extends MiniPayload>(gesloten: P | null, open: P | null): P {
  const delen = [gesloten, open].filter((x): x is P => Boolean(x));
  if (!delen.length) throw new Error("Geen enkel deel gelukt");
  const basis = open ?? gesloten!;
  const vragen: P["vragen"] = [];
  const nakijk: P["nakijkmodel"] = [];
  for (const d of delen) {
    for (const [i, q] of d.vragen.entries()) {
      const nr = vragen.length + 1;
      const oud = q.nummer;
      vragen.push({ ...q, nummer: nr });
      const n = d.nakijkmodel.find((x) => x.nummer === oud) ?? d.nakijkmodel[i];
      if (n) nakijk.push({ ...n, nummer: nr });
    }
  }
  return { ...basis, vragen, nakijkmodel: nakijk };
}
