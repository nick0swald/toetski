// RTTI-verdeling (punten) van de echte CSE's NaSk1 2013–2026 volgens dezelfde regels als de app.
import { readFileSync, writeFileSync } from "node:fs";
import { rttiVolgensRegels } from "../../src/lib/toets/rtti-regels.ts";
const V = JSON.parse(readFileSync("/workspace/nask-examens/vragen_geclassificeerd.json", "utf8"));
const tot: Record<string, Record<string, number>> = {};
const items: Record<string, Record<string, number>> = {};
for (const x of V) {
  if (!["BB", "KB", "GT"].includes(x.level)) continue;
  const type = x.fmt === "MC" ? "meerkeuze" : x.fmt === "berekening" ? "berekening" : "open";
  const o = rttiVolgensRegels({ type, stam: x.text, context: "", contextTitel: x.ctx, punten: x.p, vraagtype: x.type });
  for (const k of [x.level, "alle"]) {
    tot[k] ??= { R: 0, T1: 0, T2: 0, I: 0 };
    items[k] ??= { R: 0, T1: 0, T2: 0, I: 0 };
    tot[k][o.rtti] += x.p;
    items[k][o.rtti] += 1;
  }
}
const pct = (r: Record<string, number>) => {
  const s = Object.values(r).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round((v / s) * 100)]));
};
const out = Object.fromEntries(Object.keys(tot).map((k) => [k, { punten: pct(tot[k]!), items: pct(items[k]!) }]));
console.log(JSON.stringify(out));
writeFileSync("/workspace/review236/examen-rtti.json", JSON.stringify(out, null, 1));
