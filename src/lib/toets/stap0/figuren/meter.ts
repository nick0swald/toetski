/**
 * Meters (deterministisch, zoals in het CSE): een wijzermeter (analoge spannings-/stroommeter met schaal en wijzer)
 * en een kWh-meter (telwerk met cijferrollen). De controle leest terug uit de SVG zoals een leerling: bij de
 * wijzermeter uit de stand van de wijzer t.o.v. de schaalgetallen, bij de kWh-meter uit de cijfers van het telwerk.
 */
import type { MeterFiguur } from "../spec.ts";
import { leesSvg, Svg } from "./svg.ts";

const BOOG = 100; // graden: schaal van -50° tot +50° rond de verticaal
const R = 100; // pt
const nlGetal = (v: number) => String(Math.round(v * 1000) / 1000).replace(".", ",");

function hoekVan(f: Pick<MeterFiguur, "min" | "max">, v: number): number {
  const min = f.min ?? 0;
  const max = f.max ?? 1;
  return -BOOG / 2 + ((v - min) / (max - min)) * BOOG;
}

export function meterSvg(f: MeterFiguur): string {
  if (f.soort === "kwh") return kwhSvg(f);
  const W = 2 * R + 60;
  const H = R + 70;
  const cx = W / 2;
  const cy = R + 30;
  const s = new Svg(W, H);
  const p = (hoek: number, r: number): [number, number] => [cx + r * Math.sin((hoek * Math.PI) / 180), cy - r * Math.cos((hoek * Math.PI) / 180)];
  s.rect(4, 4, W - 8, H - 8, { kleur: "#000", lw: 1.2, fill: "#fff", rol: "kast" });
  const min = f.min ?? 0;
  const max = f.max ?? 10;
  const streep = f.streep ?? (max - min) / 10;
  const getalElke = f.getalElke ?? streep * 5;
  // schaalboog
  const [x0, y0] = p(-BOOG / 2, R);
  const [x1, y1] = p(BOOG / 2, R);
  s.path(`M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`, { kleur: "#000", lw: 1 });
  const n = Math.round((max - min) / streep);
  for (let k = 0; k <= n; k++) {
    const v = min + k * streep;
    const h = hoekVan(f, v);
    const isGetal = Math.abs((v - min) / getalElke - Math.round((v - min) / getalElke)) < 1e-9;
    const L = isGetal ? 12 : 6;
    const [a, b] = p(h, R);
    const [c, d] = p(h, R - L);
    s.line(a, b, c, d, { lw: isGetal ? 1.2 : 0.7, cap: "butt" });
    if (isGetal) {
      const [tx, ty] = p(h, R + 12);
      s.text(tx, ty, nlGetal(v), { size: 9, anker: "middle", va: "center", rol: "schaalgetal", extra: `data-hoek="${h.toFixed(3)}"` });
    }
  }
  // eenheid en wijzer
  s.text(cx, cy - R * 0.45, f.eenheid, { size: 16, bold: true, anker: "middle", va: "center", rol: "eenheid" });
  const hw = hoekVan(f, f.waarde);
  const [wx, wy] = p(hw, R - 4);
  s.line(cx, cy, wx, wy, { lw: 1.6, kleur: "#000", rol: "wijzer" });
  s.circle(cx, cy, 4, { fill: "#000" });
  if (f.label) s.text(cx, H - 10, f.label, { size: 10, anker: "middle", va: "baseline" });
  return s.toString(f.breedteCm, 'data-figuur="meter"');
}

function kwhSvg(f: MeterFiguur): string {
  const cijfers = Math.max(4, f.cijfers ?? 5);
  const dec = f.decimalen ?? 1;
  const tekst = f.waarde.toFixed(dec).replace(".", "").padStart(cijfers + dec, "0");
  const vak = 22;
  const W = (cijfers + dec) * vak + 40 + 30;
  const H = 90;
  const s = new Svg(W, H);
  s.rect(4, 4, W - 8, H - 8, { kleur: "#000", lw: 1.2, fill: "#fff", rol: "kast" });
  s.text(W / 2, 20, "kWh", { size: 11, bold: true, anker: "middle", va: "center" });
  [...tekst].forEach((c, i) => {
    const x = 20 + i * vak;
    const decimaal = i >= cijfers;
    s.rect(x, 32, vak - 2, 30, { kleur: "#000", lw: 1, fill: decimaal ? "#c0392b" : "#333" });
    s.text(x + (vak - 2) / 2, 47, c, { size: 16, anker: "middle", va: "center", kleur: "#fff", bold: true, rol: decimaal ? "decimaal" : "cijfer", extra: `data-pos="${i}"` });
  });
  if (f.label) s.text(W / 2, H - 12, f.label, { size: 10, anker: "middle", va: "baseline" });
  return s.toString(f.breedteCm, `data-figuur="meter" data-decimalen="${dec}"`);
}

/** Sleutels: "waarde" (wijzerstand in de eenheid van de schaal, of de kWh-stand), "max" (hoogste schaalgetal). */
export function meetMeter(svg: string): Record<string, number> {
  const els = leesSvg(svg);
  const uit: Record<string, number> = {};
  const cijfers = els.filter((e) => e.attrs["data-rol"] === "cijfer" || e.attrs["data-rol"] === "decimaal").sort((a, b) => Number(a.attrs["data-pos"]) - Number(b.attrs["data-pos"]));
  if (cijfers.length) {
    const heel = cijfers.filter((e) => e.attrs["data-rol"] === "cijfer").map((e) => e.tekst ?? "").join("");
    const dec = cijfers.filter((e) => e.attrs["data-rol"] === "decimaal").map((e) => e.tekst ?? "").join("");
    uit.waarde = Number(`${heel}${dec ? `.${dec}` : ""}`);
    return uit;
  }
  const getallen = els.filter((e) => e.attrs["data-rol"] === "schaalgetal").map((e) => ({ v: Number((e.tekst ?? "").replace(",", ".")), h: Number(e.attrs["data-hoek"]) })).sort((a, b) => a.v - b.v);
  const w = els.find((e) => e.attrs["data-rol"] === "wijzer");
  if (getallen.length < 2 || !w) return uit;
  const dx = Number(w.attrs.x2) - Number(w.attrs.x1);
  const dy = Number(w.attrs.y1) - Number(w.attrs.y2);
  const hoek = (Math.atan2(dx, dy) * 180) / Math.PI;
  const a = getallen[0]!;
  const b = getallen[getallen.length - 1]!;
  uit.waarde = Math.round((a.v + ((hoek - a.h) / (b.h - a.h)) * (b.v - a.v)) * 1000) / 1000;
  uit.max = b.v;
  return uit;
}

/** Spec-fouten die de meting niet ziet: wijzer buiten de schaal of niet afleesbaar (niet op een halve streep). */
export function keurMeter(f: MeterFiguur): string[] {
  const fouten: string[] = [];
  if (f.soort === "kwh") {
    if (f.waarde < 0) fouten.push("meter: kWh-stand negatief");
    return fouten;
  }
  const min = f.min ?? 0;
  const max = f.max ?? 10;
  if (!(max > min)) fouten.push("meter: max moet groter zijn dan min");
  if (f.waarde < min || f.waarde > max) fouten.push(`meter: wijzer (${f.waarde}) buiten de schaal ${min}–${max}`);
  const streep = f.streep ?? (max - min) / 10;
  const k = (f.waarde - min) / (streep / 2);
  if (Math.abs(k - Math.round(k)) > 1e-6) fouten.push(`meter: wijzer (${f.waarde}) staat niet op een (halve) streep van ${streep}; niet eenduidig af te lezen`);
  if ((max - min) / streep > 60) fouten.push("meter: te veel streepjes (hoogstens 60)");
  return fouten;
}
