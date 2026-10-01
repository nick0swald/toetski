import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maakQuota } from "./bouwplan.ts";
import { annoteerKalibratie, kalibratie, lengteDoelVoor } from "./kalibratie.ts";
import { effectiefDoel, type EvalInput } from "./eval/rubric.ts";
import { kapPunten, voegStukkenSamen } from "./plan-schrijven.ts";
import type { PlanItem, PlanQuota } from "./bouwplan.ts";
import { labelRtti } from "./rtti-regels.ts";
import type { GegenereerdeToets, Kwaliteitscheck, Vraag } from "./types";

describe("plan-first: lengtedoel planner = rubriek", () => {
  it("lengteAuto: planner-quota en rubriek gebruiken dezelfde kalibratie-richtwaarde", () => {
    const k = kalibratie(2, "KB", 45);
    const form = { lengteAuto: true, aantalVragen: 26, doelPunten: 26 };
    const data = lengteDoelVoor(form, k);
    assert.deepEqual([data.aantalVragen, data.doelPunten], [k.items, k.punten]);
    const bron = "6.1 Geluid maken\n" + "x".repeat(3000) + "\n6.2 Geluid horen\n" + "y".repeat(3000);
    const q = maakQuota({ bron, paragrafen: [{ code: "6.1", titel: "Geluid maken" }, { code: "6.2", titel: "Geluid horen" }], aantalVragen: data.aantalVragen, doelPunten: data.doelPunten, rttiDoel: { R: 35, T1: 40, T2: 20, I: 5 }, kal: k });
    assert.equal(q.punten, k.punten);
    // Rubriek leest de richtwaarde uit de kwaliteitscheck die de app schrijft.
    const kw = annoteerKalibratie({ samenvatting: "", punten: [] } as unknown as Kwaliteitscheck, [], k, bron);
    const doel = effectiefDoel({ kwaliteit: kw } as unknown as GegenereerdeToets, { ...form } as unknown as EvalInput);
    assert.deepEqual([doel.vragen, doel.punten, doel.bron], [k.items, k.punten, "kalibratie"]);
  });
  it("vaste lengte van de docent blijft staan", () => {
    const k = kalibratie(2, "KB", 45);
    const d = lengteDoelVoor({ lengteAuto: false, aantalVragen: 20, doelPunten: 30 }, k);
    assert.deepEqual([d.aantalVragen, d.doelPunten], [20, 30]);
  });
});

const it_ = (n: number, o: Partial<PlanItem> = {}): PlanItem => ({ n, par: "1.1", vorm: "kort", rtti: "T1", punten: 2, begrip: `b${n}`, context: "", kern: `k${n}`, antwoord: `a${n}`, ...o });
const q: PlanQuota = { aantal: 4, punten: 7, paragrafen: [{ code: "1.1", titel: "Geluid", aantal: 4 }], rttiPunten: { R: 2, T1: 3, T2: 1, I: 1 }, vorm: { jn: 0, mc: 2, kort: 2, invul: 0, uitleg: 0, reken: 0, teken: 0 }, reserve: 0 };
const pv = (n: number) => Array.from({ length: n }, (_, i) => ({ punt: 1, criterium: `c${i + 1}` }));

describe("plan-first: punten per vraag begrensd door het plan", () => {
  it("kapPunten: punten en puntenverdeling krimpen samen, nooit omhoog", () => {
    const { v, n } = kapPunten({ punten: 3 }, { puntenverdeling: pv(3) }, 2);
    assert.equal(v.punten, 2);
    assert.deepEqual(n!.puntenverdeling, [{ punt: 1, criterium: "c1" }, { punt: 1, criterium: "c2; c3" }]);
    assert.equal(kapPunten({ punten: 1 }, { puntenverdeling: pv(1) }, 3).v.punten, 1);
    assert.equal(kapPunten({ punten: 4 }, { puntenverdeling: [{ punt: 4, criterium: "alles" }] }, 2).n!.puntenverdeling![0]!.punt, 2);
  });
  it("samenvoegen: schrijver geeft meer punten dan gepland → plan; RTTI uit plan als rttiPlan", () => {
    const plan = [[it_(1, { vorm: "mc", punten: 1, rtti: "R" }), it_(2, { punten: 2, rtti: "T1" })], [it_(3, { punten: 2, rtti: "T2" }), it_(4, { punten: 2, rtti: "I" })]];
    const p = (nrs: number[], pt: number[]) => ({ vragen: nrs.map((n, i) => ({ nummer: n, punten: pt[i], rtti: "T1" as const })), nakijkmodel: nrs.map((n, i) => ({ nummer: n, puntenverdeling: pv(pt[i]!) })) });
    const uit = voegStukkenSamen([p([1, 2], [1, 3]), p([3, 4], [3, 2])], plan, q);
    assert.deepEqual(uit.vragen.map((v) => v.punten), [1, 2, 2, 2]);
    assert.deepEqual(uit.vragen.map((v) => (v as { rttiPlan?: string }).rttiPlan), ["R", "T1", "T2", "I"]);
    for (const v of uit.vragen) assert.equal(uit.nakijkmodel.find((n) => n.nummer === v.nummer)!.puntenverdeling!.reduce((s, c) => s + c.punt, 0), v.punten);
  });
  it("samenvoegen: stuk wijkt af van het plan en totaal te hoog → terug naar het puntendoel", () => {
    const plan = [[it_(1), it_(2)], [it_(3), it_(4)]];
    const p = (nrs: number[], pt: number[]) => ({ vragen: nrs.map((n, i) => ({ nummer: n, punten: pt[i] })), nakijkmodel: nrs.map((n, i) => ({ nummer: n, puntenverdeling: pv(pt[i]!) })) });
    // stuk 2 levert 3 vragen i.p.v. 2 (geen planmatch): 2+2 + 3+3+2 = 12 > 7
    const uit = voegStukkenSamen([p([1, 2], [2, 2]), p([3, 4, 5], [3, 3, 2])], plan, q);
    assert.equal(uit.vragen.reduce((s, v) => s + (v.punten ?? 1), 0), 7);
    assert.deepEqual(uit.vragen.slice(0, 2).map((v) => v.punten), [2, 2], "planvragen eerst gespaard");
  });
});

describe("plan-first: herlabelen houdt de plan-RTTI aan", () => {
  const vraag = (o: Partial<Vraag>): Vraag => ({ nummer: 1, type: "open", rtti: "T1", domein: "6.1", leerdoel: "", punten: 1, stam: "Noem de naam van het deel van het oor dat trilt.", vraagtype: "G-OOR", ...o }) as Vraag;
  it("regel zegt R, plan zegt T1 (1 stap) → plan blijft", () => {
    const zonder = labelRtti([vraag({})])[0]!;
    assert.equal(zonder.rtti, "R", "controle: de regel maakt hier R van");
    const met = labelRtti([vraag({ rttiPlan: "T1" })])[0]!;
    assert.equal(met.rtti, "T1");
    assert.match(met.rttiUitleg ?? "", /bouwplan T1/);
  });
  it("duidelijke tegenspraak (≥ 2 stappen) → regel wint", () => {
    const r = labelRtti([vraag({ rttiPlan: "T2", rtti: "T2" })])[0]!;
    assert.equal(r.rtti, "R");
  });
});
