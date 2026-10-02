import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Bouwplan, PlanItem, PlanQuota } from "./bouwplan.ts";
import { bouwplanPrompt, contextBlokkenDoel, parseBouwplan } from "./bouwplan.ts";
import { deelAantal, herstelBouwplan, openHard } from "./bouwplan-check.ts";
import { doelInLesstof, novaDoelenPerParagraaf } from "./leerdoelen-plan.ts";
import { houdPlanPunten } from "./afwerken.ts";
import type { NakijkItem, Vraag } from "./types";

const item = (n: number, o: Partial<PlanItem>): PlanItem => ({ n, par: "1.1", vorm: "kort", rtti: "T1", punten: 1, begrip: `begrip${n}`, context: "", kern: `vraag ${n}`, antwoord: `antwoord${n}`, ...o });
const quota = (o: Partial<PlanQuota> = {}): PlanQuota => ({
  aantal: 12,
  punten: 18,
  paragrafen: [
    { code: "1.1", titel: "Krachten", aantal: 4 },
    { code: "1.2", titel: "Veren", aantal: 4 },
    { code: "1.3", titel: "Druk", aantal: 4 },
  ],
  rttiPunten: { R: 4, T1: 7, T2: 5, I: 2 },
  vorm: { jn: 0, mc: 5, kort: 3, invul: 0, uitleg: 2, reken: 2, teken: 0 },
  reserve: 0,
  ...o,
});
const pars = ["1.1", "1.2", "1.3"];

describe("planner-vorm: prompt", () => {
  it("geen 12-woordenlimiet of kale-R-regel; wel contextblokken, gesloten-plafond en geen jn bij quotum 0", () => {
    const p = bouwplanPrompt(quota());
    assert.doesNotMatch(p, /12 woorden/);
    assert.doesNotMatch(p, /Kennisvragen \(R\) meestal zonder situatie/);
    assert.match(p, /Contextblokken: 2 groepen/);
    assert.match(p, /nooit meer dan 6 gesloten vragen, geen juist\/onjuist/);
    assert.match(p, /bedoeling van de vraag/);
    assert.equal(contextBlokkenDoel({ aantal: 24 }), 3);
  });
});

describe("planner-vorm: parser", () => {
  it("kapotte groepstitel \"],[\" en lege velden worden leeg", () => {
    const rij = (g: string, c = "auto op de weg") => ["1.1", "mc", "R", 1, "kracht", c, "", "welke kracht", "zwaartekracht", g];
    const plan = parseBouwplan({ items: [rij("],["), rij("-", "-"), rij("Slee op ijs"), rij(""), rij("")] });
    assert.equal(plan.items[0]!.groep, undefined);
    assert.equal(plan.items[1]!.groep, undefined);
    assert.equal(plan.items[1]!.context, "");
    assert.equal(plan.items[2]!.groep, "Slee op ijs");
  });
});

describe("planner-vorm: herstel", () => {
  const mcPlan = (): Bouwplan => ({
    versie: 1,
    items: [
      ...Array.from({ length: 8 }, (_, i) => item(i + 1, { vorm: i < 2 ? "jn" : "mc", rtti: i % 2 ? "T1" : "R", par: pars[i % 3], begrip: `uniek begrip ${i}`, context: `situatie nummer ${i}` })),
      item(9, { vorm: "reken", rtti: "T1", punten: 2, par: "1.2", begrip: "veerconstante berekenen", context: "trampoline veer" }),
      item(10, { vorm: "uitleg", rtti: "T2", punten: 2, par: "1.2", begrip: "stugheid veer", context: "matras" }),
      item(11, { vorm: "reken", rtti: "T2", punten: 3, par: "1.3", begrip: "druk berekenen", context: "kast op vloer" }),
      item(12, { vorm: "teken", rtti: "T1", punten: 2, par: "1.1", begrip: "krachtpijl", kern: "zwaartekracht op een doos van 3 kg, schaal 1 cm = 10 N" }),
    ],
    reserve: [],
  });
  it("jn → mc bij quotum 0, hooguit quotum+1 gesloten, tekenvraag blijft tekenvraag", () => {
    const { plan, issues } = herstelBouwplan(mcPlan(), quota());
    assert.equal(plan.items.filter((x) => x.vorm === "jn").length, 0);
    assert.ok(plan.items.filter((x) => x.vorm === "mc" || x.vorm === "jn").length <= 6);
    const teken = plan.items.find((x) => x.begrip === "krachtpijl")!;
    assert.equal(teken.vorm, "teken");
    assert.match(teken.kern, /^teken:/);
    assert.deepEqual(openHard(issues), []);
  });
  it("contextblokken: losse reken + uitleg uit dezelfde paragraaf worden één blok, aaneen, berekening eerst", () => {
    const { plan, issues } = herstelBouwplan(mcPlan(), quota());
    const groepen = [...new Set(plan.items.map((x) => x.groep).filter(Boolean))];
    assert.ok(groepen.length >= 2, `groepen: ${groepen.join(", ")} / ${JSON.stringify(issues.filter((i) => i.code === "context"))}`);
    const veer = plan.items.filter((x) => x.par === "1.2" && x.groep);
    assert.equal(veer.length, 2);
    assert.equal(veer[0]!.vorm, "reken");
    assert.equal(veer[1]!.n, veer[0]!.n + 1, "aaneen");
    assert.equal(veer[1]!.context, "");
    assert.ok(veer[1]!.let?.some((l) => /vervolgvraag/.test(l)));
  });
  it("meerdelige kort-vraag krijgt 1 punt per onderdeel en houdt die bij het puntenbalanceren", () => {
    const plan: Bouwplan = {
      versie: 1,
      items: [
        item(1, { kern: "noem de drie gehoorbeentjes", begrip: "gehoorbeentjes", rtti: "R", par: "1.1" }),
        item(2, { kern: "noteer bron, tussenstof en ontvanger", begrip: "geluidsketen", par: "1.2" }),
        ...Array.from({ length: 10 }, (_, i) => item(i + 3, { vorm: "kort", punten: 2, rtti: "T1", par: pars[i % 3], begrip: `ander ${i}`, context: `plek ${i}` })),
      ],
      reserve: [],
    };
    const { plan: p } = herstelBouwplan(plan, quota({ punten: 14, vorm: { jn: 0, mc: 0, kort: 12, invul: 0, uitleg: 0, reken: 0, teken: 0 } }));
    assert.equal(p.items.find((x) => x.begrip === "gehoorbeentjes")!.punten, 3);
    assert.equal(p.items.find((x) => x.begrip === "geluidsketen")!.punten, 3);
  });
  it("deelAantal", () => {
    assert.equal(deelAantal("Noem twee geluidsbronnen"), 2);
    assert.equal(deelAantal("noem de drie gehoorbeentjes"), 3);
    assert.equal(deelAantal("noteer bron, tussenstof en ontvanger"), 3);
    assert.equal(deelAantal("hoe groot is 2 keer de kracht"), 0);
    assert.equal(deelAantal("wat meet je met een decibelmeter"), 0);
  });
});

describe("planner-vorm: Nova-doelen", () => {
  it("doel alleen als de lesstof de inhoudswoorden noemt", () => {
    const bron = "Geluid ontstaat als een voorwerp trilt. De frequentie bepaalt de toonhoogte. Maatregelen tegen geluidshinder bij de bron.";
    assert.equal(doelInLesstof("het verschil uitleggen tussen geluid absorberen en weerkaatsen", bron), false);
    assert.equal(doelInLesstof("het verband beschrijven tussen de frequentie en de toonhoogte", bron), true);
  });
  it("KB2 Geluid: op titel gekoppeld (6.4 Geluidssnelheid krijgt geen hinder-doelen), niets buiten de lesstof", () => {
    const c = JSON.parse(readFileSync(new URL("../../../scripts/eval/inputs/geluid-kb2.json", import.meta.url), "utf8"));
    const inp = c.input ?? c;
    const paragrafen = [
      { code: "6.1", titel: "Geluid maken en horen" },
      { code: "6.2", titel: "Hoge en lage tonen" },
      { code: "6.3", titel: "Hard en zacht geluid" },
      { code: "6.4", titel: "Geluidssnelheid" },
      { code: "6.5", titel: "Geluidshinder" },
      { code: "6.6", titel: "Het oor" },
    ];
    const d = novaDoelenPerParagraaf(paragrafen, { titel: inp.titel, bron: inp.bronmateriaal, leerjaar: inp.leerjaar, leerweg: inp.leerweg });
    const alle = Object.values(d).flat().join(" | ");
    assert.doesNotMatch(alle, /absorberen|weerkaatsen|pijngrens|audiogram/i);
    assert.doesNotMatch((d["6.4"] ?? []).join(" "), /hinder|overlast|isolatie/i);
    assert.doesNotMatch(alle, /PLUS/);
  });
});

describe("planner-vorm: punten na reparatie", () => {
  it("houdPlanPunten: reparatie/normalisatie verhoogt geplande punten niet", () => {
    const v = [{ nummer: 1, type: "open", rtti: "R", domein: "6.6", leerdoel: "", punten: 3, stam: "Noem de gehoorbeentjes.", puntenPlan: 1 }] as Vraag[];
    const n = [{ nummer: 1, modelantwoord: "hamer, aambeeld, stijgbeugel", puntenverdeling: [1, 2, 3].map((i) => ({ punt: 1, criterium: `c${i}` })) }] as NakijkItem[];
    const r = houdPlanPunten({ vragen: v, nakijkmodel: n });
    assert.equal(r.vragen[0]!.punten, 1);
    assert.equal(r.nakijkmodel[0]!.puntenverdeling.reduce((s, c) => s + c.punt, 0), 1);
    const zonder = houdPlanPunten({ vragen: [{ ...v[0]!, puntenPlan: undefined }], nakijkmodel: n });
    assert.equal(zonder.vragen[0]!.punten, 3);
  });
});
