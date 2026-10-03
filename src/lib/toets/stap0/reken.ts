/**
 * Rekencontrole in code (port van checks.py): elke berekening in de spec wordt nagerekend uit de parameters.
 * Een vraag met een rekenfout wordt niet geplaatst (go/no-go).
 */
import type { Berekening, DeelvraagSpec, Parameter, VraagSpec } from "./spec.ts";

/** Nederlandse notatie: 7.875 → "7,875"; 0.3 met 2 decimalen → "0,30". */
export function nl(x: number, decimalen?: number): string {
  const s = decimalen === undefined ? String(Number(x.toPrecision(12))) : x.toFixed(decimalen);
  return s.replace(".", ",");
}

const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
/** Mantisse en exponent van "1,4×10³", "1,4·10^3", "1,4 x 10^-3" (exponent 0 voor een gewoon getal). */
function machtVan(s: string): { mantisse: string; exp: number } {
  const t = s.replace(/\s/g, "").replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => SUP[c]!);
  const m = /^(-?[\d.,]+)(?:[×x·*]10\^?(-?\d+))$/.exec(t);
  return m ? { mantisse: m[1]!, exp: Number(m[2]) } : { mantisse: t, exp: 0 };
}

/** "7,9" → 7.9; ook "1,4×10³" / "1,4·10^3" → 1400. */
export function leesNl(s: string): number {
  const { mantisse, exp } = machtVan(s);
  return Number(mantisse.replace(",", ".")) * 10 ** exp;
}

type Token = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokens(src: string): Token[] {
  const out: Token[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?(?:e[+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|[-+*/^(),<>]))/gy;
  let m: RegExpExecArray | null;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break;
      throw new Error(`onbekend teken in formule "${src}" bij ${pos}`);
    }
    pos = re.lastIndex;
    if (m[1]) out.push({ t: "num", v: Number(m[1]) });
    else if (m[2]) out.push({ t: "id", v: m[2] });
    else if (m[3]) out.push({ t: "op", v: m[3] });
  }
  return out;
}

const RAD = Math.PI / 180;
const FUNCTIES: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  sin: (x) => Math.sin(x * RAD),
  cos: (x) => Math.cos(x * RAD),
  tan: (x) => Math.tan(x * RAD),
  log2: Math.log2,
  log10: Math.log10,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  abs: Math.abs,
};

/** Veilige evaluator (geen eval): vergelijking < > <= >= (1/0), + −, * /, ^ (rechts-associatief), unair −, functies. */
export function rekenUit(formule: string, vars: Record<string, number>): number {
  const tk = tokens(formule);
  let i = 0;
  const peek = () => tk[i];
  const neem = (v?: string) => {
    const t = tk[i++];
    if (!t || (v !== undefined && (t.t !== "op" || t.v !== v))) throw new Error(`formule "${formule}": verwacht ${v ?? "waarde"}`);
    return t;
  };
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  function vergelijk(): number {
    const a = som();
    for (const op of ["<=", ">=", "<", ">"]) {
      if (isOp(op)) {
        neem(op);
        const b = som();
        return Number(op === "<" ? a < b : op === ">" ? a > b : op === "<=" ? a <= b : a >= b);
      }
    }
    return a;
  }
  function som(): number {
    let a = term();
    while (isOp("+") || isOp("-")) a = neem().v === "+" ? a + term() : a - term();
    return a;
  }
  function term(): number {
    let a = macht();
    while (isOp("*") || isOp("/")) a = neem().v === "*" ? a * macht() : a / macht();
    return a;
  }
  function macht(): number {
    const a = unair();
    if (isOp("^")) {
      neem("^");
      return a ** macht();
    }
    return a;
  }
  function unair(): number {
    if (isOp("-")) {
      neem("-");
      return -unair();
    }
    return atoom();
  }
  function atoom(): number {
    const t = neem();
    if (t.t === "num") return t.v;
    if (t.t === "op" && t.v === "(") {
      const v = vergelijk();
      neem(")");
      return v;
    }
    if (t.t === "id") {
      if (isOp("(")) {
        const f = FUNCTIES[t.v];
        if (!f) throw new Error(`onbekende functie ${t.v}`);
        neem("(");
        const v = vergelijk();
        neem(")");
        return f(v);
      }
      if (t.v === "pi") return Math.PI;
      if (!(t.v in vars)) throw new Error(`formule "${formule}": onbekende grootheid ${t.v}`);
      return vars[t.v];
    }
    throw new Error(`formule "${formule}": onverwacht ${t.v}`);
  }
  const v = vergelijk();
  if (i !== tk.length) throw new Error(`formule "${formule}": rest na positie ${i}`);
  return v;
}

/** Halve eenheid van de laatste decimaal van een afgerond getal: "7,9" → 0,05; "1250" → 0,5. */
/** Halve eenheid van het laatste cijfer. "1400" (geheel getal met nullen achteraan) is dubbelzinnig: dan de ruimste lezing (2 sig. cijfers → ±50). */
function halveEenheid(s: string): number {
  const { mantisse, exp } = machtVan(s);
  if (mantisse.includes(",")) return 0.5 * 10 ** (exp - mantisse.split(",")[1]!.length);
  const nullen = /[1-9](0+)$/.exec(mantisse.replace(/^-/, ""))?.[1]?.length ?? 0;
  return 0.5 * 10 ** (exp + nullen);
}

function stripOpmaak(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\u00a0/g, " ");
}

/** Komt het getal (Nederlandse notatie) los voor in de tekst? "8,0" telt niet als match binnen "18,05". */
export function getalInTekst(getal: string, tekst: string): boolean {
  const t = stripOpmaak(tekst);
  const esc = getal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^0-9,])${esc}(?![0-9]|,[0-9])`, "i").test(t);
}

export interface RekenResultaat {
  ok: boolean;
  fouten: string[];
  waarden: Record<string, number>;
  regels: string[];
}

/**
 * Rekent alle berekeningen na. `extra` = parameters van het vraagstuk. Controleert ook dat elke parameter met
 * bron "tekst" in context/stam/tabel staat en dat elk afgerond antwoord in het antwoordmodel staat.
 */
export function controleerBerekeningen(q: VraagSpec | DeelvraagSpec, extra: Parameter[] = [], extraTekst = ""): RekenResultaat {
  const fouten: string[] = [];
  const regels: string[] = [];
  const params = [...extra, ...(q.parameters ?? [])];
  const vars: Record<string, number> = {};
  for (const p of params) vars[p.naam] = p.waarde;
  const vraagTekst = [extraTekst, ...(q.context ?? []), q.stam, ...(q.tabel ?? []).flat(), ...(q.opties ?? [])].join(" \n ");
  for (const p of q.parameters ?? []) {
    if (p.bron !== "tekst") continue;
    const w = p.weergave ?? nl(p.waarde);
    if (!getalInTekst(w, vraagTekst)) fouten.push(`parameter ${p.naam} = ${w} staat niet in de vraagtekst`);
  }
  const antwoordTekst = [...q.antwoordmodel.regels, q.antwoordmodel.opmerking ?? "", ...q.scorestappen.map((s) => s.omschrijving)].join(" \n ");
  for (const b of (q.berekeningen ?? []) as Berekening[]) {
    let v: number;
    try {
      v = rekenUit(b.formule, vars);
    } catch (e) {
      fouten.push(`${b.naam}: ${(e as Error).message}`);
      continue;
    }
    const tol = b.tolerantie ?? 1e-6;
    if (!Number.isFinite(v) || Math.abs(v - b.waarde) > tol * Math.max(1, Math.abs(b.waarde))) {
      fouten.push(`${b.naam} = ${b.formule} geeft ${nl(v)}, spec zegt ${nl(b.waarde)}`);
    }
    if (b.afgerond) {
      const a = leesNl(b.afgerond);
      if (!Number.isFinite(a) || Math.abs(a - v) > halveEenheid(b.afgerond) + 1e-9 * Math.abs(v)) {
        fouten.push(`${b.naam}: afgerond ${b.afgerond} past niet bij ${nl(v)}`);
      }
      if (!getalInTekst(b.afgerond, antwoordTekst)) fouten.push(`${b.naam}: ${b.afgerond} staat niet in het antwoordmodel`);
    }
    vars[b.naam] = v;
    regels.push(`${b.naam} = ${b.formule} = ${nl(Number(v.toPrecision(6)))}${b.eenheid ? ` ${b.eenheid}` : ""}`);
  }
  return { ok: fouten.length === 0, fouten, waarden: vars, regels };
}
