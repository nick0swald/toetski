import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { annoteerKalibratie, isNaskVak, kalibratie, kalibratiePrompt, normaliseerVraagtypen, novaParagrafen, relevanteVraagtypen, vormAantallen } from "./kalibratie.ts";
import { toetsLengte } from "./lengte.ts";
import { heeftGroepen, herstelGroepen, ordenVragen, startGroep } from "./context-groepen.ts";
import { labelRtti, rttiVolgensRegels, TYPE_RTTI } from "./rtti-regels.ts";
import { aantalExamenContexten, bronLabel, kiesExamenContexten, magExamenvragen, markeerExamenvragen, wilGeenExamenvragen } from "./examenvragen.ts";
import { CSE_CONTEXTEN } from "./cse-contexten.ts";
import { VRAAGTYPEN } from "./kalibratie-data.ts";
import { DOORREKENEN, isGegevensCriterium, rekenRubriek, repareerPunten } from "./punten-rubric.ts";
import { lengteIssues } from "./afwerken.ts";
import { presetVoorLeerjaar, RTTI_EXAMEN, RTTI_PRESETS } from "./constants.ts";
import type { NakijkItem, Vraag } from "./types";

const v = (n: number, extra: Partial<Vraag> = {}): Vraag => ({ nummer: n, type: "open", rtti: "T1", domein: "d", leerdoel: "l", punten: 1, stam: `Vraag ${n}`, ...extra });
const nk = (n: number): NakijkItem => ({ nummer: n, modelantwoord: `m${n}`, puntenverdeling: [{ punt: 1, criterium: "x" }], nietToekennen: [] });

describe("kalibratie op de schooltoetsen", () => {
  it("3GT 40 min ≈ 21 vragen / 30 punten, formule zelf kiezen, kleine situaties", () => {
    const k = kalibratie(3, "GT", 40);
    assert.ok(Math.abs(k.items - 21) <= 1, `items ${k.items}`);
    assert.ok(Math.abs(k.punten - 30) <= 2, `punten ${k.punten}`);
    assert.equal(k.formule, "zelf-kiezen");
    assert.equal(k.opbouw, "situaties");
  });
  it("klas 1–2 KB/GT ~1,8 min per vraag en ~80–85% 1-puntsvragen, formule in de vraag", () => {
    for (const lw of ["KB", "GT"] as const) {
      const k = kalibratie(2, lw, 45);
      assert.ok(k.minPerItem >= 1.6 && k.minPerItem <= 2.1);
      assert.ok(k.pct1p >= 78 && k.pct1p <= 86);
      assert.equal(k.formule, "in-vraag");
      assert.equal(k.opbouw, "los");
    }
  });
  it("3BB en 4BB: blokken juist/onjuist → MC → open, formules in woorden bovenaan", () => {
    const k3 = kalibratie(3, "BB", 50);
    assert.equal(k3.opbouw, "blokken");
    assert.equal(k3.formule, "bovenaan-woorden");
    assert.ok(k3.vorm.jn >= 45);
    const k4 = kalibratie(4, "BB", 50);
    assert.ok(k4.examenvragenBlok);
    assert.match(kalibratiePrompt(k4), /Examenvragen/);
    assert.match(kalibratiePrompt(k3), /Formules:/);
  });
  it("4GT = mini-CSE met contexten, geen formule", () => {
    const k = kalibratie(4, "GT", 40);
    assert.equal(k.opbouw, "cse");
    assert.equal(k.formule, "niet-gegeven");
    assert.ok(k.items >= 13 && k.items <= 17);
    assert.match(kalibratiePrompt(k), /contextTitel/);
  });
  it("examenniveau gebruikt de CSE-kalibratie", () => {
    const k = kalibratie(4, "GT", 120, { examen: true });
    assert.ok(k.items >= 38 && k.items <= 44, `items ${k.items}`);
    assert.ok(k.punten >= 68 && k.punten <= 82, `punten ${k.punten}`);
  });
  it("vormAantallen telt op tot het aantal vragen", () => {
    for (const [j, lw] of [[1, "BB"], [2, "KB"], [3, "GT"], [4, "KB"]] as const) {
      const k = kalibratie(j, lw, 45);
      const a = vormAantallen(k);
      assert.equal(Object.values(a).reduce((s, x) => s + x, 0), k.items);
    }
  });
  it("toetsLengte: NaSk gekalibreerd, andere vakken ongewijzigd", () => {
    assert.deepEqual(toetsLengte(45, "KB"), { punten: 26, vragen: 14 });
    assert.deepEqual(toetsLengte(45, "KB", "normaal", { leerjaar: 2, vak: "Biologie" }), { punten: 26, vragen: 14 });
    const n = toetsLengte(40, "GT", "normaal", { leerjaar: 3, vak: "NaSk" });
    assert.ok(Math.abs(n.vragen - 21) <= 1);
  });
  it("isNaskVak herkent vak en lesstof", () => {
    assert.ok(isNaskVak("NaSk"));
    assert.ok(isNaskVak("natuurkunde"));
    assert.ok(!isNaskVak("Biologie"));
    assert.ok(isNaskVak("", "Geluid en trilling. De frequentie in hertz. Decibel meten. Echo. Oscilloscoop."));
  });
  it("prompt bevat nakijkstijl met examenregel en opdrachtwoorden", () => {
    const t = kalibratiePrompt(kalibratie(3, "KB", 45));
    assert.match(t, /1 punt per stap/);
    assert.match(t, /hooguit 1 punt/);
    assert.match(t, /Bereken, Noteer/);
    assert.doesNotMatch(t, /gegevens en gevraagde'? \+/);
  });
});

describe("vraagtypen", () => {
  it("62 examentypen + OVERIG + drie onderbouwtypen", () => {
    const ids = VRAAGTYPEN.map((t) => t.id);
    for (const id of ["O-LICHT", "O-HEELAL", "O-WEER", "G-ECHO", "OVERIG"]) assert.ok(ids.includes(id), id);
    assert.equal(ids.length, 66);
  });
  it("elk type heeft een standaard-RTTI", () => {
    for (const t of VRAAGTYPEN) assert.ok(TYPE_RTTI[t.id], t.id);
  });
  it("onderbouwtypen alleen in klas 1–2; frequente examentypen eerst vanaf klas 3", () => {
    const bron = "Licht en schaduw. Een spiegel en een lens. Breking van licht. Kleuren van licht.";
    assert.ok(relevanteVraagtypen(bron, 1, "GT").some((t) => t.id === "O-LICHT"));
    assert.ok(!relevanteVraagtypen(bron, 3, "GT").some((t) => t.id === "O-LICHT"));
    const g = relevanteVraagtypen("geluid geluid echo frequentie decibel oscilloscoop", 4, "GT");
    for (let i = 1; i < g.length; i++) assert.ok(g[i - 1]!.freq >= g[i]!.freq);
  });
  it("onbekende typen worden OVERIG", () => {
    const out = normaliseerVraagtypen([v(1, { vraagtype: "g-echo" }), v(2, { vraagtype: "XYZ" }), v(3)]);
    assert.deepEqual(out.map((q) => q.vraagtype), ["G-ECHO", "OVERIG", "OVERIG"]);
  });
  it("feedback meldt kalibratie en typen", () => {
    const k = kalibratie(2, "KB", 45);
    const kw = annoteerKalibratie({ samenvatting: "", punten: [] }, [v(1, { vraagtype: "G-OSC" }), v(2, { vraagtype: "G-BRON" })], k, "geluid");
    assert.ok(kw.punten.some((p) => p.criterium === "Vraagtypen" && /G-OSC 1×/.test(p.toelichting)));
    assert.ok(kw.punten.some((p) => p.criterium.startsWith("Kalibratie") && p.oordeel === "aandacht"));
  });
});

describe("Nova", () => {
  it("herkent een Nova-hoofdstuk aan titel en paragrafen", () => {
    const pars = novaParagrafen("H8 Geluid", "", 2, "KB");
    assert.ok(pars.length >= 3, JSON.stringify(pars));
    assert.ok(pars.every((p) => p.code.startsWith("8.")));
    assert.equal(novaParagrafen("H8 Geluid", "", 2, "BB").length, 0);
  });
});

describe("doorlopende contexten", () => {
  const groep = () => [
    v(1, { type: "meerkeuze", opties: [{ letter: "A", tekst: "a" }, { letter: "B", tekst: "b" }] }),
    v(2, { contextTitel: "Friettent", context: "Daan werkt bij Frituur De Vette Hap." }),
    v(3, { contextTitel: "Friettent" }),
    v(4, { type: "juist-onjuist", opties: [{ letter: "A", tekst: "Juist" }, { letter: "B", tekst: "Onjuist" }] }),
  ];
  it("mc-eerst houdt de groep heel en de intro bij de eerste vraag", () => {
    const out = ordenVragen(groep(), [1, 2, 3, 4].map(nk), "mc-eerst");
    assert.deepEqual(out.vragen.map((q) => q.stam), ["Vraag 1", "Vraag 4", "Vraag 2", "Vraag 3"]);
    assert.equal(out.vragen[2]!.context, "Daan werkt bij Frituur De Vette Hap.");
    assert.equal(out.nakijkmodel[1]!.modelantwoord, "m4");
    assert.equal(startGroep(out.vragen, 2), "Friettent");
    assert.equal(startGroep(out.vragen, 3), undefined);
  });
  it("blokken: juist/onjuist → meerkeuze → rest", () => {
    const out = ordenVragen(groep(), [1, 2, 3, 4].map(nk), "blokken");
    assert.deepEqual(out.vragen.map((q) => q.stam), ["Vraag 4", "Vraag 1", "Vraag 2", "Vraag 3"]);
  });
  it("eerste vraag van een groep weg → intro schuift door", () => {
    const g = groep();
    const na = herstelGroepen(g.filter((q) => q.nummer !== 2), g);
    assert.equal(na.find((q) => q.nummer === 3)!.context, "Daan werkt bij Frituur De Vette Hap.");
    assert.ok(heeftGroepen(na));
  });
});

describe("RTTI-regels", () => {
  it("type-basis met bijstelling en uitleg", () => {
    assert.equal(rttiVolgensRegels({ type: "open", stam: "Noem de naam van deze kracht.", punten: 1, vraagtype: "K-SOORT" }).rtti, "R");
    assert.equal(rttiVolgensRegels({ type: "berekening", stam: "Bereken de snelheid. Gebruik de formule: snelheid = afstand : tijd.", punten: 2, vraagtype: "B-SNEL" }).rtti, "T1");
    assert.equal(rttiVolgensRegels({ type: "berekening", stam: "Bereken de energie in kWh die de lamp in een week gebruikt.", punten: 3, vraagtype: "E-EPT" }).rtti, "T2");
    assert.equal(rttiVolgensRegels({ type: "open", stam: "Leg uit of Sanne met een langere steel meer of minder kracht nodig heeft.", punten: 2, vraagtype: "K-HEF" }).rtti, "I");
    assert.equal(rttiVolgensRegels({ type: "open", stam: "Leg uit waarom het ijs smelt.", punten: 1, vraagtype: "W-FASE" }).rtti, "T2");
  });
  it("labelRtti zet label + reden en laat vakken zonder vraagtype met rust", () => {
    const [a, b] = labelRtti([v(1, { vraagtype: "K-SOORT", rtti: "T2", stam: "Noem de kracht." }), v(2, { rtti: "I" })]);
    assert.equal(a!.rtti, "R");
    assert.match(a!.rttiUitleg!, /type K-SOORT → R.*\(model: T2\)/);
    assert.equal(b!.rtti, "I");
    assert.equal(b!.rttiUitleg, undefined);
  });
  it("doelen per klas: onderbouw meer R/T1, klas 4 richting examen", () => {
    const o = RTTI_PRESETS[presetVoorLeerjaar(1)]!.verdeling;
    const k4 = RTTI_PRESETS[presetVoorLeerjaar(4)]!.verdeling;
    assert.ok(o.R + o.T1 > k4.R + k4.T1);
    assert.ok(k4.T2 > o.T2);
    assert.ok(RTTI_EXAMEN.GT.T2 > RTTI_EXAMEN.BB.T2);
  });
});

describe("examenvragen (klas 4)", () => {
  it("alleen klas 4", () => {
    assert.ok(magExamenvragen(4));
    for (const j of [1, 2, 3]) assert.ok(!magExamenvragen(j, true));
    assert.ok(wilGeenExamenvragen("Graag geen examenvragen"));
  });
  it("kiest passende contexten van dezelfde leerweg met bronlabel", () => {
    const c = kiesExamenContexten("geluid echo frequentie decibel oscilloscoop gehoor geluid", "GT", 2, () => 0);
    assert.equal(c.length, 2);
    for (const x of c) {
      assert.equal(x.leerweg, "GT");
      assert.ok(x.domeinen.includes("geluid"));
      assert.match(bronLabel(x), /^naar: examen 20\d\d tijdvak \d$/);
      assert.ok(x.vragen.every((q) => !q.figuur));
    }
    assert.equal(aantalExamenContexten("BB", 20), 1);
  });
  it("markeert vragen op contextTitel", () => {
    const c = CSE_CONTEXTEN.find((x) => x.leerweg === "KB")!;
    const out = markeerExamenvragen([v(1, { contextTitel: c.titel.toUpperCase() }), v(2)], [c]);
    assert.equal(out[0]!.bronvermelding, bronLabel(c));
    assert.equal(out[1]!.bronvermelding, undefined);
  });
});

describe("nakijken in de stijl van de docent + examenregel", () => {
  it("standaardrubriek zonder 'gegevens en gevraagde'", () => {
    assert.deepEqual(rekenRubriek(2).map((c) => c.criterium), ["gebruik van de juiste formule (grootheden benoemd)", "rest van de berekening juist (uitkomst met eenheid)"]);
    assert.equal(rekenRubriek(3).length, 3);
    assert.ok(isGegevensCriterium("gegevens en gevraagde noteren"));
    assert.ok(!isGegevensCriterium("gebruik van de formule"));
  });
  it("rubriek met een gegevens-punt: dat punt vervalt (3p → 2p formule + rest)", () => {
    const q = v(1, { type: "berekening", stam: "Bereken de druk.", punten: 3 });
    const n: NakijkItem = { nummer: 1, modelantwoord: "p = 20 N/cm²", puntenverdeling: [{ punt: 1, criterium: "gegevens en gevraagde" }, { punt: 1, criterium: "formule p = F : A" }, { punt: 1, criterium: "antwoord met eenheid" }], nietToekennen: [] };
    const out = repareerPunten([q], [n]);
    assert.equal(out.vragen[0]!.punten, 2);
    assert.ok(!out.nakijkmodel[0]!.puntenverdeling.some((c) => /gegevens/.test(c.criterium)));
    assert.ok(out.nakijkmodel[0]!.nietToekennen!.includes(DOORREKENEN));
    assert.match(DOORREKENEN, /samen hooguit 1 punt/);
    assert.match(DOORREKENEN, /significantie/);
  });
  it("lengte: gesloten ondergrens volgt de kalibratie", () => {
    const vr = Array.from({ length: 10 }, (_, i) =>
      v(i + 1, i < 3 ? { type: "meerkeuze", rtti: "T1", opties: [{ letter: "A", tekst: "a" }, { letter: "B", tekst: "b" }] } : { punten: 3 }),
    );
    // 3 van 10 gesloten: bij 50% geen omzetting van MC, bij 0,2 wel.
    const alleOpen = new Set(vr.filter((q) => !q.opties).map((q) => q.nummer));
    assert.equal(lengteIssues(vr, 40, alleOpen).length, 0);
    assert.ok(lengteIssues(vr, 40, alleOpen, 0.2).length >= 1);
  });
});

import { deelOpdracht, deelPlan, voegDelenSamen } from "./delen.ts";
describe("lange toetsen in twee delen", () => {
  it("plan: gesloten + open, samen het doel", () => {
    const k = kalibratie(3, "BB", 50);
    const plan = deelPlan(k, k.items, k.punten)!;
    assert.equal(plan.length, 2);
    assert.equal(plan[0]!.aantal + plan[1]!.aantal, k.items);
    assert.equal(plan[0]!.punten + plan[1]!.punten, k.punten);
    assert.equal(plan[1]!.startNr, plan[0]!.aantal + 1);
    assert.match(deelOpdracht(plan[0]!, plan[1]!), /juist\/onjuist/);
    assert.equal(deelPlan(kalibratie(4, "GT", 40), 15, 25), null);
  });
  it("samenvoegen nummert door", () => {
    const a = { vragen: [{ nummer: 1 }, { nummer: 2 }], nakijkmodel: [{ nummer: 1 }, { nummer: 2 }] };
    const b = { vragen: [{ nummer: 3 }, { nummer: 4 }], nakijkmodel: [{ nummer: 4 }, { nummer: 3 }], meta: "b" };
    const s = voegDelenSamen(a as typeof b, b);
    assert.deepEqual(s.vragen.map((q) => q.nummer), [1, 2, 3, 4]);
    assert.equal(s.meta, "b");
    assert.deepEqual(voegDelenSamen(null, b).vragen.length, 2);
  });
});

import { maatcilinderPastBijVraag } from "./types.ts";
import { plaatsMaatcilinders } from "./bron-figuren.ts";
describe("maatcilinder alleen bij volumevragen", () => {
  it("veer-vraag verliest een losse maatcilinder", () => {
    const q = v(1, { stam: "Hoeveel rekt de veer uit bij 9 N?", maatcilinder: { maxMl: 50, standen: [{ label: "A", ml: 2 }] } });
    assert.ok(!maatcilinderPastBijVraag(q));
    assert.equal(plaatsMaatcilinders([q])[0]!.maatcilinder, undefined);
    assert.ok(maatcilinderPastBijVraag(v(2, { stam: "Lees het volume af in mL." })));
  });
});

import { schoonIntro } from "./examenvragen.ts";
import { deelKalibratie, trimOverschot } from "./delen.ts";
describe("ronde 6: examencontext en overschot", () => {
  it("titel in context → contextTitel + intro zonder figuurverwijzing", () => {
    const c = CSE_CONTEXTEN.find((x) => x.leerweg === "GT" && x.domeinen.includes("geluid"))!;
    const out = markeerExamenvragen([v(1, { context: `Examenvragen ${c.titel}`, stam: "Bereken de tijd." }), v(2, { context: `Examenvragen ${c.titel}` })], [c]);
    assert.equal(out[0]!.contextTitel, c.titel);
    assert.doesNotMatch(out[0]!.context ?? "", /Examenvragen/);
    assert.ok((out[0]!.context ?? "").length > 20);
    assert.ok(!/afbeelding|uitwerkbijlage/i.test(out[0]!.context ?? ""));
    assert.equal(out[1]!.bronvermelding, bronLabel(c));
    assert.equal(schoonIntro("Anna fietst. Je ziet een afbeelding van de fiets. Ze remt."), "Anna fietst. Ze remt.");
  });
  it("deelkalibratie: gesloten 100% 1p, open zonder MC", () => {
    const k = kalibratie(2, "KB", 45);
    const plan = deelPlan(k, k.items, k.punten)!;
    const g = deelKalibratie(k, plan[0]!, k.items);
    const o = deelKalibratie(k, plan[1]!, k.items);
    assert.equal(g.items, plan[0]!.aantal);
    assert.equal(o.vorm.mc + o.vorm.jn, 0);
    assert.ok(o.pct1p < k.pct1p);
    assert.match(kalibratiePrompt(o), new RegExp(`Omvang: ${plan[1]!.aantal} vragen`));
  });
  it("trimOverschot haalt overtollige open vragen uit de drukste paragraaf", () => {
    const vr = Array.from({ length: 30 }, (_, i) => v(i + 1, { domein: i < 20 ? "6.1" : "6.2", punten: 2 }));
    const t = trimOverschot(vr, vr.map((q) => nk(q.nummer)), 20, 30, 0);
    assert.ok(t.vragen.length <= 22);
    assert.equal(t.nakijkmodel.length, t.vragen.length);
    assert.ok(t.vragen.some((q) => q.domein === "6.2"));
  });
});
