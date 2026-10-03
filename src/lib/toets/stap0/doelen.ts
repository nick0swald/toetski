/**
 * Examendoelen en vraagtypen voor stap 0: welke CvTE-eindtermen (klas 3–4) of SLO-kerndoelen (klas 1–2) bij de
 * geüploade lesstof horen, het officiële vraagtypenummer (1–62 uit de bundel "62 vraagtypen", 63 = overig) en de
 * spreiding van vraagtypen in een toets.
 */
import { VRAAGTYPEN } from "../kalibratie-data.ts";
import { EINDTERMEN, KERNDOELEN, type LeerdoelData } from "../leerdoelen-data.ts";
import type { Leerweg } from "../types.ts";
import type { VraagstukSpec, Vraagtype } from "./spec.ts";

type Deelvraag = VraagstukSpec["deelvragen"][number];

/** Het officiële nummer: de volgorde van VRAAGTYPEN volgt de bundel (1 = E-COMP … 62 = K-ZWP, 63 = OVERIG). */
const NR = new Map(VRAAGTYPEN.slice(0, 63).map((t, i) => [t.id, i + 1]));
const kort = (naam: string) => naam.split(/[(:;]/)[0]!.trim();

/** Volledig vraagtype bij een code (of nummer): nr, code, korte naam en voorkomen in het CSE (BB, KB, GT). */
export function officieelVraagtype(code: string | number | undefined): Vraagtype | null {
  const t = typeof code === "number" ? VRAAGTYPEN[code - 1] : VRAAGTYPEN.find((x) => x.id === String(code ?? "").trim().toUpperCase());
  if (!t || (typeof code === "number" && code > 63)) return null;
  return { nr: NR.get(t.id) ?? 63, code: t.id, naam: kort(t.naam), cse: [t.niveaus.BB ?? 0, t.niveaus.KB ?? 0, t.niveaus.GT ?? 0] };
}

/**
 * Stille correctie: nr/naam/cse volgen uit de code (Grok nummert soms naar zijn eigen lijst); een onbekende code →
 * het type bij het nummer, anders 63 Overig. Geeft een logregel terug als er iets veranderde.
 */
export function normaliseerVraagtype(d: Pick<Deelvraag, "vraagtype">): string | null {
  const oud = d.vraagtype;
  const nieuw = officieelVraagtype(oud?.code) ?? officieelVraagtype(oud?.nr) ?? officieelVraagtype("OVERIG")!;
  if (oud && oud.nr === nieuw.nr && oud.code === nieuw.code && oud.naam === nieuw.naam && JSON.stringify(oud.cse) === JSON.stringify(nieuw.cse)) return null;
  d.vraagtype = nieuw;
  return oud?.code === nieuw.code ? null : `vraagtype ${oud?.code ?? "?"} → ${nieuw.nr} ${nieuw.code}`;
}

/** Examendoelen (CvTE-eindtermen klas 3–4, SLO-kerndoelen klas 1–2) die in deze lesstof aan bod komen. */
export function relevanteDoelen(bron: string, leerjaar: number, leerweg: string, max = 14): LeerdoelData[] {
  const lw = (["BB", "KB", "GT"].includes(leerweg) ? leerweg : "GT") as Leerweg;
  const t = bron.toLowerCase();
  const lijst = leerjaar <= 2 ? KERNDOELEN : EINDTERMEN.filter((d) => d.leerwegen.includes(lw));
  return lijst
    .map((d) => ({ d, n: (t.match(new RegExp(d.kw, "gi")) ?? []).length }))
    .filter((x) => x.n >= 2 || (x.n >= 1 && x.d.id.startsWith("K/3")))
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((x) => x.d);
}

/** Vraagtypen die bij de doelen horen, voorop in de lijst voor de prompt. */
export function typenVoorDoelen(doelen: LeerdoelData[]): Set<string> {
  return new Set(doelen.flatMap((d) => d.typen).filter((c) => c !== "OVERIG"));
}

export interface TypeTelling {
  nr: number;
  code: string;
  naam: string;
  deelvragen: number;
  punten: number;
}
/** Spreiding van vraagtypen: per type deelvragen en punten, het aantal typen en het grootste aandeel (punten). */
export function vraagtypeSpreiding(vs: VraagstukSpec[]): { perType: TypeTelling[]; aantal: number; maxAandeel: number } {
  const m = new Map<string, TypeTelling>();
  let som = 0;
  for (const d of vs.flatMap((v) => v.deelvragen)) {
    const t = officieelVraagtype(d.vraagtype?.code) ?? officieelVraagtype("OVERIG")!;
    const r = m.get(t.code) ?? { nr: t.nr, code: t.code, naam: t.naam, deelvragen: 0, punten: 0 };
    r.deelvragen++;
    r.punten += d.punten;
    som += d.punten;
    m.set(t.code, r);
  }
  const perType = [...m.values()].sort((a, b) => a.nr - b.nr);
  return { perType, aantal: perType.length, maxAandeel: som ? Math.round((100 * Math.max(...perType.map((x) => x.punten))) / som) : 0 };
}
