/** Ladderschema met NEN-symbolen (zoals make_nen_figs.py f09/f14/f60): bron links, parallelle takken rechts. */
import type { SchakelschemaFiguur } from "../spec.ts";
import { leesSvg } from "./svg.ts";
import { ROOD } from "./svg.ts";
import { stip, symbool, Vlak } from "./nen.ts";

export function schakelschemaSvg(f: SchakelschemaFiguur): string {
  const langLabel = f.takken.some((t) => t.onderdelen.some((o) => (o.label ?? "").includes("=")));
  const dubbel = f.takken.some((t) => t.onderdelen.length > 1);
  const yt = dubbel ? 4 : 3;
  const yb = 0;
  const xb = 0;
  const dx = langLabel ? 3.4 : 2.3;
  const xs = f.takken.map((_, i) => 2.2 + i * dx);
  const side = langLabel ? 1 : -1;
  const xLast = xs[xs.length - 1];
  const xmin = -1.4;
  const xmax = xLast + (langLabel ? 2.1 : 0.5) + (f.vrijeRuimte ? 2.2 : 0);
  const t = new Vlak(xmin, xmax, -0.5, yt + 0.5);
  const ym = yt / 2;
  const half = dubbel ? 0.8 : 0.8;
  symbool(t, f.bron.soort, [xb, ym - half], [xb, ym + half], { label: f.bron.label, side: 1 });
  t.wire([[xb, ym + half], [xb, yt], [xs[0], yt]]);
  t.wire([[xb, ym - half], [xb, yb], [xs[0], yb]]);
  f.takken.forEach((tak, i) => {
    const x = xs[i];
    const kleur = tak.rood ? ROOD : "#000";
    t.s.groep(`data-tak="${i + 1}"`, () => {
      if (i > 0) {
        t.wire([[xs[i - 1], yt], [x, yt]], kleur);
        t.wire([[xs[i - 1], yb], [x, yb]], kleur);
      }
      const n = tak.onderdelen.length;
      // Grenzen tussen de onderdelen: bij 2 onderdelen ligt de scheiding op 0,55·hoogte.
      const grenzen = n === 1 ? [yt, yb] : n === 2 ? [yt, yb + 0.55 * (yt - yb), yb] : [yt, yb + 0.7 * (yt - yb), yb + 0.35 * (yt - yb), yb];
      tak.onderdelen.forEach((o, j) => {
        symbool(t, o.soort, [x, grenzen[j]], [x, grenzen[j + 1]], { label: o.label, side, kleur: o.rood || tak.rood ? ROOD : "#000" });
      });
    });
  });
  for (let i = 0; i < xs.length - 1; i++) {
    stip(t, [xs[i], yt]);
    stip(t, [xs[i], yb]);
  }
  return t.s.toString(f.breedteCm, 'data-figuur="schakelschema"');
}

/**
 * Meet uit de SVG: aantal symbolen per soort ("aantal.lamp"), takken, verbindingsstippen, en de getallen uit de
 * labels ("R1 = 40 Ω" → R1 = 40; bronlabel "12 V" → U = 12).
 */
export function meetSchakelschema(svg: string): Record<string, number> {
  const els = leesSvg(svg);
  const uit: Record<string, number> = {};
  const symbolen = svg.match(/data-symbool="([a-z-]+)"/g) ?? [];
  for (const s of symbolen) {
    const k = `aantal.${s.slice(14, -1)}`;
    uit[k] = (uit[k] ?? 0) + 1;
  }
  uit.takken = new Set((svg.match(/data-tak="\d+"/g) ?? [])).size;
  uit.stippen = els.filter((e) => e.attrs["data-rol"] === "stip").length;
  for (const e of els.filter((x) => x.attrs["data-rol"] === "label")) {
    const t = (e.tekst ?? "").trim();
    const m = t.match(/^([A-Za-z]+\d*)\s*=\s*([\d,.]+)/);
    if (m) uit[m[1]] = Number(m[2].replace(",", "."));
    const v = t.match(/^([\d,.]+)\s*V$/);
    if (v && (e.groep["data-symbool"] === "cel" || e.groep["data-symbool"] === "wisselbron")) uit.U = Number(v[1].replace(",", "."));
  }
  return uit;
}
