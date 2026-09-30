import type { FiguurSpec } from "../types.ts";
import { ghsPictogramSvg, maatcilinderSvg } from "../figuur-svg.ts";
import { parseSpecData, type SpecData } from "./spec.ts";
import { symboolSoort, type SymboolSoort } from "./schakelsymbolen.ts";

/**
 * Deterministische tekenaars: spec-data → SVG. Getallen komen letterlijk uit de spec,
 * dus assen, standen en waarden kloppen altijd. Geen randomness, geen model.
 */

export interface GetekendeFiguur {
  svg: string;
  breedte: number;
  hoogte: number;
  /** Alle tekst die in de figuur staat (voor de 'niet tonen'-check). */
  teksten: string[];
}

const FONT = "Liberation Sans, Arial, Helvetica, sans-serif";
const INK = "#1a1a1a";
const GRID = "#d0d7de";
const REEKS = [
  { kleur: "#1f5fa8", dash: "", marker: "cirkel" },
  { kleur: "#b03a2e", dash: "7 4", marker: "vierkant" },
  { kleur: "#2e7d32", dash: "2 3", marker: "driehoek" },
] as const;

export function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Nederlandse getalnotatie (komma), zonder zwevende-kommaruis. */
export function nl(n: number): string {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 1000) / 1000;
  return String(r).replace(".", ",");
}

function tekst(
  x: number,
  y: number,
  s: string,
  opts: { size?: number; anchor?: "start" | "middle" | "end"; bold?: boolean; rotate?: number; kleur?: string } = {},
): string {
  const rot = opts.rotate ? ` transform="rotate(${opts.rotate} ${x.toFixed(1)} ${y.toFixed(1)})"` : "";
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${FONT}" font-size="${opts.size ?? 13}"${
    opts.bold ? ' font-weight="700"' : ""
  } text-anchor="${opts.anchor ?? "middle"}" fill="${opts.kleur ?? INK}"${rot}>${esc(s)}</text>`;
}

function lijn(x1: number, y1: number, x2: number, y2: number, opts: { w?: number; kleur?: string; dash?: string; attr?: string } = {}): string {
  return `<line${opts.attr ? ` ${opts.attr}` : ""} x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${opts.kleur ?? INK}" stroke-width="${opts.w ?? 2}"${
    opts.dash ? ` stroke-dasharray="${opts.dash}"` : ""
  } stroke-linecap="round"/>`;
}

function pijl(x1: number, y1: number, x2: number, y2: number, kleur = INK, w = 2.4): string {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const L = 11;
  const a1 = ang + Math.PI - 0.42;
  const a2 = ang + Math.PI + 0.42;
  const bx = x2 - Math.cos(ang) * 6;
  const by = y2 - Math.sin(ang) * 6;
  return `${lijn(x1, y1, bx, by, { w, kleur })}<polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(x2 + Math.cos(a1) * L).toFixed(1)},${(y2 + Math.sin(a1) * L).toFixed(1)} ${(x2 + Math.cos(a2) * L).toFixed(1)},${(y2 + Math.sin(a2) * L).toFixed(1)}" fill="${kleur}"/>`;
}

function wrap(W: number, H: number, body: string, titel?: string): string {
  const t = titel ? tekst(W / 2, 22, titel, { size: 15, bold: true }) : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${t}${body}</svg>`;
}

/** 'Mooie' asverdeling: stapgrootte 1/2/2,5/5 × 10^k. */
export function niceAs(min: number, max: number, doelTicks = 6): { min: number; max: number; stap: number } {
  if (!(max > min)) max = min + 1;
  const ruw = (max - min) / doelTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(ruw)));
  const kandidaten = [1, 2, 2.5, 5, 10].map((f) => f * mag);
  const stap = kandidaten.find((k) => k >= ruw) ?? 10 * mag;
  const nmin = Math.floor(min / stap + 1e-9) * stap;
  const nmax = Math.ceil(max / stap - 1e-9) * stap;
  return { min: round(nmin), max: round(nmax), stap: round(stap) };
}

function round(n: number): number {
  return Math.round(n * 1e9) / 1e9;
}

function asLabel(label: string, eenheid?: string): string {
  if (!eenheid) return label;
  if (label.includes(`(${eenheid})`) || label.includes(`in ${eenheid}`)) return label;
  return `${label} (${eenheid})`;
}

function marker(soort: string, x: number, y: number, kleur: string): string {
  if (soort === "vierkant") return `<rect x="${(x - 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="8" height="8" fill="${kleur}"/>`;
  if (soort === "driehoek")
    return `<polygon points="${x.toFixed(1)},${(y - 5).toFixed(1)} ${(x + 5).toFixed(1)},${(y + 4).toFixed(1)} ${(x - 5).toFixed(1)},${(y + 4).toFixed(1)}" fill="${kleur}"/>`;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${kleur}"/>`;
}

interface Assen {
  W: number;
  H: number;
  pad: { l: number; r: number; t: number; b: number };
  x: { min: number; max: number; stap: number };
  y: { min: number; max: number; stap: number };
  xOf: (v: number) => number;
  yOf: (v: number) => number;
}

/**
 * Ondergrens van een as: normaal 0, maar als de data ver van 0 ligt (bijv. 80–95 dB) begint de as
 * vlak onder de kleinste waarde, zodat de data het assenstelsel vult en afleesbaar is.
 * Een expliciete ondergrens die de data in minder dan 35% van de as propt, wordt genegeerd.
 */
export function asOndergrens(waarden: number[], expliciet?: number): number {
  const lo = Math.min(...waarden);
  const hi = Math.max(...waarden);
  const span = hi - lo;
  const auto = lo < 0 ? lo : span > 0 && lo > span * 1.2 ? lo - span * 0.08 : 0;
  if (expliciet == null) return auto;
  if (expliciet > lo) return auto;
  const bereik = Math.max(hi, expliciet) - expliciet;
  return span > 0 && bereik > 0 && span / bereik < 0.35 ? auto : expliciet;
}

function asBovengrens(waarden: number[], expliciet?: number): number {
  const hi = Math.max(...waarden);
  if (expliciet == null || expliciet < hi) return hi;
  const lo = Math.min(...waarden);
  const span = hi - lo;
  return span > 0 && span / (expliciet - lo) < 0.35 ? hi : expliciet;
}

function maakAssen(
  W: number,
  H: number,
  xs: number[],
  ys: number[],
  opts: { xMin?: number; xMax?: number; yMin?: number; yMax?: number; titel?: boolean },
): Assen {
  const pad = { l: 72, r: 24, t: opts.titel ? 40 : 18, b: 58 };
  const x = niceAs(asOndergrens(xs, opts.xMin), asBovengrens(xs, opts.xMax));
  // Kleine marge boven het hoogste punt, zodat een punt nooit tegen de rand van het assenstelsel valt.
  const yHoog = Math.max(...ys);
  const yLaag = asOndergrens(ys, opts.yMin);
  const y = niceAs(yLaag, opts.yMax ?? yHoog + Math.max(1e-9, (yHoog - yLaag) * 0.04));
  const xOf = (v: number) => pad.l + ((v - x.min) / (x.max - x.min)) * (W - pad.l - pad.r);
  const yOf = (v: number) => pad.t + (1 - (v - y.min) / (y.max - y.min)) * (H - pad.t - pad.b);
  return { W, H, pad, x, y, xOf, yOf };
}

function tekenAssen(a: Assen, xLabel: string, yLabel: string, raster: boolean): string {
  const out: string[] = [];
  const { pad, W, H } = a;
  for (let v = a.y.min; v <= a.y.max + 1e-9; v = round(v + a.y.stap)) {
    const y = a.yOf(v);
    if (raster) out.push(lijn(pad.l, y, W - pad.r, y, { w: 1, kleur: GRID }));
    out.push(lijn(pad.l - 5, y, pad.l, y, { w: 1.4 }));
    out.push(tekst(pad.l - 9, y + 4.5, nl(v), { anchor: "end", size: 12 }));
  }
  for (let v = a.x.min; v <= a.x.max + 1e-9; v = round(v + a.x.stap)) {
    const x = a.xOf(v);
    if (raster) out.push(lijn(x, pad.t, x, H - pad.b, { w: 1, kleur: GRID }));
    out.push(lijn(x, H - pad.b, x, H - pad.b + 5, { w: 1.4 }));
    out.push(tekst(x, H - pad.b + 19, nl(v), { size: 12 }));
  }
  out.push(lijn(pad.l, pad.t - 6, pad.l, H - pad.b, { w: 1.8 }));
  out.push(lijn(pad.l, H - pad.b, W - pad.r + 6, H - pad.b, { w: 1.8 }));
  out.push(tekst((pad.l + W - pad.r) / 2, H - 12, xLabel, { size: 13 }));
  out.push(tekst(18, (pad.t + H - pad.b) / 2, yLabel, { size: 13, rotate: -90 }));
  return out.join("");
}

function lijngrafiek(spec: FiguurSpec): { svg: string; W: number; H: number } {
  const d = parseSpecData("lijngrafiek", spec.data);
  const W = 560;
  const H = 360;
  const alle = d.reeksen.flatMap((r) => r.punten);
  const a = maakAssen(W, H, alle.map((p) => p.x), alle.map((p) => p.y), { ...d, titel: Boolean(spec.titel) });
  const body: string[] = [tekenAssen(a, asLabel(d.xLabel, d.xEenheid), asLabel(d.yLabel, d.yEenheid), d.raster)];
  d.reeksen.forEach((r, i) => {
    const stijl = REEKS[i % REEKS.length]!;
    const pad = r.punten.map((p, j) => `${j ? "L" : "M"} ${a.xOf(p.x).toFixed(1)} ${a.yOf(p.y).toFixed(1)}`).join(" ");
    body.push(
      `<path d="${pad}" fill="none" stroke="${stijl.kleur}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"${
        stijl.dash ? ` stroke-dasharray="${stijl.dash}"` : ""
      }/>`,
    );
    if (d.toonPunten) for (const p of r.punten) body.push(marker(stijl.marker, a.xOf(p.x), a.yOf(p.y), stijl.kleur));
  });
  const benoemd = d.reeksen.filter((r) => r.naam);
  if (benoemd.length > 1 || (benoemd.length === 1 && d.reeksen.length > 1)) {
    d.reeksen.forEach((r, i) => {
      const stijl = REEKS[i % REEKS.length]!;
      const y = a.pad.t + 12 + i * 18;
      const x = W - a.pad.r - 150;
      body.push(lijn(x, y, x + 26, y, { w: 2.6, kleur: stijl.kleur, dash: stijl.dash }));
      body.push(marker(stijl.marker, x + 13, y, stijl.kleur));
      body.push(tekst(x + 32, y + 4.5, r.naam || `reeks ${i + 1}`, { anchor: "start", size: 12 }));
    });
  }
  return { svg: wrap(W, H, body.join(""), spec.titel), W, H };
}

function spreidingsdiagram(spec: FiguurSpec): { svg: string; W: number; H: number } {
  const d = parseSpecData("spreidingsdiagram", spec.data);
  const W = 560;
  const H = 360;
  const a = maakAssen(W, H, d.punten.map((p) => p.x), d.punten.map((p) => p.y), { ...d, titel: Boolean(spec.titel) });
  const body = [tekenAssen(a, asLabel(d.xLabel, d.xEenheid), asLabel(d.yLabel, d.yEenheid), true)];
  for (const p of d.punten) body.push(marker("cirkel", a.xOf(p.x), a.yOf(p.y), REEKS[0].kleur));
  return { svg: wrap(W, H, body.join(""), spec.titel), W, H };
}

function staafdiagram(spec: FiguurSpec): { svg: string; W: number; H: number } {
  const d = parseSpecData("staafdiagram", spec.data);
  const W = 560;
  const H = 360;
  const pad = { l: 72, r: 24, t: spec.titel ? 40 : 18, b: d.xLabel ? 70 : 52 };
  const y = niceAs(Math.min(0, ...d.staven.map((s) => s.waarde)), d.yMax ?? Math.max(...d.staven.map((s) => s.waarde)));
  const yOf = (v: number) => pad.t + (1 - (v - y.min) / (y.max - y.min)) * (H - pad.t - pad.b);
  const out: string[] = [];
  for (let v = y.min; v <= y.max + 1e-9; v = round(v + y.stap)) {
    const yy = yOf(v);
    out.push(lijn(pad.l, yy, W - pad.r, yy, { w: 1, kleur: GRID }));
    out.push(lijn(pad.l - 5, yy, pad.l, yy, { w: 1.4 }));
    out.push(tekst(pad.l - 9, yy + 4.5, nl(v), { anchor: "end", size: 12 }));
  }
  const n = d.staven.length;
  const vak = (W - pad.l - pad.r) / n;
  const bw = Math.min(64, vak * 0.6);
  d.staven.forEach((s, i) => {
    const cx = pad.l + vak * (i + 0.5);
    const y0 = yOf(0);
    const y1 = yOf(s.waarde);
    out.push(
      `<rect x="${(cx - bw / 2).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(y0 - y1).toFixed(1)}" fill="#9cc3e6" stroke="${INK}" stroke-width="1.6"/>`,
    );
    out.push(tekst(cx, H - pad.b + 19, s.label, { size: 12 }));
    if (d.toonWaarden) out.push(tekst(cx, Math.min(y0, y1) - 6, nl(s.waarde), { size: 12, bold: true }));
  });
  out.push(lijn(pad.l, pad.t - 6, pad.l, H - pad.b, { w: 1.8 }));
  out.push(lijn(pad.l, yOf(0), W - pad.r, yOf(0), { w: 1.8 }));
  if (d.xLabel) out.push(tekst((pad.l + W - pad.r) / 2, H - 14, d.xLabel, { size: 13 }));
  out.push(tekst(18, (pad.t + H - pad.b) / 2, asLabel(d.yLabel, d.yEenheid), { size: 13, rotate: -90 }));
  return { svg: wrap(W, H, out.join(""), spec.titel), W, H };
}

type Comp = { soort: string; label?: string };

/** Klein pijltje (voor led/LDR/variabele weerstand). */
function pijltje(x1: number, y1: number, x2: number, y2: number, w = 1.4): string {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const L = 6;
  const p = (a: number) => `${(x2 + Math.cos(a) * L).toFixed(1)},${(y2 + Math.sin(a) * L).toFixed(1)}`;
  return `${lijn(x1, y1, x2 - Math.cos(ang) * 3, y2 - Math.sin(ang) * 3, { w })}<polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${p(ang + Math.PI - 0.5)} ${p(ang + Math.PI + 0.5)}" fill="${INK}"/>`;
}

const WIT = `fill="#ffffff" stroke="${INK}" stroke-width="2"`;

/**
 * Standaard NL/VMBO-schakelsymbool, horizontaal gecentreerd op (x,y); `vert` draait het 90°.
 * Neemt 44 px draad in. Elk symbool zit in <g data-symbool="…"> zodat code kan controleren
 * dat élk onderdeel met zijn eigen symbool getekend is (zie schakelsymbolen.ts).
 */
function symbool(c: Comp, x: number, y: number, vert = false): { vorm: string; tekst: string } {
  const soort: SymboolSoort = symboolSoort(c.soort);
  const rot = vert ? ` transform="rotate(90 ${x} ${y})"` : "";
  const g = (inner: string) => `<g data-symbool="${soort}"${rot}>${inner}</g>`;
  const draad = (gap: number) => lijn(x - 22, y, x - gap, y) + lijn(x + gap, y, x + 22, y);
  const rechthoek = (extra = "") => `${draad(18)}<rect x="${x - 18}" y="${y - 7}" width="36" height="14" ${WIT}/>${extra}`;
  const cirkelLetter = (L: "A" | "V" | "M") => ({
    vorm: g(`${draad(14)}<circle data-letter="${L}" cx="${x}" cy="${y}" r="14" ${WIT}/>`),
    tekst: tekst(x, y + 5, L, { size: 14, bold: true }),
  });
  switch (soort) {
    case "ampèremeter":
      return cirkelLetter("A");
    case "voltmeter":
      return cirkelLetter("V");
    case "motor":
      return cirkelLetter("M");
    case "weerstand":
      return { vorm: g(rechthoek()), tekst: "" };
    case "zekering":
      return { vorm: g(rechthoek(lijn(x - 18, y, x + 18, y, { w: 1.6 }))), tekst: "" };
    case "variabele-weerstand":
      return { vorm: g(rechthoek(pijltje(x - 16, y + 13, x + 16, y - 13, 1.6))), tekst: "" };
    case "ntc":
      return {
        vorm: g(rechthoek(`${lijn(x - 20, y + 12, x - 12, y + 12, { w: 1.6 })}${lijn(x - 12, y + 12, x + 16, y - 12, { w: 1.6 })}`)),
        tekst: tekst(x + (vert ? 26 : 0), y + (vert ? 4 : 26), "−t°", { size: 11, anchor: vert ? "start" : "middle" }),
      };
    case "ldr":
      return {
        vorm: g(
          `${draad(18)}<circle cx="${x}" cy="${y}" r="18" ${WIT}/><rect x="${x - 11}" y="${y - 5}" width="22" height="10" ${WIT}/>${pijltje(x - 22, y - 24, x - 10, y - 12)}${pijltje(x - 12, y - 28, x, y - 16)}`,
        ),
        tekst: "",
      };
    case "schakelaar-open":
    case "schakelaar-dicht": {
      // Twee (open) contactpunten; hendel vanaf het linker contact: schuin omhoog (open) of recht naar het rechter contact (dicht).
      const cx1 = x - 15;
      const cx2 = x + 15;
      const hoek = (30 * Math.PI) / 180;
      const hendel =
        soort === "schakelaar-open"
          ? lijn(cx1, y, cx1 + 32 * Math.cos(hoek), y - 32 * Math.sin(hoek), { w: 2.2, attr: 'data-hendel="1"' })
          : lijn(cx1, y, cx2, y, { w: 4.2, attr: 'data-hendel="1"' });
      const contacten = `<circle data-contact="1" cx="${cx1}" cy="${y}" r="3.5" ${WIT}/><circle data-contact="1" cx="${cx2}" cy="${y}" r="3.5" ${WIT}/>`;
      // Dicht: dikke hendel óver de contacten heen (anders lijkt het op twee losse rondjes met een spleet).
      return {
        vorm: g(
          `${lijn(x - 22, y, cx1 - 3.5, y)}${lijn(cx2 + 3.5, y, x + 22, y)}${soort === "schakelaar-open" ? hendel + contacten : contacten + hendel}`,
        ),
        tekst: "",
      };
    }
    case "led":
    case "diode":
      return {
        vorm: g(
          `${draad(9)}<polygon points="${x - 9},${y - 10} ${x - 9},${y + 10} ${x + 9},${y}" ${WIT}/>${lijn(x + 9, y - 11, x + 9, y + 11)}${
            soort === "led" ? `${pijltje(x, y - 12, x + 9, y - 22)}${pijltje(x + 7, y - 10, x + 16, y - 20)}` : ""
          }`,
        ),
        tekst: "",
      };
    case "zoemer":
      return { vorm: g(`${draad(14)}<path d="M ${x - 14} ${y} A 14 14 0 0 1 ${x + 14} ${y} Z" ${WIT}/>`), tekst: "" };
    case "lamp":
      return {
        vorm: g(`${draad(14)}<circle cx="${x}" cy="${y}" r="14" ${WIT}/>${lijn(x - 10, y - 10, x + 10, y + 10)}${lijn(x - 10, y + 10, x + 10, y - 10)}`),
        tekst: "",
      };
    default:
      // Geen standaardsymbool: zichtbaar "?"-blok; de code-keuring maakt hier een no_go van.
      return {
        vorm: g(`${draad(18)}<rect x="${x - 18}" y="${y - 10}" width="36" height="20" fill="#ffffff" stroke="${INK}" stroke-width="2" stroke-dasharray="4 3"/>`),
        tekst: tekst(x, y + 5, "?", { size: 13, bold: true }),
      };
  }
}

/** Batterij/spanningsbron verticaal op (x,y): lange dunne plaat = +, korte dikke plaat = −. */
function bron(x: number, y: number, soort: string): string {
  if (soort === "spanningsbron") {
    return `<g data-symbool="spanningsbron">${lijn(x, y - 26, x, y - 16)}${lijn(x, y + 16, x, y + 26)}<circle cx="${x}" cy="${y}" r="16" ${WIT}/></g>${tekst(x, y - 3, "+", { size: 12, bold: true })}${tekst(x, y + 12, "−", { size: 13, bold: true })}`;
  }
  return `<g data-symbool="batterij">${lijn(x, y - 26, x, y - 5)}${lijn(x, y + 5, x, y + 26)}${lijn(x - 16, y - 5, x + 16, y - 5, { w: 2, attr: 'data-plaat="1"' })}${lijn(x - 8, y + 5, x + 8, y + 5, { w: 4.5, attr: 'data-plaat="1"' })}</g>${tekst(x + 22, y - 8, "+", { size: 13, bold: true, anchor: "start" })}${tekst(x + 22, y + 16, "−", { size: 14, bold: true, anchor: "start" })}`;
}

/** Horizontale draad van x1 naar x2 met gaten voor symbolen op posities xs. */
function draadMetGaten(x1: number, x2: number, y: number, xs: number[]): string {
  const gaten = [...xs].sort((a, b) => a - b);
  let cur = x1;
  const out: string[] = [];
  for (const cx of gaten) {
    out.push(lijn(cur, y, cx - 22, y));
    cur = cx + 22;
  }
  out.push(lijn(cur, y, x2, y));
  return out.join("");
}

function draadVertMetGaten(x: number, y1: number, y2: number, ys: number[]): string {
  const gaten = [...ys].sort((a, b) => a - b);
  let cur = y1;
  const out: string[] = [];
  for (const cy of gaten) {
    out.push(lijn(x, cur, x, cy - 22));
    cur = cy + 22;
  }
  out.push(lijn(x, cur, x, y2));
  return out.join("");
}

function spreid(a: number, b: number, n: number): number[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * (i + 1)) / (n + 1));
}

/** Spanningsmeter parallel over een horizontaal onderdeel op (cx,y), boven (op) of onder de draad. */
function voltmeterHorizontaal(cx: number, y: number, op: boolean, label?: string): string[] {
  const yy = op ? y - 46 : y + 46;
  const s = symbool({ soort: "voltmeter" }, cx, yy);
  return [
    lijn(cx - 34, y, cx - 34, yy),
    lijn(cx + 34, y, cx + 34, yy),
    lijn(cx - 34, yy, cx - 22, yy),
    lijn(cx + 22, yy, cx + 34, yy),
    `<circle cx="${cx - 34}" cy="${y}" r="3" fill="${INK}"/><circle cx="${cx + 34}" cy="${y}" r="3" fill="${INK}"/>`,
    s.vorm,
    s.tekst,
    label ? tekst(cx + 40, yy + 5, label, { anchor: "start", size: 13 }) : "",
  ];
}

/** Spanningsmeter parallel over een verticaal onderdeel (in een tak) op (x,cy), rechts ervan. */
function voltmeterVerticaal(x: number, cy: number, label?: string): string[] {
  const xx = x + 52;
  const s = symbool({ soort: "voltmeter" }, xx, cy, true);
  return [
    lijn(x, cy - 32, xx, cy - 32),
    lijn(x, cy + 32, xx, cy + 32),
    lijn(xx, cy - 32, xx, cy - 22),
    lijn(xx, cy + 22, xx, cy + 32),
    `<circle cx="${x}" cy="${cy - 32}" r="3" fill="${INK}"/><circle cx="${x}" cy="${cy + 32}" r="3" fill="${INK}"/>`,
    s.vorm,
    s.tekst,
    label ? tekst(xx + 20, cy + 5, label, { anchor: "start", size: 13 }) : "",
  ];
}

/**
 * Schakelschema zoals in Nova: bron links (verticaal), stroommeter in serie, spanningsmeter
 * parallel over een lampje/weerstand — nooit over de bron.
 */
function stroomkring(spec: FiguurSpec): { svg: string; W: number; H: number } {
  const d = parseSpecData("stroomkring", spec.data);
  const H = 340;
  const top = spec.titel ? 96 : 84;
  const bot = H - 60;
  const L = 80;
  const out: string[] = [];
  const bronY = (top + bot) / 2;
  const bronLabel = d.bron.label;
  out.push(lijn(L, top, L, bronY - 26), lijn(L, bronY + 26, L, bot));
  out.push(bron(L, bronY, d.bron.soort));
  if (bronLabel) out.push(tekst(L - 26, bronY + 5, bronLabel, { anchor: "end", size: 13 }));
  const vmOp = (o: number | { tak: number; index: number }) => d.voltmeters.find((v) => (typeof v.over === "number" ? v.over === o : typeof o === "object" && typeof v.over === "object" && v.over.tak === o.tak && v.over.index === o.index));

  if (d.schakeling === "parallel" && d.takken.length) {
    const hoofd = d.componenten.slice(0, 3);
    const hoofdVm = hoofd.some((_, i) => vmOp(i));
    const hoofdEind = Math.max(250, L + 40 + hoofd.length * 90);
    // Takken naast elkaar; een tak met spanningsmeter krijgt extra ruimte rechts.
    const takX: number[] = [];
    let x = hoofdEind + 50;
    d.takken.forEach((tak, ti) => {
      takX.push(x);
      const metVm = tak.some((_, i) => vmOp({ tak: ti, index: i }));
      x += (tak.some((c) => c.label) ? 110 : 90) + (metVm ? 80 : 0);
    });
    const R = takX[takX.length - 1]!;
    const W = Math.max(560, x - 20);
    const hoofdX = spreid(L, hoofdEind, hoofd.length);
    out.push(draadMetGaten(L, R, top, hoofdX));
    out.push(lijn(L, bot, R, bot));
    hoofd.forEach((c, i) => {
      const s = symbool(c, hoofdX[i]!, top);
      out.push(s.vorm, s.tekst);
      if (c.label) out.push(tekst(hoofdX[i]!, hoofdVm ? top + 34 : top - 24, c.label, { size: 13 }));
      const vm = vmOp(i);
      if (vm) out.push(...voltmeterHorizontaal(hoofdX[i]!, top, true, vm.label));
    });
    d.takken.forEach((tak, ti) => {
      const tx = takX[ti]!;
      const ys = spreid(top, bot, tak.length);
      out.push(draadVertMetGaten(tx, top, bot, ys));
      out.push(`<circle cx="${tx}" cy="${top}" r="3.5" fill="${INK}"/><circle cx="${tx}" cy="${bot}" r="3.5" fill="${INK}"/>`);
      tak.forEach((c, i) => {
        const s = symbool(c, tx, ys[i]!, true);
        out.push(s.vorm, s.tekst);
        const vm = vmOp({ tak: ti, index: i });
        // Label links van het onderdeel als er rechts een spanningsmeter staat.
        if (c.label) out.push(vm ? tekst(tx - 22, ys[i]! + 5, c.label, { anchor: "end", size: 13 }) : tekst(tx + 22, ys[i]! + 5, c.label, { anchor: "start", size: 13 }));
        if (vm) out.push(...voltmeterVerticaal(tx, ys[i]!, vm.label));
      });
    });
    return { svg: wrap(W, H, out.join(""), spec.titel), W, H };
  }
  const W = 560;
  const comps = d.componenten.length ? d.componenten : [{ soort: "lampje" }];
  const boven = comps.slice(0, 3);
  const onder = comps.slice(3, 6);
  const R = W - 80;
  const bx = spreid(L, R, boven.length);
  const ox = spreid(L, R, onder.length);
  out.push(draadMetGaten(L, R, top, bx), draadMetGaten(L, R, bot, ox), lijn(R, top, R, bot));
  const bovenVm = boven.some((_, i) => vmOp(i));
  const plaats = (c: Comp, x: number, y: number, labelOnder: boolean) => {
    const s = symbool(c, x, y);
    out.push(s.vorm, s.tekst);
    if (c.label) out.push(tekst(x, labelOnder ? y + 34 : y - 24, c.label, { size: 13 }));
  };
  boven.forEach((c, i) => plaats(c, bx[i]!, top, bovenVm));
  onder.forEach((c, i) => plaats(c, ox[i]!, bot, true));
  onder.forEach((_, i) => {
    const vm = vmOp(boven.length + i);
    if (vm) out.push(...voltmeterHorizontaal(ox[i]!, bot, false, vm.label));
  });
  boven.forEach((_, i) => {
    const vm = vmOp(i);
    if (vm) out.push(...voltmeterHorizontaal(bx[i]!, top, true, vm.label));
  });
  return { svg: wrap(W, H, out.join(""), spec.titel), W, H };
}

function plafond(x1: number, x2: number, y: number): string {
  const out = [lijn(x1, y, x2, y, { w: 2.4 })];
  for (let x = x1 + 4; x < x2; x += 12) out.push(lijn(x, y, x + 8, y - 8, { w: 1.2 }));
  return out.join("");
}

function katrolWiel(cx: number, cy: number, r = 22): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#e8f0f8" stroke="${INK}" stroke-width="2.2"/><circle cx="${cx}" cy="${cy}" r="3.5" fill="${INK}"/>`;
}

function blok(cx: number, y: number, label: string): string {
  return `<rect x="${cx - 36}" y="${y}" width="72" height="46" fill="#f3e6c8" stroke="${INK}" stroke-width="2"/>${tekst(cx, y + 28, label, { size: 13 })}`;
}

function katrol(spec: FiguurSpec): { svg: string; W: number; H: number } {
  const d = parseSpecData("katrol", spec.data);
  const W = 420;
  const H = 400;
  const top = spec.titel ? 48 : 30;
  const out: string[] = [plafond(60, W - 60, top)];
  if (d.type === "vast") {
    const cx = W / 2;
    const cy = top + 70;
    out.push(lijn(cx, top, cx, cy), katrolWiel(cx, cy));
    out.push(lijn(cx - 22, cy, cx - 22, 290), blok(cx - 22, 290, d.last));
    out.push(lijn(cx + 22, cy, cx + 22, 270), pijl(cx + 22, 270, cx + 22, 340, "#b03a2e"));
    out.push(tekst(cx + 32, 330, d.kracht, { anchor: "start", size: 14, bold: true, kleur: "#b03a2e" }));
  } else if (d.type === "los") {
    const cx = W / 2;
    const cy = 250;
    out.push(lijn(cx - 22, top, cx - 22, cy), katrolWiel(cx, cy), lijn(cx + 22, cy, cx + 22, top + 80));
    out.push(pijl(cx + 22, top + 80, cx + 22, top + 20, "#b03a2e"));
    out.push(tekst(cx + 32, top + 40, d.kracht, { anchor: "start", size: 14, bold: true, kleur: "#b03a2e" }));
    out.push(lijn(cx, cy, cx, cy + 40), blok(cx, cy + 40, d.last));
  } else {
    const n = Math.max(2, Math.min(6, d.touwdelen ?? 4));
    const cx = W / 2 - 20;
    const bovenY = top + 60;
    const onderY = 250;
    out.push(lijn(cx, top, cx, bovenY - 24));
    out.push(`<rect x="${cx - 50}" y="${bovenY - 24}" width="100" height="40" rx="8" fill="#e8f0f8" stroke="${INK}" stroke-width="2"/>`);
    out.push(`<rect x="${cx - 50}" y="${onderY - 16}" width="100" height="40" rx="8" fill="#e8f0f8" stroke="${INK}" stroke-width="2"/>`);
    const xs = spreid(cx - 50, cx + 50, n);
    for (const x of xs) out.push(lijn(x, bovenY + 16, x, onderY - 16, { w: 1.8 }));
    out.push(lijn(cx, onderY + 24, cx, onderY + 50), blok(cx, onderY + 50, d.last));
    const vx = cx + 80;
    out.push(lijn(cx + 50, bovenY - 4, vx, bovenY - 4, { w: 1.8 }), lijn(vx, bovenY - 4, vx, 250, { w: 1.8 }));
    out.push(pijl(vx, 250, vx, 320, "#b03a2e"));
    out.push(tekst(vx + 10, 312, d.kracht, { anchor: "start", size: 14, bold: true, kleur: "#b03a2e" }));
  }
  return { svg: wrap(W, H, out.join(""), spec.titel), W, H };
}

function hefboom(spec: FiguurSpec): { svg: string; W: number; H: number } {
  const d = parseSpecData("hefboom", spec.data);
  const W = 600;
  const H = 320;
  const x0 = 60;
  const x1 = W - 60;
  const by = spec.titel ? 150 : 140;
  const xOf = (p: number) => x0 + (Math.max(0, Math.min(d.lengte, p)) / d.lengte) * (x1 - x0);
  const out: string[] = [];
  out.push(`<rect x="${x0}" y="${by - 7}" width="${x1 - x0}" height="14" fill="#f3e6c8" stroke="${INK}" stroke-width="2"/>`);
  const dx = xOf(d.draaipunt);
  out.push(`<polygon points="${dx},${by + 7} ${dx - 18},${by + 42} ${dx + 18},${by + 42}" fill="#cfd8dc" stroke="${INK}" stroke-width="2"/>`);
  out.push(lijn(dx - 34, by + 42, dx + 34, by + 42, { w: 2.4 }));
  d.krachten.forEach((k) => {
    const x = xOf(k.positie);
    if (k.richting === "omlaag") {
      out.push(pijl(x, by - 80, x, by - 8, "#b03a2e"));
      out.push(tekst(x, by - 88, k.label, { size: 14, bold: true, kleur: "#b03a2e" }));
    } else {
      out.push(pijl(x, by + 80, x, by + 8, "#b03a2e"));
      out.push(tekst(x, by + 98, k.label, { size: 14, bold: true, kleur: "#b03a2e" }));
    }
  });
  if (d.toonMaten) {
    d.krachten.forEach((k, i) => {
      const x = xOf(k.positie);
      if (Math.abs(x - dx) < 4) return;
      const y = by + 70 + i * 26;
      const arm = Math.abs(k.positie - d.draaipunt);
      out.push(lijn(dx, y - 6, dx, y + 6, { w: 1.4 }), lijn(x, y - 6, x, y + 6, { w: 1.4 }));
      out.push(pijl((dx + x) / 2, y, x, y, INK, 1.4), pijl((dx + x) / 2, y, dx, y, INK, 1.4));
      out.push(`<rect x="${(dx + x) / 2 - 30}" y="${y - 10}" width="60" height="16" fill="#ffffff"/>`);
      out.push(tekst((dx + x) / 2, y + 4.5, `${nl(arm)} ${d.eenheid}`, { size: 12 }));
    });
  }
  return { svg: wrap(W, H, out.join(""), spec.titel), W, H };
}

function krachtenschema(spec: FiguurSpec): { svg: string; W: number; H: number } {
  const d = parseSpecData("krachtenschema", spec.data);
  const W = 480;
  const H = 400;
  const cx = W / 2;
  const cy = (spec.titel ? 36 : 0) + 180;
  const out: string[] = [];
  out.push(`<rect x="${cx - 45}" y="${cy - 30}" width="90" height="60" fill="#e8f0f8" stroke="${INK}" stroke-width="2"/>`);
  if (d.voorwerp) out.push(tekst(cx - 51, cy - 36, d.voorwerp, { size: 13, anchor: "end" }));
  const maxF = Math.max(...d.krachten.map((k) => k.grootte), 0) || 1;
  const pxPerN = 140 / maxF;
  out.push(`<circle cx="${cx}" cy="${cy}" r="4" fill="${INK}"/>`);
  for (const k of d.krachten) {
    const len = Math.max(12, k.grootte * pxPerN);
    const [ex, ey] =
      k.richting === "omhoog" ? [cx, cy - len] : k.richting === "omlaag" ? [cx, cy + len] : k.richting === "links" ? [cx - len, cy] : [cx + len, cy];
    out.push(pijl(cx, cy, ex, ey, "#b03a2e", 2.8));
    const label = d.toonGrootte ? `${k.naam} = ${nl(k.grootte)} ${k.eenheid}` : k.naam;
    const [lx, ly, anchor] =
      k.richting === "omhoog"
        ? [ex + 10, ey + 8, "start" as const]
        : k.richting === "omlaag"
          ? [ex + 10, ey, "start" as const]
          : k.richting === "links"
            ? [Math.min(ex, cx - 45) - 8, ey + 22, "end" as const]
            : [Math.max(ex, cx + 45) + 8, ey + 22, "start" as const];
    out.push(tekst(lx, ly, label, { size: 14, bold: true, anchor, kleur: "#b03a2e" }));
  }
  if (d.schaal && d.schaal > 0) {
    const len = d.schaal * pxPerN;
    const y = H - 24;
    out.push(lijn(30, y, 30 + len, y, { w: 2.4 }), lijn(30, y - 6, 30, y + 6, { w: 1.4 }), lijn(30 + len, y - 6, 30 + len, y + 6, { w: 1.4 }));
    out.push(tekst(38 + len, y + 5, `= ${nl(d.schaal)} N`, { anchor: "start", size: 12 }));
  }
  return { svg: wrap(W, H, out.join(""), spec.titel), W, H };
}

function blokschema(spec: FiguurSpec): { svg: string; W: number; H: number } {
  const d = parseSpecData("blokschema", spec.data);
  const n = d.blokken.length;
  const W = 600;
  const H = spec.titel ? 180 : 150;
  const bw = Math.min(130, (W - 40 - (n - 1) * 36) / n);
  const y = spec.titel ? 70 : 45;
  const out: string[] = [];
  d.blokken.forEach((b, i) => {
    const x = 20 + i * (bw + 36);
    out.push(`<rect x="${x}" y="${y}" width="${bw}" height="60" rx="8" fill="#e8f0f8" stroke="${INK}" stroke-width="2"/>`);
    out.push(tekst(x + bw / 2, y + 35, b, { size: 13 }));
    if (i < n - 1) out.push(pijl(x + bw + 4, y + 30, x + bw + 32, y + 30));
  });
  return { svg: wrap(W, H, out.join(""), spec.titel), W, H };
}

function pictogram(spec: FiguurSpec): { svg: string; W: number; H: number } {
  const d = parseSpecData("pictogram", spec.data);
  // GHS: rode ruit, zwart symbool op wit.
  // GHS: rode ruit, zwart symbool op wit. Veiligheidsborden hebben hun eigen kleuren.
  const svg = ghsPictogramSvg(d.symbool, 240, 240)
    .replace(/^<\?xml[^>]*>\s*/i, "")
    .replace('fill="#ffffff" stroke="#000000" stroke-width="3"/>', 'fill="#ffffff" stroke="#e30613" stroke-width="12" stroke-linejoin="round"/>');
  return { svg, W: 240, H: 240 };
}

function maatcilinder(spec: FiguurSpec): { svg: string; W: number; H: number } {
  const d = parseSpecData("maatcilinder", spec.data);
  const svg = maatcilinderSvg({ titel: spec.titel, maxMl: d.maxMl, standen: d.standen }, 300, 340, { eenheid: [...spec.eenheden, ...spec.labels, ...spec.getallen.map((g) => g.eenheid ?? "")].some((e) => /cm(³|3|\^3)/i.test(e)) ? "cm³" : "mL" }).replace(/^<\?xml[^>]*>\s*/i, "");
  return { svg, W: 300, H: 340 };
}

const TEKENAARS: Record<Exclude<FiguurSpec["soort"], "sfeerplaat">, (s: FiguurSpec) => { svg: string; W: number; H: number }> = {
  lijngrafiek,
  staafdiagram,
  spreidingsdiagram,
  stroomkring,
  katrol,
  hefboom,
  krachtenschema,
  blokschema,
  pictogram,
  maatcilinder,
};

function unesc(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

export function tekstenInSvg(svg: string): string[] {
  const out: string[] = [];
  const re = /<text[^>]*>([^<]*)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) if (m[1]?.trim()) out.push(unesc(m[1].trim()));
  return out;
}

/** Tekent een code-figuur. Gooit als de spec-data ongeldig is (dan: no-go). */
export function tekenCodeFiguur(spec: FiguurSpec): GetekendeFiguur {
  if (spec.soort === "sfeerplaat") throw new Error("Een sfeerplaat wordt niet door code getekend.");
  const r = TEKENAARS[spec.soort](spec);
  // Legacy-tekenaars gebruiken Arial; de server-renderer heeft Liberation Sans (metrisch gelijk).
  const svg = r.svg.replace(/font-family="Arial"/g, `font-family="${FONT}"`);
  return { svg, breedte: r.W, hoogte: r.H, teksten: tekstenInSvg(svg) };
}

export type { SpecData };
