/** Oscilloscoopscherm (port van scope() in makefigs.py): raster in hokjes, sinus met amplitude en trillingstijd in hokjes. */
import type { OscilloscoopFiguur } from "../spec.ts";
import { leesSvg, paneelKolommen, punten, Svg } from "./svg.ts";

export function oscilloscoopSvg(f: OscilloscoopFiguur): string {
  const nx = f.hokjesX;
  const ny = f.hokjesY;
  const meer = f.panelen.length > 1;
  const u = meer ? 17 : 30; // pt per hokje (zoals f03 resp. f25)
  const kol = meer ? paneelKolommen(f.panelen.length) : 1;
  const rijen = Math.ceil(f.panelen.length / kol);
  const titel = meer ? 1.6 * u : 0;
  const gapX = meer ? 1.0 * u : 0;
  const gapY = meer ? 0.6 * u : 0;
  const marge = 6;
  const notitieRegels = meer && f.notitie ? f.notitie.split("\n").length : 0;
  const onder = (f.onderschrift ? 1.6 * u : 0) + (notitieRegels ? 0.4 * u + notitieRegels * 13.2 : 0);
  const W = marge * 2 + kol * nx * u + (kol - 1) * gapX;
  const H = marge * 2 + rijen * (titel + ny * u) + (rijen - 1) * gapY + onder;
  const s = new Svg(W, H);
  f.panelen.forEach((p, i) => {
    const c = i % kol;
    const r = Math.floor(i / kol);
    const x0 = marge + c * (nx * u + gapX);
    const y0 = marge + r * (titel + ny * u + gapY) + titel;
    const naam = p.label ?? "";
    s.groep(`data-rol="paneel" data-paneel="${naam}" data-hokjes="${nx}x${ny}"`, () => {
      if (meer && p.label) s.text(x0 + (nx * u) / 2, y0 - 0.45 * u, p.label, { size: 12, bold: true, anker: "middle" });
      s.rect(x0, y0, nx * u, ny * u, { fill: "#fff", kleur: "#000", lw: 1.5, rol: "scherm" });
      for (let k = 1; k < nx; k++) s.line(x0 + k * u, y0, x0 + k * u, y0 + ny * u, { kleur: "#bfbfbf", lw: 0.6, cap: "butt" });
      for (let k = 1; k < ny; k++) s.line(x0, y0 + k * u, x0 + nx * u, y0 + k * u, { kleur: "#bfbfbf", lw: 0.6, cap: "butt" });
      s.line(x0, y0 + (ny * u) / 2, x0 + nx * u, y0 + (ny * u) / 2, { kleur: "#8c8c8c", lw: 0.8, cap: "butt" });
      const n = 600;
      const pts: [number, number][] = [];
      for (let k = 0; k <= n; k++) {
        const x = (k / n) * nx;
        pts.push([x0 + x * u, y0 + (ny * u) / 2 - p.amplitude * Math.sin((2 * Math.PI * x) / p.trillingstijd) * u]);
      }
      s.polyline(pts, { lw: 1.8, rol: "signaal" });
    });
  });
  // Notitie bij een set panelen: als regel(s) onder het raster (geen losse cel, zodat 2 × 2 symmetrisch blijft).
  if (notitieRegels) s.text(W / 2, marge + rijen * (titel + ny * u) + (rijen - 1) * gapY + 0.4 * u, f.notitie!, { size: 11, anker: "middle", va: "top", rol: "notitie" });
  if (f.onderschrift) s.text(W / 2, H - marge - 0.55 * u, f.onderschrift, { size: 11, anker: "middle", rol: "onderschrift" });
  return s.toString(f.breedteCm, 'data-figuur="oscilloscoop"');
}

/**
 * Meet uit de SVG-geometrie: per paneel de amplitude (hokjes) en de trillingstijd (afstand tussen opgaande
 * nuldoorgangen, in hokjes); en de tijdbasis uit het onderschrift. Sleutels: "A", "T" (één paneel) of "B.A", "B.T".
 */
export function meetOscilloscoop(svg: string): Record<string, number> {
  const els = leesSvg(svg);
  const uit: Record<string, number> = {};
  const schermen = els.filter((e) => e.attrs["data-rol"] === "scherm");
  for (const sc of schermen) {
    const naam = sc.groep["data-paneel"] ?? "";
    const [nx, ny] = (sc.groep["data-hokjes"] ?? "10x8").split("x").map(Number);
    const x = Number(sc.attrs.x);
    const y = Number(sc.attrs.y);
    const ux = Number(sc.attrs.width) / nx;
    const uy = Number(sc.attrs.height) / ny;
    const sig = els.find((e) => e.attrs["data-rol"] === "signaal" && (e.groep["data-paneel"] ?? "") === naam);
    if (!sig) continue;
    const pts = punten(sig.attrs.points).map(([px, py]) => [(px - x) / ux, (y + (ny * uy) / 2 - py) / uy] as [number, number]);
    const ys = pts.map((p) => p[1]);
    const A = (Math.max(...ys) - Math.min(...ys)) / 2;
    const op: number[] = [];
    for (let k = 1; k < pts.length; k++) {
      const [x1, y1] = pts[k - 1];
      const [x2, y2] = pts[k];
      if (y1 < 0 && y2 >= 0) op.push(x1 + ((0 - y1) / (y2 - y1)) * (x2 - x1));
    }
    // Het begin (x = 0, y = 0, stijgend) telt ook als opgaande doorgang.
    if (Math.abs(pts[0][1]) < 1e-6 && pts[1][1] > 0) op.unshift(0);
    const T = op.length >= 2 ? (op[op.length - 1] - op[0]) / (op.length - 1) : NaN;
    const k = naam ? `${naam}.` : "";
    uit[`${k}A`] = Math.round(A * 100) / 100;
    uit[`${k}T`] = Math.round(T * 100) / 100;
  }
  const ond = els.find((e) => e.attrs["data-rol"] === "onderschrift");
  const m = ond?.tekst?.match(/=\s*([\d,.]+)\s*ms/);
  if (m) uit.tijdbasis = Number(m[1].replace(",", "."));
  uit.panelen = schermen.length;
  return uit;
}
