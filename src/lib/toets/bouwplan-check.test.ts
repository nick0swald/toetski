import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Bouwplan, PlanItem, PlanQuota } from "./bouwplan.ts";
import { herstelBouwplan, openHard, rttiPuntenVan, sleutelwoorden } from "./bouwplan-check.ts";
import { andereNovaHoofdstukken, maakLeerdoelPlan } from "./leerdoelen-plan.ts";

const item = (n: number, o: Partial<PlanItem>): PlanItem => ({ n, par: "1.1", vorm: "kort", rtti: "T1", punten: 2, begrip: `begrip${n}`, context: "", kern: `vraag ${n}`, antwoord: `antwoord${n}`, ...o });
const quota: PlanQuota = {
  aantal: 6,
  punten: 10,
  paragrafen: [
    { code: "1.1", titel: "Krachten", aantal: 2 },
    { code: "1.2", titel: "Wrijving", aantal: 2 },
    { code: "1.3", titel: "Druk", aantal: 2 },
  ],
  rttiPunten: { R: 2, T1: 4, T2: 3, I: 1 },
  vorm: { jn: 0, mc: 2, kort: 2, invul: 0, uitleg: 1, reken: 1, teken: 0 },
  reserve: 2,
};

describe("bouwplan-check", () => {
  it("lege paragraaf → reserve ingewisseld (hard, hersteld)", () => {
    const plan: Bouwplan = {
      versie: 1,
      items: [
        item(1, { vorm: "mc", rtti: "R", punten: 1, par: "1.1", begrip: "zwaartekracht" }),
        item(2, { vorm: "mc", rtti: "R", punten: 1, par: "1.1", begrip: "veerkracht" }),
        item(3, { par: "1.1", begrip: "normaalkracht" }),
        item(4, { par: "1.2", begrip: "rolwrijving" }),
        item(5, { par: "1.2", begrip: "luchtwrijving", vorm: "uitleg", rtti: "T2" }),
        item(6, { par: "1.1", begrip: "resulterende kracht", vorm: "reken", rtti: "T2" }),
      ],
      reserve: [item(7, { par: "1.3", begrip: "druk p = F/A", vorm: "reken" })],
    };
    const { plan: p, issues } = herstelBouwplan(plan, quota);
    assert.ok(p.items.some((x) => x.par === "1.3"));
    assert.ok(issues.some((i) => i.code === "dekking" && i.hersteld));
    assert.deepEqual(openHard(issues), []);
    assert.equal(p.items.reduce((s, x) => s + x.punten, 0), 10);
    assert.ok(p.items.some((x) => x.rtti === "I"), "minstens één I-vraag");
  });

  it("dubbele/niet-westerse naam → vervangen; situaties die lijken → aanwijzing of reserve", () => {
    const plan: Bouwplan = {
      versie: 1,
      items: [
        item(1, { vorm: "mc", punten: 1, persoon: "Daan", context: "Daan fietst naar de sportclub" }),
        item(2, { vorm: "mc", punten: 1, par: "1.2", persoon: "Daan", context: "kermis met botsautootjes" }),
        item(3, { par: "1.2", persoon: "Xerxes", context: "fietser fietst naar de sportclub in de regen" }),
        item(4, { par: "1.3" }),
        item(5, { par: "1.3", rtti: "T2" }),
        item(6, { par: "1.1", rtti: "R" }),
      ],
      reserve: [],
    };
    const { plan: p, issues } = herstelBouwplan(plan, quota);
    const namen = p.items.map((x) => x.persoon).filter(Boolean);
    assert.equal(new Set(namen).size, namen.length, "elke naam één keer");
    assert.ok(!namen.includes("Xerxes"));
    assert.ok(issues.some((i) => i.code === "context"));
    assert.ok(p.items.some((x) => x.let?.some((l) => /andere situatie/.test(l))));
  });

  it("weggever: antwoord van de ene vraag in de stam van een andere → aanwijzing", () => {
    const plan: Bouwplan = {
      versie: 1,
      items: [
        item(1, { vorm: "mc", punten: 1, begrip: "onderdeel oor", antwoord: "slakkenhuis", kern: "waar worden trillingen zenuwsignalen" }),
        item(2, { vorm: "mc", punten: 1, par: "1.2", kern: "wat gebeurt er met de haartjes in het slakkenhuis bij hard geluid" }),
        item(3, { par: "1.2" }),
        item(4, { par: "1.3" }),
        item(5, { par: "1.3", rtti: "T2" }),
        item(6, { par: "1.1" }),
      ],
      reserve: [],
    };
    const { plan: p, issues } = herstelBouwplan(plan, quota);
    assert.ok(issues.some((i) => i.code === "weggever"));
    assert.ok(p.items.find((x) => /haartjes/.test(x.kern))!.let!.some((l) => /slakkenhuis/.test(l)));
  });

  it("volgorde: gesloten eerst, groepen aaneen, doorgenummerd; schoolnaam eruit", () => {
    const plan: Bouwplan = {
      versie: 1,
      items: [
        item(1, { groep: "Bakfiets", par: "1.1" }),
        item(2, { vorm: "mc", punten: 1, par: "1.2" }),
        item(3, { par: "1.3", context: "practicum op het Da Vinci College" }),
        item(4, { groep: "Bakfiets", par: "1.1" }),
        item(5, { vorm: "mc", punten: 1, par: "1.2" }),
        item(6, { par: "1.3" }),
      ],
      reserve: [],
    };
    const { plan: p, issues } = herstelBouwplan(plan, quota);
    assert.deepEqual(p.items.map((x) => x.n), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(p.items.slice(0, 2).map((x) => x.vorm), ["mc", "mc"]);
    const g = p.items.map((x, i) => (x.groep === "Bakfiets" ? i : -1)).filter((i) => i >= 0);
    assert.equal(g[1]! - g[0]!, 1);
    assert.ok(issues.some((i) => i.code === "school"));
    assert.doesNotMatch(p.items.map((x) => x.context).join(" "), /College/);
  });

  it("hulpjes", () => {
    assert.deepEqual(sleutelwoorden("De fietser fietst"), ["fiets"]);
    assert.deepEqual(rttiPuntenVan([item(1, { rtti: "I", punten: 3 })]), { R: 0, T1: 0, T2: 0, I: 3 });
  });
});

describe("leerdoelen: alle hoofdstukken uit de lesstof", () => {
  const bron = [
    "11.1 Voortstuwen en tegenwerken", "tekst", "11.2 Optrekken en afremmen", "tekst", "11.4 Veiligheid in het verkeer", "tekst",
    "13.1 Geluidsbronnen", "tekst", "13.2 Toonhoogte", "tekst", "13.3 Geluidssterkte", "tekst",
  ].join("\n");
  it("herkent het tweede hoofdstuk op titel, ook als de editie anders nummert (H11 ≈ Nova H16)", () => {
    const extra = andereNovaHoofdstukken({ bron, leerjaar: 4, leerweg: "GT" }, 13);
    assert.deepEqual(extra.map((e) => e.n), [16]);
  });
  it("leerdoelplan bevat doelen uit beide hoofdstukken", () => {
    const p = maakLeerdoelPlan({ titel: "Kracht, beweging en geluid", bron, leerjaar: 4, leerweg: "GT", doelPunten: 37, aantalVragen: 22 })!;
    assert.match(p.herkomst, /H13 Geluid/);
    assert.match(p.herkomst, /H16 Kracht en beweging/);
    assert.ok(p.doelen.some((d) => d.id.startsWith("K/8")), "geluid");
    assert.ok(p.doelen.some((d) => /^K\/(6|9)\./.test(d.id)), "kracht/beweging");
  });
});
