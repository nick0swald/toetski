/**
 * Maatcilinder(s) (port van cylinder() in makefigs.py), maar met exacte waarden: het niveau wordt getekend op
 * precies de opgegeven waarde (62 mL staat op 62, niet op 60), de schaal volgt `max`/`streep`/`getalElke`.
 */
import type { MaatcilinderFiguur } from "../spec.ts";
import { BLAUW, leesSvg, Svg } from "./svg.ts";

const U = 32; // pt per eenheid (zoals f05: 1 mL = 0,16 eenheid bij max 50)

export function maatcilinderSvg(f: MaatcilinderFiguur): string {
  const hoogte = 8.0; // eenheden voor `max`
  const sc = hoogte / f.max; // eenheden per mL
  const top = f.max * 1.1 * sc;
  const w = 1.6;
  const stap = 3.2;
  const n = f.cilinders.length;
  const xmin = -0.6;
  const xmax = (n - 1) * stap + w + 0.6 + 0.6;
  const ymin = -1.1;
  const ymax = top + 0.75;
  const W = (xmax - xmin) * U;
  const H = (ymax - ymin) * U;
  const X = (x: number) => (x - xmin) * U;
  const Y = (y: number) => (ymax - y) * U;
  const s = new Svg(W, H);
  f.cilinders.forEach((c, i) => {
    const x0 = i * stap;
    s.groep(`data-rol="cilinder" data-index="${i + 1}"`, () => {
      s.rect(X(x0 - 0.35), Y(0), (w + 0.7) * U, 0.25 * U, { fill: "#999999", kleur: "#000", lw: 1 });
      const lv = Math.min(c.niveau, f.max * 1.1) * sc;
      s.rect(X(x0), Y(lv), w * U, lv * U, { fill: "#bcd9f2", rol: "vloeistof" });
      s.line(X(x0), Y(0), X(x0), Y(top), { lw: 1.5, cap: "butt" });
      s.line(X(x0 + w), Y(0), X(x0 + w), Y(top), { lw: 1.5, cap: "butt" });
      s.line(X(x0), Y(0), X(x0 + w), Y(0), { lw: 1.5 });
      s.line(X(x0), Y(lv), X(x0 + w), Y(lv), { kleur: BLAUW, lw: 1.6, cap: "butt", rol: "niveau" });
      const half = f.getalElke / 2;
      const aantal = Math.round(f.max / f.streep);
      for (let k = 0; k <= aantal; k++) {
        const ml = k * f.streep;
        const y = ml * sc;
        const isGetal = Math.abs(ml / f.getalElke - Math.round(ml / f.getalElke)) < 1e-9;
        const isHalf = Math.abs(ml / half - Math.round(ml / half)) < 1e-9;
        const L = isGetal ? 0.45 : isHalf ? 0.32 : 0.18;
        s.line(X(x0), Y(y), X(x0 + L), Y(y), { lw: 0.7, cap: "butt" });
        if (isGetal && ml > 0) s.text(X(x0 + 0.5), Y(y), String(Math.round(ml * 1000) / 1000).replace(".", ","), { size: 8, va: "center", rol: "schaalgetal" });
      }
      s.text(X(x0 + 0.5), Y(top + 0.2), "mL", { size: 9, anker: "middle" });
      if (c.voorwerp) {
        const yb = Math.min(0.4, lv / 4);
        s.line(X(x0 + 1.3), Y(yb + 1.0), X(x0 + 1.3), Y(top + 0.6), { kleur: "#4d4d4d", lw: 1 });
        s.rect(X(x0 + 1.1), Y(yb + 1.0), 0.4 * U, 1.0 * U, { fill: "#595959", kleur: "#000", lw: 1, rol: "voorwerp" });
      }
      if (c.label) s.text(X(x0 + w / 2), Y(-0.75), c.label, { size: 11, bold: true, anker: "middle", va: "baseline" });
    });
  });
  return s.toString(f.breedteCm, 'data-figuur="maatcilinder"');
}

/**
 * Leest het niveau af zoals een leerling: de schaalgetallen (tekst + hoogte) bepalen de schaal, de vloeistofspiegel
 * (data-rol="niveau") wordt daarmee omgerekend naar mL. Sleutels: niveau1, niveau2, … en max (hoogste schaalgetal).
 */
export function meetMaatcilinder(svg: string): Record<string, number> {
  const els = leesSvg(svg);
  const uit: Record<string, number> = {};
  const indices = [...new Set(els.map((e) => e.groep["data-index"]).filter(Boolean))];
  for (const idx of indices) {
    const binnen = els.filter((e) => e.groep["data-index"] === idx);
    const pos = binnen
      .filter((e) => e.attrs["data-rol"] === "schaalgetal")
      .map((e) => ({ v: Number((e.tekst ?? "").replace(",", ".")), y: Number(e.attrs.y) }))
      .sort((p, q) => p.v - q.v);
    if (pos.length < 2) continue;
    const a = pos[0];
    const b = pos[pos.length - 1];
    // Schaalgetallen staan verticaal gecentreerd (va center: y = streep + 0,36·size); de streep zelf ligt 2,88 pt hoger.
    const yStreep = (p: { y: number }) => p.y - 8 * 0.36;
    const perMl = (yStreep(b) - yStreep(a)) / (b.v - a.v);
    const niv = binnen.find((e) => e.attrs["data-rol"] === "niveau");
    if (!niv) continue;
    const yN = Number(niv.attrs.y1);
    uit[`niveau${idx}`] = Math.round((a.v + (yN - yStreep(a)) / perMl) * 100) / 100;
    uit.max = Math.max(uit.max ?? 0, ...pos.map((p) => p.v));
  }
  return uit;
}

