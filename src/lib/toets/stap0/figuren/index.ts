/** Figurenbibliotheek stap 0: spec → SVG (deterministisch) en de automatische go/no-go per figuur. */
import type { FiguurControle, FiguurSpec, Parameter, VraagSpec } from "../spec.ts";
import { aiAfbeeldingSvg, keurAiAfbeelding } from "./ai-afbeelding.ts";
import { grafiekSvg, meetGrafiek } from "./grafiek.ts";
import { krachtenSvg, meetKrachten } from "./krachten.ts";
import { maatcilinderSvg, meetMaatcilinder } from "./maatcilinder.ts";
import { meetOscilloscoop, oscilloscoopSvg } from "./oscilloscoop.ts";
import { meetSchakelschema, schakelschemaSvg } from "./schakelschema.ts";

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
export function keurFiguur(f: FiguurSpec, params: Record<string, number>, vraag?: Pick<VraagSpec, "stam" | "parameters">): FiguurOordeel {
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
      fouten.push(`${f.type}: meting ${c.meting} niet gevonden in de figuur (meetbaar in deze figuur: ${kan.join(", ") || "niets"}; een pijl/lijn die de leerling zelf tekent hoort met zijn controle in antwoordmodel.figuur)`);
      continue;
    }
    const tol = c.tolerantie ?? STANDAARD_TOL[f.type];
    if (Math.abs(gemeten - verwacht) > tol + 1e-9) fouten.push(`${f.type}: ${c.meting} = ${gemeten} in de figuur, verwacht ${verwacht}${c.parameter ? ` (${c.parameter})` : ""}`);
  }
  if (f.type === "grafiek" && m.asfouten) fouten.push(`grafiek: ${m.asfouten} asgetallen staan niet op hun plek`);
  if (f.type === "krachten" && Math.abs((m.breedteCm ?? 0) - f.breedteCm) > 1e-6) fouten.push("krachten: figuur niet op ware grootte");
  if (!f.controle?.length) fouten.push(`${f.type}: geen controle gedefinieerd (go/no-go niet mogelijk)`);
  return { go: fouten.length === 0, fouten, metingen: m, svg };
}

export function paramMap(...lijsten: (Parameter[] | undefined)[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const l of lijsten) for (const p of l ?? []) o[p.naam] = p.waarde;
  return o;
}
