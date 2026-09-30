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

/** Kalibratie voor één deel: aantallen, vormmix en % 1-puntsvragen van alleen dat deel. */
export function deelKalibratie(k: Kalibratie, d: Deel, totaalItems: number): Kalibratie {
  const n1Totaal = Math.round((totaalItems * k.pct1p) / 100);
  if (d.soort === "gesloten") {
    const som = Math.max(1, k.vorm.jn + k.vorm.mc);
    return {
      ...k,
      items: d.aantal,
      punten: d.punten,
      pct1p: 100,
      vorm: { jn: Math.round((k.vorm.jn / som) * 100), mc: Math.round((k.vorm.mc / som) * 100), kort: 0, invul: 0, uitleg: 0, reken: 0, teken: 0 },
      gesloten: 1,
      contexten: undefined,
      examenvragenBlok: false,
      opbouw: k.opbouw === "blokken" ? "blokken" : "los",
    };
  }
  const n1Open = Math.max(0, n1Totaal - (totaalItems - d.aantal));
  return {
    ...k,
    items: d.aantal,
    punten: d.punten,
    pct1p: Math.round((n1Open / Math.max(1, d.aantal)) * 100),
    vorm: { ...k.vorm, jn: 0, mc: 0 },
    gesloten: 0,
  };
}

interface TrimVraag {
  nummer: number;
  type: string;
  punten: number;
  domein?: string;
  contextTitel?: string;
  figuur?: unknown;
  maatcilinder?: unknown;
  pictogram?: unknown;
  grafiek?: unknown;
  schemaFiguur?: unknown;
}

/**
 * Levert het model (veel) meer vragen dan het doel, dan de overtollige vragen eraf: telkens uit de
 * best bedeelde paragraaf, eerst van de vorm (gesloten/open) die het meest boven zijn doel zit;
 * nooit een vraag met figuur of uit een doorlopende context. Houdt ≥ doel en de puntensom ≥ doelPunten.
 */
export function trimOverschot<Q extends TrimVraag, N extends { nummer: number }>(
  vragen: Q[],
  nakijk: N[],
  doelItems: number,
  doelPunten: number,
  doelGesloten: number,
): { vragen: Q[]; nakijkmodel: N[]; verwijderd: number } {
  const isG = (q: Q) => q.type === "meerkeuze" || q.type === "juist-onjuist";
  let v = [...vragen];
  const som = () => v.reduce((s, q) => s + (q.punten || 1), 0);
  let weg = 0;
  while (v.length > doelItems + 2) {
    const g = v.filter(isG).length;
    const teVeelGesloten = g - doelGesloten > v.length - g - (doelItems - doelGesloten);
    const perDomein = new Map<string, number>();
    for (const q of v) perDomein.set(q.domein ?? "", (perDomein.get(q.domein ?? "") ?? 0) + 1);
    const kandidaten = v
      .filter((q) => !q.contextTitel && !q.figuur && !q.maatcilinder && !q.pictogram && !q.grafiek && !q.schemaFiguur)
      .filter((q) => isG(q) === teVeelGesloten)
      .filter((q) => som() - (q.punten || 1) >= doelPunten)
      .sort((a, b) => (perDomein.get(b.domein ?? "") ?? 0) - (perDomein.get(a.domein ?? "") ?? 0) || b.nummer - a.nummer);
    const eruit = kandidaten[0];
    if (!eruit || (perDomein.get(eruit.domein ?? "") ?? 0) < 2) break;
    v = v.filter((q) => q !== eruit);
    weg += 1;
  }
  const oudNaarNieuw = new Map(v.map((q, i) => [q.nummer, i + 1]));
  return {
    vragen: v.map((q, i) => ({ ...q, nummer: i + 1 })),
    nakijkmodel: nakijk.filter((n) => oudNaarNieuw.has(n.nummer)).map((n) => ({ ...n, nummer: oudNaarNieuw.get(n.nummer)! })),
    verwijderd: weg,
  };
}
