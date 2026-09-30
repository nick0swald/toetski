import type { FiguurSpec } from "../types.ts";

export const KEURING_CHECKS = [
  "klopt_met_spec",
  "labels_en_getallen_correct",
  "past_bij_vraag_en_antwoord",
  "verklapt_antwoord_niet",
  "leesbaar",
  "juiste_stijl",
  "veilig_en_vakinhoudelijk_juist",
  "geen_tegenspraak_met_vraag",
] as const;

export type KeuringCheck = (typeof KEURING_CHECKS)[number];

export interface KeuringUitslag {
  besluit: "go" | "no_go";
  checks: Partial<Record<KeuringCheck, boolean>>;
  redenen: string[];
  feedback: string;
}

const CHECK_TEKST: Record<KeuringCheck, string> = {
  klopt_met_spec: "figuur klopt niet met de spec",
  labels_en_getallen_correct: "labels, getallen of eenheden kloppen niet",
  past_bij_vraag_en_antwoord: "figuur past niet bij vraag/antwoord",
  verklapt_antwoord_niet: "figuur verklapt het antwoord",
  leesbaar: "figuur is niet goed leesbaar",
  juiste_stijl: "stijl klopt niet",
  veilig_en_vakinhoudelijk_juist: "onveilig of vakinhoudelijk onjuist",
  geen_tegenspraak_met_vraag: "beeld spreekt de vraag tegen (afstand, positie, handeling of aantal)",
};

/**
 * Model-JSON → uitslag. "go" telt alleen als het model go zegt ÉN elke check expliciet true is.
 * Ontbrekende of onleesbare velden → no_go. De code beslist, niet de claim van het model.
 */
export function beoordeelKeuring(raw: unknown): KeuringUitslag {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const checksIn = (o.checks && typeof o.checks === "object" ? o.checks : {}) as Record<string, unknown>;
  const checks: Partial<Record<KeuringCheck, boolean>> = {};
  for (const k of KEURING_CHECKS) checks[k] = checksIn[k] === true;
  const redenen = Array.isArray(o.redenen) ? o.redenen.map((r) => String(r).trim()).filter(Boolean).slice(0, 8) : [];
  const feedback = typeof o.feedback === "string" ? o.feedback.trim().slice(0, 800) : "";
  const modelGo = String(o.besluit ?? "").toLowerCase().replace(/[\s-]/g, "_") === "go";
  const gefaald = KEURING_CHECKS.filter((k) => !checks[k]);
  const go = modelGo && gefaald.length === 0;
  const extra = gefaald.map((k) => CHECK_TEKST[k]);
  return {
    besluit: go ? "go" : "no_go",
    checks,
    redenen: go ? redenen : [...new Set([...redenen, ...extra])].slice(0, 10),
    feedback,
  };
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kort label zonder spatie en zonder los getal, zoals "F2", "Fz", "Fres", "v1", "Δt". */
export function isSymboolnaam(item: string): boolean {
  const t = item.trim();
  return /^[A-Za-zΔαβγλρ][A-Za-z]{0,3}\d?$/.test(t) && !/^(ja|nee)$/i.test(t);
}

function getalTokens(s: string): number[] {
  return (norm(s).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter(Number.isFinite);
}

/**
 * Deterministische voorcheck voor code-figuren: staat iets uit "nietTonen" letterlijk in beeld?
 * Getallen worden als getal vergeleken (12 ≠ 120); tekst als heel woord/zinsdeel.
 */
export function voorcheckNietTonen(spec: FiguurSpec, teksten: string[]): string[] {
  const inBeeld = teksten.map(norm);
  const beeldGetallen = new Set(teksten.flatMap(getalTokens));
  const problemen: string[] = [];
  for (const item of spec.nietTonen) {
    const n = norm(item);
    if (!n || n.length < 2) continue;
    // Pure symboolnamen (F2, Fz, Fres, v, Δt) zijn labels, geen verboden antwoord.
    if (isSymboolnaam(item)) continue;
    const getallen = getalTokens(item);
    const alleenGetal = /^-?\d+(?:\.\d+)?\s*[a-zµ°Ω/%³²]*$/i.test(n);
    if (alleenGetal && getallen.length === 1) {
      if (beeldGetallen.has(getallen[0]!)) problemen.push(`"${item}" staat in de figuur (mag niet getoond worden)`);
      continue;
    }
    const re = new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
    if (inBeeld.some((t) => re.test(t))) problemen.push(`"${item}" staat in de figuur (mag niet getoond worden)`);
  }
  return problemen;
}
