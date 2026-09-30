import type { NakijkItem, Vraag } from "./types";
import type { ItemIssue } from "./item-kwaliteit";

/**
 * Deterministische controle van rekenantwoorden (geen modelaanroep):
 * - elke rekenketen in het modelantwoord ("18 × 9,8 = 176,4 N") wordt nagerekend; afkappen (176,58 → 176)
 *   wordt afronden (177), een kleine afrondfout wordt hersteld, een grote afwijking wordt een sleutel-fout;
 * - zwaartekracht: één g per toets (uit de lesstof, anders Nova 9,8 N/kg), het nakijkmodel rekent met die g
 *   en accepteert ook de uitkomst met de andere gangbare g (9,81 en 10 N/kg).
 */

const GETAL = String.raw`\d+(?:[.,]\d+)?`;
const OP = String.raw`[×x·*\/:+−–-]`;
const KETEN = new RegExp(String.raw`((?:${GETAL}\s*${OP}\s*)+${GETAL})\s*=\s*(${GETAL})`, "g");

export function leesGetal(s: string): number {
  return Number(s.replace(/\s/g, "").replace(",", "."));
}

function decimalen(s: string): number {
  const m = s.match(/[.,](\d+)$/);
  return m ? m[1]!.length : 0;
}

/** Nederlandse notatie met een vast aantal decimalen (176,4; 2000; 0,25). */
export function nl(n: number, d = 0): string {
  const r = Number(n.toFixed(d));
  return (d > 0 ? r.toFixed(d) : String(Math.round(r))).replace(".", ",");
}

/** Getal zonder overbodige decimalen (2000; 176,58). */
function mooi(w: number): string {
  return String(Number(w.toFixed(2))).replace(".", ",");
}

/** g volgens de lesstof ("g = 9,81 N/kg", "g = 10 N/kg"); anders Nova-standaard 9,8 N/kg. */
export function gUitBron(bron: string): number {
  const m = bron.match(/\bg\s*(?:=|is|≈)\s*(9[.,]81|9[.,]8|10)\s*N\s*\/\s*kg/i);
  return m ? leesGetal(m[1]!) : 9.8;
}

/** Rekent een platte expressie uit (× en / vóór + en −). */
export function reken(expr: string): number | null {
  const tokens = expr.replace(/\s+/g, "").match(new RegExp(`${GETAL}|${OP}`, "g"));
  if (!tokens || tokens.length % 2 === 0) return null;
  const termen: number[] = [];
  let teken = 1;
  let prod = leesGetal(tokens[0]!);
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]!;
    const v = leesGetal(tokens[i + 1]!);
    if (/[×x·*]/.test(op)) prod *= v;
    else if (/[\/:]/.test(op)) {
      if (v === 0) return null;
      prod /= v;
    } else {
      termen.push(teken * prod);
      teken = /\+/.test(op) ? 1 : -1;
      prod = v;
    }
  }
  termen.push(teken * prod);
  const uit = termen.reduce((s, x) => s + x, 0);
  return Number.isFinite(uit) ? uit : null;
}

/** Klopt `geclaimd` met `waarde` als correct afgeronde uitkomst (op decimalen óf op significante cijfers)? */
export function goedAfgerond(geclaimdTekst: string, waarde: number): boolean {
  const c = leesGetal(geclaimdTekst);
  const d = decimalen(geclaimdTekst);
  const eps = 1e-9 + Math.abs(waarde) * 1e-9;
  if (Math.abs(c - waarde) <= 0.5 * 10 ** -d + eps) return true;
  // Significante cijfers: 180 voor 176,4 (2 sig.) is afronden, geen fout.
  if (d === 0 && c !== 0) {
    const nullen = (String(Math.round(c)).match(/0+$/)?.[0].length ?? 0);
    if (nullen > 0 && Math.abs(c - waarde) <= 0.5 * 10 ** nullen + eps) return true;
  }
  return false;
}

function isFzVraag(q: Vraag): boolean {
  const t = `${q.context ?? ""} ${q.stam}`.toLowerCase();
  return q.vraagtype === "K-FZ" || (/zwaartekracht|gewicht|\bfz\b/.test(t) && /\d\s*kg\b/.test(t) && /bereken|hoe groot/.test(t));
}

export interface RekenResultaat {
  vragen: Vraag[];
  nakijkmodel: NakijkItem[];
  issues: ItemIssue[];
  /** Vraagnummers waarvan het modelantwoord deterministisch is hersteld. */
  hersteld: number[];
}

/** Controleert en herstelt rekenantwoorden in het nakijkmodel. */
export function controleerBerekeningen(vragen: Vraag[], nakijk: NakijkItem[], opts: { g?: number } = {}): RekenResultaat {
  const g = opts.g ?? 9.8;
  const issues: ItemIssue[] = [];
  const hersteld: number[] = [];
  const uitN = nakijk.map((n) => ({ ...n, puntenverdeling: (n.puntenverdeling ?? []).map((p) => ({ ...p })) }));
  for (const q of vragen) {
    if (q.opties?.length) continue;
    const n = uitN.find((x) => x.nummer === q.nummer);
    if (!n?.modelantwoord) continue;
    let ma = n.modelantwoord;
    const fz = isFzVraag(q);
    const vervangen: [string, string][] = [];
    // 1) Eén g: rekent het model met een andere g dan de toets, dan de keten omzetten.
    if (fz) {
      const andere = [9.81, 9.8, 10].filter((x) => x !== g);
      for (const a of andere) {
        const re = new RegExp(String.raw`(${GETAL})\s*([×x·*])\s*${nl(a, a === 10 ? 0 : a === 9.8 ? 1 : 2).replace(",", "[.,]")}(?![\d,.])`, "g");
        ma = ma.replace(re, (_m, m: string, op: string) => `${m} ${op} ${nl(g, g === 10 ? 0 : g === 9.8 ? 1 : 2)}`);
      }
    }
    // 2) Elke rekenketen narekenen.
    let fout = "";
    ma = ma.replace(KETEN, (heel: string, expr: string, geclaimd: string) => {
      const w = reken(expr);
      if (w === null || goedAfgerond(geclaimd, w)) return heel;
      const d = decimalen(geclaimd);
      const juist = nl(w, d);
      const rel = Math.abs(leesGetal(geclaimd) - w) / Math.max(1e-9, Math.abs(w));
      if (rel <= 0.03) {
        vervangen.push([geclaimd, juist]);
        return heel.replace(new RegExp(`=\\s*${geclaimd.replace(/[.,]/, "[.,]")}$`), `= ${juist}`);
      }
      fout = `${expr.trim()} = ${mooi(w)}, niet ${geclaimd}`;
      return heel;
    });
    // 3) Fz zonder keten ("176 N"): zelf m × g uitrekenen.
    const massa = `${q.context ?? ""} ${q.stam}`.match(new RegExp(`(${GETAL})\\s*kg\\b`));
    let fzWaarde: number | null = null;
    if (fz && massa) {
      const m = leesGetal(massa[1]!);
      fzWaarde = m * g;
      const eind = ma.match(new RegExp(`(${GETAL})\\s*N\\b(?!\\s*\\/)`, "g"));
      const laatste = eind?.at(-1)?.match(new RegExp(GETAL))?.[0];
      if (laatste && !goedAfgerond(laatste, fzWaarde)) {
        const rel = Math.abs(leesGetal(laatste) - fzWaarde) / fzWaarde;
        if (rel <= 0.03) {
          const juist = nl(fzWaarde, decimalen(laatste));
          vervangen.push([laatste, juist]);
          ma = ma.replace(new RegExp(`${laatste.replace(/[.,]/, "[.,]")}(\\s*N\\b)(?![\\s\\S]*${laatste.replace(/[.,]/, "[.,]")}\\s*N\\b)`), `${juist}$1`);
        } else if (!fout) fout = `Fz = ${mooi(m)} × ${mooi(g)} = ${mooi(fzWaarde)} N, niet ${laatste} N`;
      }
    }
    // 4) Nakijkmodel accepteert ook de uitkomst met een andere gangbare g.
    if (fz && fzWaarde !== null && !/ook goed/i.test(ma)) {
      const m = fzWaarde / g;
      const d = Math.abs(m * g) >= 100 ? 0 : 1;
      const alt = [9.81, 10, 9.8].filter((a) => a !== g).map((a) => `${nl(m * a, d)} N (met g = ${nl(a, a === 10 ? 0 : a === 9.8 ? 1 : 2)} N/kg)`);
      const eigen = nl(m * g, d);
      ma = `${ma.replace(/\s+$/, "")}${/[.!]$/.test(ma.trim()) ? "" : "."} Ook goed: ${[...new Set(alt)].filter((a) => !a.startsWith(`${eigen} N`)).join(" of ")}.`;
    }
    if (ma !== n.modelantwoord) {
      // Hetzelfde getal in de rubriek meenemen (bijv. "juiste uitkomst: 176 N").
      n.modelantwoord = ma;
      for (const [oud, nieuw] of vervangen) {
        const re = new RegExp(`(^|[^\\d,.])${oud.replace(/[.,]/, "[.,]")}(?![\\d]|[.,]\\d)`, "g");
        for (const c of n.puntenverdeling) c.criterium = c.criterium.replace(re, `$1${nieuw}`);
      }
      hersteld.push(q.nummer);
    }
    if (fout) issues.push({ nummer: q.nummer, code: "sleutel-fout", uitleg: `Rekencontrole: ${fout}. Herstel het modelantwoord (reken opnieuw, rond correct af — niet afkappen) en de rubriek.` });
  }
  return { vragen, nakijkmodel: uitN, issues, hersteld };
}

/** Instructie op het leerlingblad: welke g de toets gebruikt (alleen als er met zwaartekracht gerekend wordt). */
export function gInstructie(vragen: Vraag[], g: number): string | null {
  if (!vragen.some((q) => isFzVraag(q) || /zwaartekracht|\bfz\b/i.test(`${q.context ?? ""} ${q.stam}`) && /\d\s*kg\b/.test(`${q.context ?? ""} ${q.stam}`))) return null;
  return `Gebruik voor de zwaartekracht g = ${nl(g, g === 10 ? 0 : g === 9.8 ? 1 : 2)} N/kg.`;
}
