/**
 * Cijferberekening met normeringsterm N (CvTE-regels): cijfer = 9 · S / L + N, met
 *  - N > 1: cijfer ≤ 1 + S · (9/L) · 2  en  cijfer ≤ 10 − (L − S) · (9/L) · 0,5
 *  - N < 1: cijfer ≥ 1 + S · (9/L) · 0,5  en  cijfer ≥ 10 − (L − S) · (9/L) · 2
 * Standaard N = 1: cijfer = 1 + 9 · S / L. Afgerond op 1 decimaal (via roundCijfer uit cijfer.ts).
 */
import { nlCijfer, roundCijfer } from "../cijfer.ts";
import { leesSvg, punten, schaal, Svg } from "./figuren/svg.ts";

export function cijferN(score: number, max: number, n = 1): number {
  if (max <= 0) return 1;
  const S = Math.max(0, Math.min(max, score));
  const L = max;
  let c = (9 * S) / L + n;
  if (n > 1) c = Math.min(c, 1 + S * (9 / L) * 2, 10 - (L - S) * (9 / L) * 0.5);
  if (n < 1) c = Math.max(c, 1 + S * (9 / L) * 0.5, 10 - (L - S) * (9 / L) * 2);
  return roundCijfer(c);
}

export function cijferTabel(max: number, n = 1): { score: number; cijfer: number }[] {
  return Array.from({ length: max + 1 }, (_, s) => ({ score: s, cijfer: cijferN(s, max, n) }));
}

/** Laagste score met een voldoende (≥ 5,5). */
export function cesuur(max: number, n = 1): number {
  return cijferTabel(max, n).find((r) => r.cijfer >= 5.5)?.score ?? max;
}

export function formule(max: number, n = 1): string {
  const nn = nlCijfer(n).replace(/,0$/, ",0");
  return `cijfer = 9 × score / ${max} + ${nn}${n !== 1 ? " (met de CvTE-grenzen voor N ≠ 1)" : ""}, afgerond op één decimaal`;
}

/** Grafiek cijfer tegen score (deterministische SVG, matplotlib-stijl). */
export function cijferGrafiekSvg(max: number, n = 1, breedteCm = 12): string {
  const W = 5.8 * 72;
  const H = 3.4 * 72;
  const L = 34, R = 12, T = 10, B = 36;
  const s = new Svg(W, H);
  const X = schaal(0, max, L, W - R);
  const Y = schaal(1, 10, H - B, T);
  s.rect(L, T, W - L - R, H - T - B, { rol: "assen", extra: `data-x="0 ${max}" data-y="1 10"` });
  const xstap = max <= 20 ? 2 : max <= 40 ? 5 : 10;
  for (let v = 0; v <= max; v += xstap) {
    s.line(X(v), T, X(v), H - B, { kleur: "#cccccc", lw: 0.6, cap: "butt" });
    s.line(X(v), H - B, X(v), H - B + 3.5, { lw: 0.8, cap: "butt" });
    s.text(X(v), H - B + 15, String(v), { size: 10, anker: "middle" });
  }
  for (let c = 1; c <= 10; c++) {
    s.line(L, Y(c), W - R, Y(c), { kleur: "#cccccc", lw: 0.6, cap: "butt" });
    s.line(L - 3.5, Y(c), L, Y(c), { lw: 0.8, cap: "butt" });
    s.text(L - 6, Y(c), String(c), { size: 10, anker: "end", va: "center" });
  }
  s.rect(L, T, W - L - R, H - T - B, { kleur: "#000", lw: 0.8 });
  s.line(L, Y(5.5), W - R, Y(5.5), { kleur: "#c0392b", lw: 0.9, dash: "4 3", cap: "butt" });
  s.text(W - R - 4, Y(5.5) - 4, "5,5", { size: 9, anker: "end", kleur: "#c0392b" });
  // Exacte (onafgeronde) kromme in kleine stappen + de afgeronde tabelwaarden als punten.
  const pts: [number, number][] = [];
  for (let k = 0; k <= 200; k++) {
    const sc = (k / 200) * max;
    const c = (9 * sc) / max + n;
    let v = c;
    if (n > 1) v = Math.min(c, 1 + sc * (9 / max) * 2, 10 - (max - sc) * (9 / max) * 0.5);
    if (n < 1) v = Math.max(c, 1 + sc * (9 / max) * 0.5, 10 - (max - sc) * (9 / max) * 2);
    pts.push([X(sc), Y(Math.min(10, Math.max(1, v)))]);
  }
  s.polyline(pts, { lw: 1.8, rol: "kromme" });
  s.groep('data-rol="tabelpunten"', () => {
    for (const r of cijferTabel(max, n)) s.circle(X(r.score), Y(r.cijfer), 1.6, { fill: "#1f5f99", rol: "punt" });
  });
  const cs = cesuur(max, n);
  s.circle(X(cs), Y(cijferN(cs, max, n)), 3.5, { kleur: "#c0392b", lw: 1.4 });
  s.text(X(cs) + 6, Y(cijferN(cs, max, n)) + 14, `cesuur: ${cs} p → ${nlCijfer(cijferN(cs, max, n))}`, { size: 9, kleur: "#c0392b" });
  s.text((L + W - R) / 2, H - 4, "score (punten)", { size: 10, anker: "middle" });
  s.add(`<g transform="translate(11 ${((T + H - B) / 2).toFixed(1)}) rotate(-90)">`);
  s.text(0, 0, "cijfer", { size: 10, anker: "middle" });
  s.add("</g>");
  return s.toString(breedteCm, 'data-figuur="cijfergrafiek"');
}

/** Leest de tabelpunten terug uit de grafiek (score, cijfer) — voor de controle in code. */
export function leesCijferGrafiek(svg: string): [number, number][] {
  const els = leesSvg(svg);
  const a = els.find((e) => e.attrs["data-rol"] === "assen")!;
  const [x0, x1] = a.attrs["data-x"].split(" ").map(Number);
  const [y0, y1] = a.attrs["data-y"].split(" ").map(Number);
  const px = Number(a.attrs.x), py = Number(a.attrs.y), w = Number(a.attrs.width), h = Number(a.attrs.height);
  const X = schaal(px, px + w, x0, x1);
  const Y = schaal(py + h, py, y0, y1);
  const kromme = els.find((e) => e.attrs["data-rol"] === "kromme");
  void punten(kromme?.attrs.points ?? "0,0");
  return els.filter((e) => e.attrs["data-rol"] === "punt").map((e) => [Math.round(X(Number(e.attrs.cx)) * 100) / 100, Math.round(Y(Number(e.attrs.cy)) * 100) / 100]);
}

/** Controle: tabel = formule en grafiek = tabel. Leeg = in orde. */
export function controleerCijfers(max: number, n = 1): string[] {
  const f: string[] = [];
  const t = cijferTabel(max, n);
  if (t[0].cijfer !== 1) f.push(`cijfer bij 0 punten is ${t[0].cijfer}`);
  if (t[max].cijfer !== 10) f.push(`cijfer bij ${max} punten is ${t[max].cijfer}`);
  for (let i = 1; i < t.length; i++) if (t[i].cijfer < t[i - 1].cijfer) f.push(`tabel daalt bij ${i}`);
  const g = leesCijferGrafiek(cijferGrafiekSvg(max, n));
  if (g.length !== t.length) f.push(`grafiek heeft ${g.length} punten, tabel ${t.length}`);
  g.forEach(([sc, c], i) => {
    if (Math.abs(sc - t[i].score) > 0.02 || Math.abs(c - t[i].cijfer) > 0.02) f.push(`grafiekpunt ${i}: (${sc}; ${c}) ≠ tabel (${t[i].score}; ${t[i].cijfer})`);
  });
  return f;
}
