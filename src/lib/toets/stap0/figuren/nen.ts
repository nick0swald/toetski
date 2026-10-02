/**
 * Schakelsymbolen NEN-EN-IEC 60617 (zoals Binas), port van nen_symbols.py. Elk symbool staat op een rechte draad
 * p1→p2 en wordt in het midden getekend; de draad wordt aangevuld. Coördinaten in data-eenheden (y omhoog).
 * Om elk symbool staat <g data-symbool="…">, zodat de controle het in de SVG terugvindt.
 */
import type { NenSoort } from "../spec.ts";
import { Svg } from "./svg.ts";

export const LW = 1.8;
type P = [number, number];

export class Vlak {
  readonly s: Svg;
  readonly U: number;
  private x0: number;
  private y1: number;
  constructor(xmin: number, xmax: number, ymin: number, ymax: number, U = 30) {
    this.U = U;
    this.x0 = xmin;
    this.y1 = ymax;
    this.s = new Svg((xmax - xmin) * U, (ymax - ymin) * U);
  }
  X(x: number) {
    return (x - this.x0) * this.U;
  }
  Y(y: number) {
    return (this.y1 - y) * this.U;
  }
  pt(p: P): [number, number] {
    return [this.X(p[0]), this.Y(p[1])];
  }
  wire(pts: P[], kleur = "#000", lw = LW) {
    this.s.polyline(pts.map((p) => this.pt(p)), { kleur, lw, rol: "draad" });
  }
  seg(a: P, b: P, kleur = "#000", lw = LW, cap = "round") {
    this.s.line(this.X(a[0]), this.Y(a[1]), this.X(b[0]), this.Y(b[1]), { kleur, lw, cap });
  }
  poly(pts: P[], o: { fill?: string; kleur?: string; lw?: number }) {
    this.s.polygon(pts.map((p) => this.pt(p)), { fill: o.fill, kleur: o.kleur, lw: o.lw ?? LW });
  }
  cirkel(c: P, r: number, o: { fill?: string; kleur?: string; lw?: number; rol?: string }) {
    this.s.circle(this.X(c[0]), this.Y(c[1]), r * this.U, { ...o, lw: o.lw ?? LW });
  }
  tekst(p: P, t: string, o: Parameters<Svg["text"]>[3]) {
    this.s.text(this.X(p[0]), this.Y(p[1]), t, o);
  }
}

class Frame {
  p1: P;
  p2: P;
  u: P;
  v: P;
  c: P;
  constructor(p1: P, p2: P) {
    this.p1 = p1;
    this.p2 = p2;
    const d: P = [p2[0] - p1[0], p2[1] - p1[1]];
    const L = Math.hypot(d[0], d[1]);
    this.u = [d[0] / L, d[1] / L];
    this.v = [-this.u[1], this.u[0]];
    this.c = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  }
  P(a: number, b = 0): P {
    return [this.c[0] + a * this.u[0] + b * this.v[0], this.c[1] + a * this.u[1] + b * this.v[1]];
  }
}

function leads(t: Vlak, f: Frame, half: number, kleur: string) {
  t.wire([f.p1, f.P(-half)], kleur);
  t.wire([f.P(half), f.p2], kleur);
}

function label(t: Vlak, f: Frame, text: string | undefined, side: number, dist: number, kleur: string, fs = 11) {
  if (!text) return;
  const p = f.P(0, side * dist);
  let anker: "start" | "middle" | "end" = "middle";
  if (Math.abs(f.v[0]) > 0.5) anker = side * f.v[0] > 0 ? "start" : "end";
  let va: "center" | "bottom" | "top" = "center";
  if (Math.abs(f.v[1]) > 0.5) va = side * f.v[1] > 0 ? "bottom" : "top";
  t.tekst(p, text, { size: fs, anker, va, kleur, rol: "label" });
}

function rect(t: Vlak, f: Frame, L: number, W: number, kleur: string) {
  t.poly([f.P(-L / 2, -W / 2), f.P(L / 2, -W / 2), f.P(L / 2, W / 2), f.P(-L / 2, W / 2)], { fill: "#fff", kleur });
}

/** Pijl van a naar b met gevulde kop (zoals matplotlib -|>). */
function pijlData(t: Vlak, a: P, b: P, kleur: string, lw: number, kop: number, breed: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  const u: P = [dx / L, dy / L];
  const base: P = [b[0] - u[0] * kop, b[1] - u[1] * kop];
  t.seg(a, base, kleur, lw, "butt");
  t.poly(
    [b, [base[0] - u[1] * breed, base[1] + u[0] * breed], [base[0] + u[1] * breed, base[1] - u[0] * breed]],
    { fill: kleur, kleur, lw: 0.5 },
  );
}

export interface SymboolOpties {
  label?: string;
  side?: number;
  kleur?: string;
  /** Alleen bij cel: + aan de kant van p2 (standaard). */
  plusBijP2?: boolean;
  toonPlus?: boolean;
}

export function symbool(t: Vlak, soort: NenSoort, p1: P, p2: P, o: SymboolOpties = {}) {
  const kleur = o.kleur ?? "#000";
  const side = o.side ?? 1;
  const f = new Frame(p1, p2);
  t.s.groep(`data-symbool="${soort}"${o.label ? ` data-label="${o.label.replace(/"/g, "")}"` : ""}`, () => {
    switch (soort) {
      case "weerstand":
      case "variabele-weerstand": {
        leads(t, f, 0.45, kleur);
        rect(t, f, 0.9, 0.34, kleur);
        if (soort === "variabele-weerstand") {
          pijlData(t, f.P(-0.45, -0.4), f.P(0.5, 0.45), kleur, 1.4, 0.22, 0.09);
          label(t, f, o.label, side, 0.6, kleur);
        } else label(t, f, o.label, side, 0.4, kleur);
        break;
      }
      case "zekering": {
        leads(t, f, 0.45, kleur);
        rect(t, f, 0.9, 0.3, kleur);
        t.seg(f.P(-0.45), f.P(0.45), kleur);
        label(t, f, o.label, side, 0.4, kleur);
        break;
      }
      case "lamp": {
        const r = 0.32;
        leads(t, f, r, kleur);
        t.cirkel(f.c, r, { fill: "#fff", kleur });
        const k = r / Math.SQRT2;
        for (const sg of [1, -1]) t.seg([f.c[0] - k, f.c[1] - sg * k], [f.c[0] + k, f.c[1] + sg * k], kleur);
        label(t, f, o.label, side, 0.45, kleur);
        break;
      }
      case "spanningsmeter":
      case "stroommeter":
      case "motor": {
        const r = 0.32;
        leads(t, f, r, kleur);
        t.cirkel(f.c, r, { fill: "#fff", kleur });
        const letter = soort === "motor" ? "M" : soort === "stroommeter" ? "A" : "V";
        t.tekst(f.c, letter, { size: 12, bold: true, anker: "middle", va: "center", kleur });
        label(t, f, o.label, side, 0.45, kleur);
        break;
      }
      case "wisselbron": {
        const r = 0.32;
        leads(t, f, r, kleur);
        t.cirkel(f.c, r, { fill: "#fff", kleur });
        const pts: P[] = [];
        for (let i = 0; i <= 40; i++) {
          const x = -0.18 + (0.36 * i) / 40;
          pts.push([f.c[0] + x, f.c[1] + 0.08 * Math.sin((x / 0.18) * Math.PI)]);
        }
        t.s.polyline(pts.map((p) => t.pt(p)), { kleur, lw: 1.5 });
        label(t, f, o.label, side, 0.45, kleur);
        break;
      }
      case "cel": {
        const g = 0.09;
        const sp = o.plusBijP2 === false ? -1 : 1;
        t.wire([f.p1, f.P(-g)], kleur);
        t.wire([f.P(g), f.p2], kleur);
        t.seg(f.P(sp * g, -0.34), f.P(sp * g, 0.34), kleur, 1.6, "butt");
        t.seg(f.P(-sp * g, -0.16), f.P(-sp * g, 0.16), kleur, 4.0, "butt");
        if (o.toonPlus !== false) t.tekst(f.P(sp * (g + 0.17), -0.42), "+", { size: 9, anker: "middle", va: "center", kleur });
        label(t, f, o.label, side, 0.55, kleur);
        break;
      }
      case "schakelaar": {
        const h = 0.4;
        t.wire([f.p1, f.P(-h)], kleur);
        t.wire([f.P(h), f.p2], kleur);
        const tip = side === 1 ? f.P(h + 0.05, -0.38) : f.P(h + 0.05, 0.38);
        t.wire([f.P(-h), tip], kleur);
        t.seg(f.P(h, 0), f.P(h, side === 1 ? -0.12 : 0.12), kleur);
        label(t, f, o.label, side, 0.45, kleur);
        break;
      }
      case "diode":
      case "led": {
        const sz = 0.28;
        leads(t, f, sz, kleur);
        t.poly([f.P(-sz, -sz), f.P(-sz, sz), f.P(sz, 0)], { fill: "#fff", kleur });
        t.seg(f.P(sz, -sz), f.P(sz, sz), kleur);
        if (soort === "led") for (const d of [-0.05, 0.17]) pijlData(t, f.P(d, sz + 0.05), f.P(d + 0.3, sz + 0.35), kleur, 1.2, 0.14, 0.06);
        label(t, f, o.label, -side, 0.5, kleur);
        break;
      }
    }
  });
}

export function stip(t: Vlak, p: P, kleur = "#000") {
  t.cirkel(p, 0.07, { fill: kleur, kleur, lw: 0.5, rol: "stip" });
}
