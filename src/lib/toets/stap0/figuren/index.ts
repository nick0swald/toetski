/** Figurenbibliotheek stap 0: spec → SVG (deterministisch) en de automatische go/no-go per figuur. */
import type { FiguurControle, FiguurSpec, Parameter, VraagSpec } from "../spec.ts";
import { aiAfbeeldingSvg, keurAiAfbeelding } from "./ai-afbeelding.ts";
import { grafiekSvg, meetGrafiek } from "./grafiek.ts";
import { krachtenSvg, meetKrachten } from "./krachten.ts";
import { maatcilinderSvg, meetMaatcilinder } from "./maatcilinder.ts";
import { meetOscilloscoop, oscilloscoopSvg } from "./oscilloscoop.ts";
import { meetSchakelschema, schakelschemaSvg } from "./schakelschema.ts";
import { keurMeter, meetMeter, meterSvg } from "./meter.ts";

export function figuurSvg(f: FiguurSpec): string {
  switch (f.type) {
    case "maatcilinder":
      return maatcilinderSvg(f);
    case "schakelschema":
      return schakelschemaSvg(f);
    case "grafiek":
      return grafiekSvg(f);
    case "krachten":
      return krachtenSvg(f);
    case "oscilloscoop":
      return oscilloscoopSvg(f);
    case "meter":
      return meterSvg(f);
    case "ai-afbeelding":
      return aiAfbeeldingSvg(f);
  }
}

/** Meet de waarden terug uit de getekende SVG (niet uit de spec). */
export function meetFiguur(f: FiguurSpec, svg: string): Record<string, number> {
  switch (f.type) {
    case "maatcilinder":
      return meetMaatcilinder(svg);
    case "schakelschema":
      return meetSchakelschema(svg);
    case "grafiek": {
      const xs = (f.controle ?? []).map((c) => c.meting.match(/^y@([\d.]+)$/)?.[1]).filter(Boolean).map(Number);
      return meetGrafiek(svg, xs);
    }
    case "krachten":
      return meetKrachten(svg, f.schaalN);
    case "oscilloscoop":
      return meetOscilloscoop(svg);
    case "meter":
      return meetMeter(svg);
    case "ai-afbeelding":
      return { placeholder: 1 }; // niets te meten: een foto/situatieplaatje is nooit een meetfiguur
  }
}

const STANDAARD_TOL: Record<FiguurSpec["type"], number> = {
  maatcilinder: 0.05, // mL (afleesbaar op de kleinste streep is strenger dan nodig: 62 moet 62 zijn)
  schakelschema: 0,
  grafiek: 0.05,
  krachten: 0.5, // N
  oscilloscoop: 0.05, // hokjes
  meter: 0.01,
  "ai-afbeelding": 0,
};

export interface FiguurOordeel {
  go: boolean;
  fouten: string[];
  metingen: Record<string, number>;
  svg: string;
}

/**
 * Go/no-go: elke `controle` koppelt een meting uit de SVG aan een parameter (of een vaste waarde). Daarnaast:
 * grafiek-asgetallen op de juiste plek, krachtenfiguur op ware grootte.
 */
/** Rood = antwoord: een rode pijl/resultante, rode reeks of rode tak/onderdeel hoort nooit in een leerlingfiguur. */
export function heeftRood(f: FiguurSpec | undefined): boolean {
  if (!f) return false;
  if (f.type === "krachten") return f.pijlen.some((p) => p.rood) || Boolean(f.resultante);
  if (f.type === "grafiek") return f.reeksen.some((r) => r.rood);
  if (f.type === "schakelschema") return f.takken.some((t) => t.rood || t.onderdelen.some((o) => o.rood));
  return false;
}
/**
 * Leerlingfiguur zonder het rode antwoord. Een tak die helemaal rood was (of alleen rode onderdelen had) verdwijnt. Een
 * controle waarvan de meting in de kale figuur niet meer bestaat, valt weg (die hoort bij de antwoordfiguur).
 */
export function zonderRood(f: FiguurSpec): FiguurSpec {
  let g: FiguurSpec = f;
  if (f.type === "krachten") {
    const { resultante: _r, ...rest } = f;
    g = { ...rest, pijlen: f.pijlen.filter((p) => !p.rood) };
  } else if (f.type === "grafiek") g = { ...f, reeksen: f.reeksen.filter((r) => !r.rood) };
  else if (f.type === "schakelschema")
    g = { ...f, takken: f.takken.filter((t) => !t.rood && (t.onderdelen.length === 0 || t.onderdelen.some((o) => !o.rood))).map((t) => ({ ...t, onderdelen: t.onderdelen.filter((o) => !o.rood) })) };
  const cs = (g as { controle?: FiguurControle[] }).controle;
  if (g === f || !cs?.length) return g;
  let m: Record<string, number> = {};
  try {
    m = meetFiguur(g, figuurSvg(g));
  } catch {
    /* geen metingen: alle controles weg */
  }
  const controle = cs.filter((c) => c.meting in m);
  return { ...g, controle: controle.length ? controle : undefined } as FiguurSpec;
}

/** Lege of halve tekenfiguur: de leerling tekent er zelf in (geen pijlen, geen reeksen, of vrije ruimte voor een tak). */
export function isTekenFiguur(f: FiguurSpec): boolean {
  if (f.type === "krachten") return f.pijlen.length === 0;
  if (f.type === "grafiek") return !f.panelen?.length && f.reeksen.every((r) => r.rood || r.punten.length <= 1);
  if (f.type === "schakelschema") return Boolean(f.vrijeRuimte);
  return false;
}

export function keurFiguur(f: FiguurSpec, params: Record<string, number>, vraag?: Pick<VraagSpec, "stam" | "parameters">, opts: { rol?: "leerling" | "antwoord"; teken?: boolean } = {}): FiguurOordeel {
  const svg = figuurSvg(f);
  if (f.type === "ai-afbeelding") {
    // Stap 0: spec-keuring + placeholder. De beeldkeuring (go/no-go op het gegenereerde beeld) zit in de beeldstroom.
    const fouten = keurAiAfbeelding(f, vraag);
    return { go: fouten.length === 0, fouten, metingen: { placeholder: 1 }, svg };
  }
  const m = meetFiguur(f, svg);
  const fouten: string[] = [];
  for (const c of (f.controle ?? []) as FiguurControle[]) {
    const gemeten = m[c.meting];
    const verwacht = c.parameter !== undefined ? params[c.parameter] : c.verwacht;
    if (verwacht === undefined) {
      fouten.push(`${f.type}: parameter ${c.parameter} onbekend`);
      continue;
    }
    if (gemeten === undefined || Number.isNaN(gemeten)) {
      const kan = Object.keys(m).filter((k) => !["breedteCm", "asfouten"].includes(k)).slice(0, 12);
      if (opts.rol === "leerling" && opts.teken)
        fouten.push(`${f.type}: tekenvraag: "${c.meting}" tekent de leerling zelf en staat dus niet in de leerlingfiguur. Zet deze controle in antwoordmodel.figuur (dezelfde figuur mét de rode pijl/lijn) en haal hem uit de leerlingfiguur (meetbaar in de leerlingfiguur: ${kan.join(", ") || "niets"})`);
      else fouten.push(`${f.type}: meting ${c.meting} niet gevonden in de figuur (meetbaar in deze figuur: ${kan.join(", ") || "niets"}; een pijl/lijn die de leerling zelf tekent hoort met zijn controle in antwoordmodel.figuur)`);
      continue;
    }
    const tol = c.tolerantie ?? STANDAARD_TOL[f.type];
    if (Math.abs(gemeten - verwacht) > tol + 1e-9) fouten.push(`${f.type}: ${c.meting} = ${gemeten} in de figuur, verwacht ${verwacht}${c.parameter ? ` (${c.parameter})` : ""}`);
  }
  if (f.type === "grafiek" && m.asfouten) fouten.push(`grafiek: ${m.asfouten} asgetallen staan niet op hun plek`);
  if (f.type === "meter") fouten.push(...keurMeter(f));
  if (f.type === "krachten" && Math.abs((m.breedteCm ?? 0) - f.breedteCm) > 1e-6) fouten.push("krachten: figuur niet op ware grootte");
  // Een lege tekenfiguur voor de leerling heeft niets om te meten; de controle zit dan in antwoordmodel.figuur.
  if (!f.controle?.length && !(opts.rol === "leerling" && opts.teken && isTekenFiguur(f))) fouten.push(`${f.type}: geen controle gedefinieerd (go/no-go niet mogelijk)`);
  return { go: fouten.length === 0, fouten, metingen: m, svg };
}

export function paramMap(...lijsten: (Parameter[] | undefined)[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const l of lijsten) for (const p of l ?? []) o[p.naam] = p.waarde;
  return o;
}
