/**
 * Grafieken in matplotlib-stijl (port van fig_36/fig_12/fig_43 in makefigs.py): diagram met raster en assen,
 * reeksen als rechte lijn, vloeiende (monotone) kromme of meetpunten (×), of kleine (v,t)-panelen zonder getallen.
 */
import type { As, GrafiekFiguur } from "../spec.ts";
import { leesSvg, paneelKolommen, punten, ROOD, schaal, Svg } from "./svg.ts";

const nlGetal = (v: number) => String(Math.round(v * 1000) / 1000).replace(".", ",");

function ticks(a: As, stap: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(a.min / stap - 1e-9) * stap;
  for (let v = start; v <= a.max + 1e-9; v += stap) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Monotone kubische interpolatie (Fritsch–Carlson, zoals scipy PchipInterpolator). */
export function pchip(pts: [number, number][], n = 160): [number, number][] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const k = xs.length;
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  const d = h.map((hi, i) => (ys[i + 1] - ys[i]) / hi);
  const m = new Array(k).fill(0);
  for (let i = 1; i < k - 1; i++) {
    if (d[i - 1] * d[i] > 0) {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  const eind = (h0: number, h1: number, d0: number, d1: number) => {
    let v = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (Math.sign(v) !== Math.sign(d0)) v = 0;
    else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(v) > Math.abs(3 * d0)) v = 3 * d0;
    return v;
  };
  if (k > 2) {
    m[0] = eind(h[0], h[1], d[0], d[1]);
    m[k - 1] = eind(h[k - 2], h[k - 3], d[k - 2], d[k - 3]);
  } else m[0] = m[1] = d[0];
  const out: [number, number][] = [];
  for (let s = 0; s <= n; s++) {
    const x = xs[0] + ((xs[k - 1] - xs[0]) * s) / n;
    let i = Math.min(k - 2, Math.max(0, xs.findIndex((xv, j) => j < k - 1 && x >= xv && x <= xs[j + 1])));
    if (i < 0) i = 0;
    const t = (x - xs[i]) / h[i];
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
    const h10 = t ** 3 - 2 * t ** 2 + t;
    const h01 = -2 * t ** 3 + 3 * t ** 2;
    const h11 = t ** 3 - t ** 2;
    out.push([x, h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1]]);
  }
  return out;
}

export function grafiekSvg(f: GrafiekFiguur): string {
  return f.panelen?.length ? panelenSvg(f) : diagramSvg(f);
}

function diagramSvg(f: GrafiekFiguur): string {
  const W = 5.8 * 72;
  const fijnRaster = Boolean(f.x.fijn || f.y.fijn);
  const H = (fijnRaster ? 4.4 : 3.6) * 72;
  const yLabels = ticks(f.y, f.y.stap).map(nlGetal);
  const breedsteY = f.y.zonderGetallen ? 0 : Math.max(...yLabels.map((l) => l.length));
  const L = 30 + breedsteY * 6.2;
  const R = 12;
  const T = 8;
  const B = 38;
  const s = new Svg(W, H);
  const X = schaal(f.x.min, f.x.max, L, W - R);
  const Y = schaal(f.y.min, f.y.max, H - B, T);
  s.rect(L, T, W - L - R, H - T - B, { rol: "assen", extra: `data-x="${f.x.min} ${f.x.max}" data-y="${f.y.min} ${f.y.max}"` });
  if (fijnRaster) {
    for (const v of ticks(f.x, f.x.fijn ?? f.x.stap)) s.line(X(v), T, X(v), H - B, { kleur: "#e0e0e0", lw: 0.5, cap: "butt" });
    for (const v of ticks(f.y, f.y.fijn ?? f.y.stap)) s.line(L, Y(v), W - R, Y(v), { kleur: "#e0e0e0", lw: 0.5, cap: "butt" });
  }
  const grof = fijnRaster ? { kleur: "#a6a6a6", lw: 0.7 } : { kleur: "#cccccc", lw: 0.6 };
  for (const v of ticks(f.x, f.x.stap)) s.line(X(v), T, X(v), H - B, { ...grof, cap: "butt" });
  for (const v of ticks(f.y, f.y.stap)) s.line(L, Y(v), W - R, Y(v), { ...grof, cap: "butt" });
  s.rect(L, T, W - L - R, H - T - B, { kleur: "#000", lw: 0.8 });
  for (const v of ticks(f.x, f.x.stap)) {
    s.line(X(v), H - B, X(v), H - B + 3.5, { lw: 0.8, cap: "butt" });
    if (!f.x.zonderGetallen) s.text(X(v), H - B + 15, nlGetal(v), { size: 11, anker: "middle", rol: "xgetal", extra: `data-v="${v}"` });
  }
  for (const v of ticks(f.y, f.y.stap)) {
    s.line(L - 3.5, Y(v), L, Y(v), { lw: 0.8, cap: "butt" });
    if (!f.y.zonderGetallen) s.text(L - 6, Y(v), nlGetal(v), { size: 11, anker: "end", va: "center", rol: "ygetal", extra: `data-v="${v}"` });
  }
  s.text((L + W - R) / 2, H - 6, f.x.label, { size: 11, anker: "middle" });
  s.add(`<g transform="translate(13 ${((T + H - B) / 2).toFixed(2)}) rotate(-90)">`);
  s.text(0, 0, f.y.label, { size: 11, anker: "middle" });
  s.add("</g>");
  f.reeksen.forEach((r, i) => {
    const kleur = r.rood ? ROOD : "#000";
    if (r.vorm === "punten") {
      s.groep(`data-rol="meetpunten" data-reeks="${i + 1}"`, () => {
        for (const [x, y] of r.punten) {
          const k = 4;
          s.line(X(x) - k, Y(y) - k, X(x) + k, Y(y) + k, { kleur, lw: 2, cap: "butt" });
          s.line(X(x) - k, Y(y) + k, X(x) + k, Y(y) - k, { kleur, lw: 2, cap: "butt", rol: "kruis" });
        }
      });
    } else {
      const pts = r.vorm === "vloeiend" ? pchip(r.punten) : r.punten;
      s.polyline(pts.map(([x, y]) => [X(x), Y(y)]), { kleur, lw: r.rood ? 1.8 : 2, rol: "reeks", extra: `data-reeks="${i + 1}"` });
    }
  });
  return s.toString(f.breedteCm, 'data-figuur="grafiek"');
}

function panelenSvg(f: GrafiekFiguur): string {
  const p = f.panelen!;
  // Even grote cellen; 4 panelen als 2 × 2 (A B / C D), zie paneelKolommen.
  const kol = paneelKolommen(p.length);
  const rijen = Math.ceil(p.length / kol);
  const cw = 2.25 * 72;
  const ch = 2.0 * 72;
  const W = kol * cw;
  const H = rijen * ch;
  const s = new Svg(W, H);
  p.forEach((pan, i) => {
    const c = i % kol;
    const r = Math.floor(i / kol);
    const L = c * cw + 26;
    const R = (c + 1) * cw - 10;
    const T = r * ch + 24;
    const B = (r + 1) * ch - 26;
    const X = schaal(f.x.min, f.x.max, L, R);
    const Y = schaal(f.y.min, f.y.max, B, T);
    s.groep(`data-rol="paneel" data-paneel="${pan.label}"`, () => {
      s.rect(L, T, R - L, B - T, { rol: "assen", extra: `data-x="${f.x.min} ${f.x.max}" data-y="${f.y.min} ${f.y.max}"` });
      s.text((L + R) / 2, T - 8, pan.label, { size: 12, bold: true, anker: "middle" });
      s.line(L, T, L, B, { lw: 0.8, cap: "butt" });
      s.line(L, B, R, B, { lw: 0.8, cap: "butt" });
      s.polyline(pan.punten.map(([x, y]) => [X(x), Y(y)]), { lw: 2, rol: "reeks", extra: 'data-reeks="1"' });
      s.text((L + R) / 2, B + 17, f.x.label, { size: 11, anker: "middle" });
      s.add(`<g transform="translate(${(L - 9).toFixed(2)} ${((T + B) / 2).toFixed(2)}) rotate(-90)">`);
      s.text(0, 0, f.y.label, { size: 11, anker: "middle" });
      s.add("</g>");
    });
  });
  return s.toString(f.breedteCm, 'data-figuur="grafiek"');
}

/**
 * Meet uit de SVG-geometrie (pt → data via het assen-kader): "y@x" (eerste reeks, meetpunten of lijn), "reeksen",
 * en bij panelen "C.trend" (−1 dalend, 0 constant, 1 stijgend) en "C.eind" (laatste v). Controleert ook dat de
 * asgetallen op de juiste plek staan ("asfouten").
 */
export function meetGrafiek(svg: string, vraagX: number[] = []): Record<string, number> {
  const els = leesSvg(svg);
  const uit: Record<string, number> = {};
  const assen = els.filter((e) => e.attrs["data-rol"] === "assen");
  const kader = (e: (typeof els)[number]) => {
    const [x0, x1] = e.attrs["data-x"].split(" ").map(Number);
    const [y0, y1] = e.attrs["data-y"].split(" ").map(Number);
    const px = Number(e.attrs.x);
    const py = Number(e.attrs.y);
    const w = Number(e.attrs.width);
    const h = Number(e.attrs.height);
    return { X: schaal(px, px + w, x0, x1), Y: schaal(py + h, py, y0, y1) };
  };
  let asfouten = 0;
  if (assen.length === 1) {
    const k = kader(assen[0]);
    for (const e of els.filter((x) => x.attrs["data-rol"] === "ygetal")) {
      const v = Number((e.tekst ?? "").replace(",", "."));
      const yv = k.Y(Number(e.attrs.y) - 11 * 0.36);
      if (Math.abs(yv - v) > 1e-3 * Math.max(1, Math.abs(v))) asfouten++;
    }
    for (const e of els.filter((x) => x.attrs["data-rol"] === "xgetal")) {
      const v = Number((e.tekst ?? "").replace(",", "."));
      if (Math.abs(k.X(Number(e.attrs.x)) - v) > 1e-3 * Math.max(1, Math.abs(v))) asfouten++;
    }
    const kruisen = els.filter((e) => e.attrs["data-rol"] === "kruis" && e.groep["data-reeks"] === "1");
    const lijn = els.find((e) => e.attrs["data-rol"] === "reeks" && e.attrs["data-reeks"] === "1");
    let data: [number, number][] = [];
    if (kruisen.length) data = kruisen.map((e) => [k.X((Number(e.attrs.x1) + Number(e.attrs.x2)) / 2), k.Y((Number(e.attrs.y1) + Number(e.attrs.y2)) / 2)]);
    else if (lijn) data = punten(lijn.attrs.points).map(([x, y]) => [k.X(x), k.Y(y)]);
    data.sort((a, b) => a[0] - b[0]);
    const xs = new Set([...vraagX, ...data.map((d) => Math.round(d[0] * 100) / 100)]);
    for (const x of xs) {
      const y = interpoleer(data, x);
      if (y !== null) uit[`y@${nlKey(x)}`] = Math.round(y * 100) / 100;
    }
    uit.reeksen = new Set(els.filter((e) => e.attrs["data-rol"] === "reeks" || e.attrs["data-rol"] === "kruis").map((e) => e.attrs["data-reeks"] ?? e.groep["data-reeks"])).size;
  }
  if (assen.length > 1) {
    for (const a of assen) {
      const naam = a.groep["data-paneel"];
      const k = kader(a);
      const lijn = els.find((e) => e.attrs["data-rol"] === "reeks" && e.groep["data-paneel"] === naam);
      if (!lijn) continue;
      const d = punten(lijn.attrs.points).map(([x, y]) => [k.X(x), k.Y(y)] as [number, number]);
      const dv = d[d.length - 1][1] - d[0][1];
      const bereik = Math.abs(Number(a.attrs["data-y"].split(" ")[1]) - Number(a.attrs["data-y"].split(" ")[0]));
      uit[`${naam}.trend`] = Math.abs(dv) < 0.02 * bereik ? 0 : Math.sign(dv);
      uit[`${naam}.eind`] = Math.round(d[d.length - 1][1] * 100) / 100;
    }
    uit.panelen = assen.length;
  }
  uit.asfouten = asfouten;
  return uit;
}

const nlKey = (x: number) => String(Math.round(x * 100) / 100);

function interpoleer(d: [number, number][], x: number): number | null {
  for (const p of d) if (Math.abs(p[0] - x) < 1e-6) return p[1];
  for (let i = 1; i < d.length; i++) {
    if (x >= d[i - 1][0] && x <= d[i][0]) {
      const t = (x - d[i - 1][0]) / (d[i][0] - d[i - 1][0]);
      return d[i - 1][1] + t * (d[i][1] - d[i - 1][1]);
    }
  }
  return null;
}
