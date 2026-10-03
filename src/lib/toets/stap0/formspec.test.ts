import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alsToetsSpec, formEisen, isMc, keurGeneratie, nTermVoorCesuur, selecteerExact, specPrompt, vasteVorm, vormVan, waaromNietGelukt, type SpecInvoer } from "./grok-spec.ts";
import { laadFixtures } from "./laad.ts";
import type { VraagstukSpec } from "./spec.ts";

const vs = () => laadFixtures().filter((f): f is VraagstukSpec & { soort: "vraagstuk" } => f.soort === "vraagstuk");
const basis: SpecInvoer = { titel: "H1 Elektriciteit", leerweg: "GT", leerjaar: 3, duurMinuten: 45, bronmateriaal: "1.1 Stroom\nStroomsterkte.", rttiDoel: { R: 15, T1: 45, T2: 34, I: 6 } };

describe("stap 0: formulier is de harde spec", () => {
  it("formEisen neemt vak, MC/open, extra eisen, moeilijkheid, examenvragen en cesuur over", () => {
    const e = formEisen({ vak: "NaSk", mcVragen: 12, openVragen: 10, extraEisen: "geen formules geven", moeilijkheid: "moeilijk", examenvragen: true, cijferNorm: { cesuurPct: 55 } }, { stuurdocument: "PTA SE4.3" });
    assert.deepEqual(e, { vak: "NaSk", mcVragen: 12, openVragen: 10, extraEisen: "geen formules geven\nPTA SE4.3", moeilijkheid: "moeilijk", examenvragen: true, nTerm: 0.55 });
    assert.equal(formEisen({ mcVragen: 5 }).mcVragen, undefined, "alleen MC zonder open: geen vaste vorm");
  });

  it("N-term uit de cesuur: 50 % → N = 1, 55 % → 0,55, begrensd op 0–2", () => {
    assert.equal(nTermVoorCesuur(50), 1);
    assert.equal(nTermVoorCesuur(55), 0.55);
    assert.equal(nTermVoorCesuur(90), 0);
    assert.equal(nTermVoorCesuur(20), 2);
    assert.equal(alsToetsSpec({ titel: "x", vraagstukken: [] }, { ...basis, nTerm: 0.55 }).nTerm, 0.55);
  });

  it("prompt eist de exacte MC/open-verdeling en het puntentotaal, met de extra eisen", () => {
    const p = specPrompt({ ...basis, mcVragen: 12, openVragen: 10, extraEisen: "alleen paragraaf 1.1", vak: "NaSk" }, { items: 22, punten: 32, vorm: { mc: 27 } as never });
    assert.match(p, /PRECIES 12 meerkeuzedeelvragen/);
    assert.match(p, /PRECIES 10 open deelvragen/);
    assert.match(p, /PRECIES 32 punten/);
    assert.match(p, /alleen paragraaf 1\.1/);
    assert.doesNotMatch(p, /VRAAGVORMEN/, "kalibratievorm vervalt als de docent de vorm geeft");
    assert.match(specPrompt({ ...basis, mcVragen: 0, openVragen: 15 }, { items: 15, punten: 17 }), /GEEN meerkeuze/);
  });

  it("keurGeneratie telt MC en open en meldt elke afwijking van de exacte spec", () => {
    const gen = { titel: "t", vraagstukken: vs().slice(0, 3) };
    const alle = gen.vraagstukken.flatMap((v) => v.deelvragen);
    const mc = alle.filter(isMc).length;
    const punten = alle.reduce((s, d) => s + d.punten, 0);
    const ok = keurGeneratie(gen, { ...basis, mcVragen: mc, openVragen: alle.length - mc }, { items: alle.length, punten });
    assert.equal(ok.feiten.mc, mc);
    assert.equal(ok.feiten.open, alle.length - mc);
    assert.ok(!ok.fouten.some((f) => f.startsWith("spec:")), ok.fouten.join("\n"));
    const mis = keurGeneratie(gen, { ...basis, mcVragen: mc + 1, openVragen: alle.length - mc }, { items: alle.length, punten: punten + 1 });
    assert.ok(mis.fouten.some((f) => /spec: .*precies \d+ meerkeuze/.test(f)));
    assert.ok(mis.fouten.some((f) => new RegExp(`precies ${punten + 1}$`).test(f)));
    assert.equal(vasteVorm({}), null);
  });

  it("selecteerExact haalt precies punten + MC/open, of geeft null (dan niet gelukt)", () => {
    const gen = { titel: "t", vraagstukken: vs() };
    const alle = gen.vraagstukken.flatMap((v) => v.deelvragen);
    const totaal = alle.reduce((s, d) => s + d.punten, 0);
    const f = vormVan(gen.vraagstukken);
    // doel: de hele toets min het laatste vraagstuk (bestaat dus zeker)
    const zonderLaatste = gen.vraagstukken.slice(0, -1);
    const doel = { mc: vormVan(zonderLaatste).mc, open: vormVan(zonderLaatste).open, punten: zonderLaatste.reduce((s, v) => s + v.deelvragen.reduce((a, d) => a + d.punten, 0), 0) };
    const sel = selecteerExact(gen, { ...basis, mcVragen: doel.mc, openVragen: doel.open }, { punten: doel.punten })!;
    assert.ok(sel);
    const d2 = sel.vraagstukken.flatMap((v) => v.deelvragen);
    assert.equal(d2.reduce((s, d) => s + d.punten, 0), doel.punten);
    assert.deepEqual(vormVan(sel.vraagstukken), { mc: doel.mc, open: doel.open });
    assert.equal(selecteerExact(gen, { ...basis, mcVragen: f.mc + 1, openVragen: f.open }, { punten: totaal }), null, "te weinig MC → null");
    assert.equal(selecteerExact(gen, basis, { punten: totaal + 1 }), null, "te weinig punten → null");
    assert.match(waaromNietGelukt(gen, { ...basis, mcVragen: 12, openVragen: 10 }, { punten: 32 }, 0.954, "vangnet"), /^Niet gelukt: je vroeg 12 meerkeuze, 10 open en 32 punten; .*kostenplafond.*\$0\.95/);
  });
  it("selecteerExact: 1p-R-grens al tijdens het kiezen, staart weglaten tot minstens 3 deelvragen", () => {
    const dv = (id: string, p: number, rtti: string) => ({ id, punten: p, rtti, stam: "x", scorestappen: [], antwoordmodel: { regels: ["x"] } });
    const v = (id: string, ps: [number, string][]) => ({ id, soort: "vraagstuk", titel: id, se: "SE4.1", hoofdstuk: "1", context: [], deelvragen: ps.map(([p, r], i) => dv(`${id}-${i}`, p, r)) }) as unknown as VraagstukSpec;
    const gen = { titel: "t", vraagstukken: [v("r", [[1, "R"], [1, "R"], [1, "R"], [1, "R"], [1, "R"]]), v("t", [[2, "T1"], [2, "T1"], [2, "T2"]])] };
    // BB (45 %): 11 punten = alles, 5 van de 11 punten 1p-R (max 4) → null; 10 punten: r zonder laatste deelvraag
    const bb = { ...basis, leerweg: "BB" as const };
    assert.equal(selecteerExact(gen, bb, { punten: 11 }), null);
    assert.deepEqual(selecteerExact(gen, bb, { punten: 10 })!.vraagstukken.map((x) => x.deelvragen.length), [4, 3]);
  });
});
