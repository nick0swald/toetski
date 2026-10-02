/**
 * Krachten op ware grootte (port van cm_fig/fig_22/fig_44/fig_55): 1 cm in de figuur = 1 cm op papier, de
 * pijllengte volgt exact uit de krachtenschaal (lengte = F / schaalN). Optioneel de parallellogramconstructie.
 */
import type { KrachtenFiguur } from "../spec.ts";
import { leesSvg, pijl, PT_PER_CM, ROOD, Svg } from "./svg.ts";

type P = [number, number];

export function krachtenSvg(f: KrachtenFiguur): string {
  const C = PT_PER_CM;
  const s = new Svg(f.breedteCm * C, f.hoogteCm * C);
  const X = (x: number) => x * C;
  const Y = (y: number) => (f.hoogteCm - y) * C;
  const [px, py] = f.punt;
  const poly = (pts: P[], fill: string, lw = 1.5) => s.polygon(pts.map(([x, y]) => [X(x), Y(y)]), { fill, kleur: "#000", lw });
  if (f.voorwerp === "bloempot") {
    // Coördinaten uit fig_22 (Z = (3,5; 4,9)), verschoven naar het aangrijpingspunt.
    const o = (x: number, y: number): P => [px + x - 3.5, py + y - 4.9];
    s.line(X(o(1, 8.6)[0]), Y(o(1, 8.6)[1]), X(o(6, 8.6)[0]), Y(o(6, 8.6)[1]), { lw: 3, cap: "butt" });
    s.line(X(o(3.5, 8.6)[0]), Y(o(3.5, 8.6)[1]), X(o(3.5, 8.0)[0]), Y(o(3.5, 8.0)[1]), { lw: 1.5 });
    for (const sg of [-1, 1]) s.line(X(o(3.5, 8)[0]), Y(o(3.5, 8)[1]), X(o(3.5 + sg * 1.3, 6.1)[0]), Y(o(3.5 + sg * 1.3, 6.1)[1]), { kleur: "#4d4d4d", lw: 1 });
    poly([o(2, 6.1), o(5, 6.1), o(4.5, 3.7), o(2.5, 3.7)], "#c8875a");
    s.polyline([o(2.4, 6.1), o(3, 7), o(3.5, 6.5), o(4, 7.2), o(4.6, 6.1)].map(([x, y]) => [X(x), Y(y)]), { kleur: "#3a7d2c", lw: 2 });
  } else if (f.voorwerp === "boomstam") {
    s.rect(X(px - 1.0), Y(py + 0.4), 1.0 * C, 0.8 * C, { fill: "#8b5a2b", kleur: "#000", lw: 1 });
  } else if (f.voorwerp === "krat") {
    s.rect(X(px - 2.0), Y(py + 1.2), 4.0 * C, 2.4 * C, { fill: "#e8c27a", kleur: "#000", lw: 1.5 });
    for (const dx of [-0.67, 0.67]) s.line(X(px + dx), Y(py + 1.2), X(px + dx), Y(py - 1.2), { lw: 0.8, cap: "butt" });
  }
  s.circle(X(px), Y(py), 2.5, { fill: "#000", rol: "aangrijpingspunt" });
  if (f.puntLabel) {
    if (f.voorwerp === "boomstam") s.text(X(px - 0.45), Y(py + 0.65), f.puntLabel, { size: 11, bold: true });
    else s.text(X(px + 0.25), Y(py + 0.05), f.puntLabel, { size: 12, bold: true });
  }
  const eind = (n: number, hoek: number): P => {
    const L = n / f.schaalN;
    return [px + L * Math.cos((hoek * Math.PI) / 180), py + L * Math.sin((hoek * Math.PI) / 180)];
  };
  const tekenPijl = (naam: string, tip: P, kleur: string, lw: number) =>
    pijl(s, X(px), Y(py), X(tip[0]), Y(tip[1]), { kleur, lw, kop: 0.4 * C, breed: 0.13 * C, rol: "pijl", extra: `data-naam="${naam}"` });
  for (const p of f.pijlen) {
    const tip = eind(p.grootteN, p.hoek);
    const kleur = p.rood ? ROOD : "#000";
    tekenPijl(p.naam, tip, kleur, p.rood ? 2.4 : 2.2);
    if (p.label) {
      const h = ((p.hoek % 360) + 360) % 360;
      const regels = p.label.split("\n").length;
      if (Math.abs(h - 270) < 20) s.text(X(px + 0.25), Y(tip[1] + 0.6 + 0.2 * (regels - 1)), p.label, { size: 11, kleur, va: "center" });
      else if (Math.abs(h - 90) < 20) s.text(X(px + 0.25), Y(tip[1] - 0.6), p.label, { size: 11, kleur, va: "center" });
      else if (h <= 20 || h >= 340) s.text(X(tip[0] + 0.1), Y(py - 0.45), p.label, { size: 10, kleur, va: "center" });
      else s.text(X(tip[0] - 0.15), Y(tip[1] + 0.05), p.label, { size: 10, kleur, anker: "end", va: "bottom" });
    }
  }
  if (f.resultante && f.pijlen.length >= 2) {
    const a = eind(f.pijlen[0].grootteN, f.pijlen[0].hoek);
    const b = eind(f.pijlen[1].grootteN, f.pijlen[1].hoek);
    const r: P = [a[0] + b[0] - px, a[1] + b[1] - py];
    s.line(X(a[0]), Y(a[1]), X(r[0]), Y(r[1]), { lw: 1, dash: "4 2.5", cap: "butt" });
    s.line(X(b[0]), Y(b[1]), X(r[0]), Y(r[1]), { lw: 1, dash: "4 2.5", cap: "butt" });
    tekenPijl("Fres", r, ROOD, 2.4);
    if (f.resultante.label) s.text(X(r[0] + 0.2), Y(r[1] - 0.2), f.resultante.label, { size: 10, kleur: ROOD, va: "center" });
  }
  return s.toString(f.breedteCm, `data-figuur="krachten" data-schaal="${f.schaalN}"`);
}

/**
 * Meet elke pijl uit de geometrie: begin van de steel tot de punt van de kop, in cm (1 cm = 28,35 pt).
 * Sleutels: "F1.lengteCm", "F1.N" (= lengte × krachtenschaal), "F1.hoek" (graden, 0 = rechts, 90 = omhoog),
 * en "breedteCm" (ware grootte: de breedte van de SVG op papier).
 */
export function meetKrachten(svg: string, schaalN: number): Record<string, number> {
  const els = leesSvg(svg);
  const uit: Record<string, number> = {};
  const namen = [...new Set(els.filter((e) => e.groep["data-rol"] === "pijl").map((e) => e.groep["data-naam"]))];
  for (const naam of namen) {
    const delen = els.filter((e) => e.groep["data-naam"] === naam);
    const steel = delen.find((e) => e.tag === "line");
    const kop = delen.find((e) => e.tag === "polygon");
    if (!steel || !kop) continue;
    const x1 = Number(steel.attrs.x1);
    const y1 = Number(steel.attrs.y1);
    const [tx, ty] = kop.attrs.points.split(" ")[0].split(",").map(Number);
    const L = Math.hypot(tx - x1, ty - y1) / PT_PER_CM;
    const hoek = (((Math.atan2(-(ty - y1), tx - x1) * 180) / Math.PI) + 360) % 360;
    uit[`${naam}.lengteCm`] = Math.round(L * 1000) / 1000;
    uit[`${naam}.N`] = Math.round(L * schaalN * 10) / 10;
    uit[`${naam}.hoek`] = Math.round(hoek * 10) / 10;
  }
  uit.pijlen = namen.length;
  const w = svg.match(/^<svg[^>]*width="([\d.]+)cm"/);
  if (w) uit.breedteCm = Number(w[1]);
  return uit;
}
