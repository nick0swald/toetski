/**
 * Validatie van een spec: (1) JSON-schema (ajv), (2) inhoudelijke regels die een schema niet kan uitdrukken
 * (punten = som scorestappen, MC heeft een juiste letter binnen de opties, …).
 */
import Ajv from "ajv";
import { SPEC_SCHEMA, TOETS_SCHEMA } from "./spec-schema.ts";
import type { Fixture, VraagSpec, DeelvraagSpec, ToetsSpec } from "./spec.ts";

let validator: ReturnType<Ajv["compile"]> | null = null;
function schemaValidator() {
  if (!validator) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    validator = ajv.compile(SPEC_SCHEMA);
  }
  return validator;
}

export function valideerSchema(spec: unknown): string[] {
  const v = schemaValidator();
  if (v(spec)) return [];
  return (v.errors ?? []).slice(0, 12).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim());
}

function regelsVoorVraag(q: VraagSpec | DeelvraagSpec, pad: string): string[] {
  const f: string[] = [];
  const som = q.scorestappen.reduce((s, x) => s + x.punten, 0);
  if (q.opties) {
    if (!q.antwoordmodel.juist) f.push(`${pad}: meerkeuze zonder juiste letter`);
    else if (q.antwoordmodel.juist.charCodeAt(0) - 65 >= q.opties.length) f.push(`${pad}: juiste letter ${q.antwoordmodel.juist} valt buiten de opties`);
    if (new Set(q.opties.map((o) => o.toLowerCase().trim())).size !== q.opties.length) f.push(`${pad}: dubbele opties`);
    if (q.scorestappen.length && som !== q.punten) f.push(`${pad}: scorestappen ${som} ≠ ${q.punten} punten`);
  } else {
    if (q.antwoordmodel.juist) f.push(`${pad}: open vraag met een juiste letter`);
    if (som !== q.punten) f.push(`${pad}: scorestappen ${som} ≠ ${q.punten} punten`);
    if (!q.antwoordmodel.regels.length && !q.antwoordmodel.figuur) f.push(`${pad}: leeg antwoordmodel`);
  }
  const namen = new Set<string>();
  for (const b of q.berekeningen ?? []) {
    if (namen.has(b.naam)) f.push(`${pad}: berekening ${b.naam} dubbel`);
    namen.add(b.naam);
  }
  return f;
}

/** Alle fouten (schema + regels). Leeg = geldig. */
export function valideerSpec(spec: unknown): string[] {
  const s = valideerSchema(spec);
  if (s.length) return s.map((x) => `schema ${x}`);
  const fx = spec as Fixture;
  if (fx.soort === "vraagstuk") {
    const f: string[] = [];
    if (fx.deelvragen.length < 3 || fx.deelvragen.length > 4) f.push(`${fx.id}: een vraagstuk heeft 3–4 deelvragen`);
    fx.deelvragen.forEach((d, i) => f.push(...regelsVoorVraag(d, `${fx.id}/${i + 1}`)));
    return f;
  }
  return regelsVoorVraag(fx, fx.id);
}

let toetsValidator: ReturnType<Ajv["compile"]> | null = null;
/** Toets-spec: schema + elk vraag-id bestaat en staat in precies één leerlingdeel. */
export function valideerToets(t: unknown, bekendeIds: string[]): string[] {
  toetsValidator ??= new Ajv({ allErrors: true, strict: false }).compile(TOETS_SCHEMA);
  if (!toetsValidator(t)) return (toetsValidator.errors ?? []).map((e) => `toets ${e.instancePath || "/"} ${e.message ?? ""}`);
  const ts = t as ToetsSpec;
  const f: string[] = [];
  for (const id of ts.vragen) if (!bekendeIds.includes(id)) f.push(`toets: onbekende vraag ${id}`);
  if (ts.delen) {
    const alle = ts.delen.flatMap((d) => d.vragen);
    for (const id of ts.vragen) {
      const n = alle.filter((x) => x === id).length;
      if (n !== 1) f.push(`toets: ${id} staat ${n}× in de leerlingdelen`);
    }
    for (const id of alle) if (!ts.vragen.includes(id)) f.push(`toets: deel bevat ${id}, die niet in de toets staat`);
  }
  return f;
}
