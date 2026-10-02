import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bouwplanPrompt, maakQuota, paragraafLengtes, parseBouwplan, planRegel, verdeel } from "./bouwplan.ts";
import type { Kalibratie } from "./kalibratie.ts";

const kal = { items: 20, vorm: { jn: 0, mc: 30, kort: 20, invul: 10, uitleg: 10, reken: 25, teken: 5 } } as unknown as Kalibratie;
const bron = [
  "11.1 Voortstuwen en tegenwerken",
  "x".repeat(4000),
  "11.2 Optrekken en afremmen",
  "y".repeat(400),
  "13.1 Geluid maken en horen",
  "z".repeat(1600),
].join("\n");
const pars = [
  { code: "11.1", titel: "Voortstuwen en tegenwerken" },
  { code: "11.2", titel: "Optrekken en afremmen" },
  { code: "13.1", titel: "Geluid maken en horen" },
];

describe("bouwplan: quota", () => {
  it("verdeel = grootste rest, telt op, respecteert minimum", () => {
    assert.deepEqual(verdeel([1, 1, 1], 10), [4, 3, 3]);
    const v = verdeel([100, 1, 1], 10, 2);
    assert.equal(v.reduce((s, x) => s + x, 0), 10);
    assert.ok(v.every((x) => x >= 2));
  });
  it("paragraaflengtes per kop", () => {
    const l = paragraafLengtes(bron, pars);
    assert.ok(l[0]! > l[2]! && l[2]! > l[1]!);
  });
  it("eerlijke diepgang: dunne paragraaf krijgt ≥ 2, dikke slokt niet alles op (√-demping)", () => {
    const q = maakQuota({ bron, paragrafen: pars, aantalVragen: 20, doelPunten: 34, rttiDoel: { R: 25, T1: 40, T2: 27, I: 8 }, kal });
    const n = q.paragrafen.map((p) => p.aantal);
    assert.equal(n.reduce((s, x) => s + x, 0), 20);
    assert.ok(n[1]! >= 2, `dunne paragraaf: ${n[1]}`);
    assert.ok(n[0]! <= 10, `dikke paragraaf: ${n[0]} (lineair zou ~12 zijn)`);
    const r = q.rttiPunten;
    assert.equal(r.R + r.T1 + r.T2 + r.I, 34);
    assert.ok(r.I >= 2);
    assert.equal(Object.values(q.vorm).reduce((s, x) => s + x, 0), 20);
  });
  it("prompt noemt aantallen per paragraaf, RTTI-punten, namenlijst en reserve", () => {
    const q = maakQuota({ bron, paragrafen: pars, aantalVragen: 20, doelPunten: 34, rttiDoel: { R: 25, T1: 40, T2: 27, I: 8 }, kal });
    const p = bouwplanPrompt(q);
    assert.match(p, /11\.2 Optrekken en afremmen: \d+ vragen/);
    assert.match(p, /RTTI in punten: R \d+ · T1 \d+ · T2 \d+ · I \d+/);
    assert.match(p, /Sanne/);
    assert.match(p, /reservevragen/);
    assert.doesNotMatch(p, /college|lyceum/i);
  });
});

describe("bouwplan: parsen", () => {
  it("korte sleutels, gesloten = 1 punt, nummering doorlopend, reserve achteraan", () => {
    const plan = parseBouwplan({
      items: [
        { n: 1, p: "11.1", v: "mc", r: "R", pt: 2, b: "wrijving", c: "fietser op nat wegdek", w: "Daan", k: "welke kracht", a: "wrijvingskracht", g: "" },
        { n: 2, p: "§11.2", v: "berekening", r: "t2", pt: 3, b: "F=m·a", c: "", w: "", k: "bereken de kracht", a: "F = 600 N" },
        { n: 5, p: "13.1", v: "uitleg", r: "I", pt: 2, b: "tussenstof", c: "ruimte", w: "-", k: "leg uit", a: "geen lucht" },
      ],
      reserve: [{ p: "13.1", v: "jn", r: "R", b: "trilling", k: "stelling", a: "juist" }],
    });
    assert.deepEqual(plan.items.map((x) => x.n), [1, 2, 3]);
    assert.equal(plan.items[0]!.punten, 1);
    assert.equal(plan.items[1]!.vorm, "reken");
    assert.equal(plan.items[1]!.par, "11.2");
    assert.equal(plan.items[1]!.rtti, "T2"); // "t2" → T2
    assert.equal(plan.items[2]!.persoon, undefined);
    assert.equal(plan.reserve[0]!.n, 4);
    assert.match(planRegel(plan.items[0]!), /meerkeuze, R, 1p — begrip: wrijving — situatie: fietser op nat wegdek — persoon: Daan/);
  });
  it("te weinig items → fout (dan oude route)", () => {
    assert.throws(() => parseBouwplan({ items: [{ k: "x", b: "y" }] }));
  });
});

describe("bouwplan: rij-formaat", () => {
  it("rijen (arrays) worden items", () => {
    const plan = parseBouwplan({
      items: [
        ["11.1", "mc", "R", 1, "wrijving", "fietser op nat wegdek", "Daan", "welke kracht remt", "wrijvingskracht", ""],
        ["11.2", "reken", "T2", 3, "F=m·a", "", "", "bereken de kracht", "600 N", "Bakfiets"],
        ["13.1", "uitleg", "I", 2, "tussenstof", "ruimte", "", "leg uit", "geen lucht", ""],
      ],
      reserve: [["13.2", "jn", "R", 1, "toonhoogte", "", "", "stelling", "juist", ""]],
    });
    assert.equal(plan.items[0]!.persoon, "Daan");
    assert.equal(plan.items[1]!.groep, "Bakfiets");
    assert.equal(plan.items[1]!.punten, 3);
    assert.equal(plan.reserve[0]!.vorm, "jn");
  });
});
