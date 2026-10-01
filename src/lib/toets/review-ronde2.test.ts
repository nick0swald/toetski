/**
 * Regressietests uit verbeterronde 1 (gegenereerde toetsen op Production, streng nagekeken).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detecteerItemIssues, isStubContext, isVraagzinStelling, repareerItemsDeterministisch, tekortPunten, vaagObjectBegin } from "./item-kwaliteit.ts";
import { lengteIssues, werkVragenAf } from "./afwerken.ts";
import { controleIssues, parseControle } from "./inhoud-controle.ts";
import { vraagZonderFiguur, wijstOpTegenspraak } from "./figuren/fallback.ts";
import { isSymboolnaam, voorcheckNietTonen } from "./figuren/keuring.ts";
import { plaatsPictogrammen } from "./bron-figuren.ts";
import { eersteRondeEinde } from "./voortgang.ts";
import { afwerkBudget } from "./voortgang.ts";
import type { NakijkItem, Vraag } from "./types.ts";
import type { FiguurSpec } from "./types.ts";

const v = (nummer: number, stam: string, extra: Partial<Vraag> = {}): Vraag => ({
  nummer,
  type: "open",
  rtti: "T1",
  domein: "2.1 Stoffen",
  leerdoel: "",
  punten: 1,
  stam,
  ...extra,
});

describe("ronde 1: deterministische vraagcontroles", () => {
  it("stub-context ('pictogram') wordt weggehaald", () => {
    assert.equal(isStubContext("pictogram"), true);
    assert.equal(isStubContext("Sanne werkt bij Frituur De Vette Hap."), false);
    const r = repareerItemsDeterministisch([v(1, "Welk bord hoort bij lawaai?", { context: "pictogram" })], [], "");
    assert.equal(r.vragen[0]!.context, undefined);
  });
  it("juist/onjuist met een vraagzin → onhelder", () => {
    const q = v(2, "Is het veilig om een onbekende stof te ruiken?", { type: "juist-onjuist", opties: [{ letter: "A", tekst: "Juist" }, { letter: "B", tekst: "Onjuist" }] });
    assert.equal(isVraagzinStelling(q), true);
    assert.equal(isVraagzinStelling({ ...q, stam: "Stelling: je mag een onbekende stof ruiken door eraan te snuiven." }), false);
    assert.ok(detecteerItemIssues([q], [], "").some((i) => i.code === "onhelder"));
  });
  it("'noem twee … en leg uit' voor 1 punt → rubriek", () => {
    assert.ok(tekortPunten(v(3, "Noem twee scheidingsmethoden en leg uit welke het beste werkt.")));
    assert.equal(tekortPunten(v(3, "Noem twee scheidingsmethoden.", { punten: 2 })), null);
    assert.equal(tekortPunten(v(3, "Leg uit waarom zout oplost.")), null);
  });
  it("'Het flesje …' zonder context → vage verwijzing", () => {
    assert.equal(vaagObjectBegin(v(4, "Het flesje valt om. Wat moet je doen?")), "Het flesje");
    assert.equal(vaagObjectBegin(v(4, "Het flesje valt om.", { context: "Lotte zet een flesje ammonia op tafel." })), null);
    assert.equal(vaagObjectBegin(v(4, "De dichtheid van ijzer is 7,9 g/cm³.")), null);
  });
});

describe("ronde 1: lengte en afwerken", () => {
  it("te kort → 1-punts gesloten vragen worden open meerpuntsvragen", () => {
    const vragen = Array.from({ length: 10 }, (_, i) => v(i + 1, `Vraag ${i + 1}`, { type: "meerkeuze", opties: [{ letter: "A", tekst: "a" }, { letter: "B", tekst: "b" }] }));
    const iss = lengteIssues(vragen, 20, new Set([1]));
    assert.ok(iss.length >= 3);
    assert.ok(iss.every((i) => i.code === "lengte" && i.nummer !== 1));
    assert.equal(lengteIssues(vragen, 11, new Set()).length, 0);
  });
  it("vervangen vraag wordt opnieuw gecontroleerd; oude bevindingen vervallen", async () => {
    const vragen = [v(1, "Bereken de kracht als de massa 5 kg is.", { type: "berekening", punten: 3 })];
    const nakijk: NakijkItem[] = [{ nummer: 1, modelantwoord: "F = 49 N", puntenverdeling: [{ criterium: "formule", punt: 1 }, { criterium: "invullen", punt: 1 }, { criterium: "antwoord", punt: 1 }] }];
    let controles = 0;
    const res = await werkVragenAf({
      vragen,
      nakijkmodel: nakijk,
      bron: "",
      vak: "NaSk",
      budgetMs: 60_000,
      controleer: async () => {
        controles++;
        const goed = controles >= 3;
        return JSON.stringify({ oordelen: [{ nummer: 1, eigenAntwoord: "49 N", juisteOpties: [], oplosbaar: goed, ontbreekt: goed ? "" : "g", realistisch: true, realisme: "", helder: true, helderheid: "", rubriekOk: true, rubriek: "", rtti: "T1" }] });
      },
      repair: async () => JSON.stringify({ vragen: [{ ...vragen[0], stam: `Bereken de zwaartekracht op een tas van 5 kg (g = 9,8 N/kg). ${controles}` }], nakijkmodel: nakijk }),
    });
    assert.equal(controles, 3);
    assert.deepEqual(res.controle?.blijft, []);
    assert.deepEqual(res.controle?.vervangen, [1]);
  });
  it("afwerkbudget is vast (eigen Vercel-aanroep), ook na trage vragen", () => {
    assert.equal(afwerkBudget(undefined), 140_000);
    assert.equal(afwerkBudget(20_000), 140_000);
    assert.equal(afwerkBudget(80_000), 140_000);
  });
});

describe("ronde 1: figuren", () => {
  it("symboolnamen in nietTonen blokkeren een figuur niet", () => {
    assert.equal(isSymboolnaam("F2"), true);
    assert.equal(isSymboolnaam("Fres"), true);
    assert.equal(isSymboolnaam("12 N"), false);
    const spec = { nietTonen: ["F2", "12 N"] } as unknown as FiguurSpec;
    assert.deepEqual(voorcheckNietTonen(spec, ["F1 = 8 N", "F2"]), []);
    assert.equal(voorcheckNietTonen(spec, ["F2 = 12 N"]).length, 1);
  });
  it("eerste figuurronde krijgt minstens 40 s na trage vragen, binnen het maximum − 16 s", () => {
    assert.equal(eersteRondeEinde(0, 20_000), 180_000);
    assert.equal(eersteRondeEinde(0, 150_000), 190_000);
    assert.equal(eersteRondeEinde(0, 300_000), 314_000);
  });
  it("GHS-keuze van het model wijkt voor een bord als de tekst over gehoorbescherming gaat", () => {
    const q = v(5, "Welk veiligheidsbord hangt bij de machine waar je gehoorbescherming moet dragen?", { pictogram: "gezondheidsgevaar" as Vraag["pictogram"] });
    const [uit] = plaatsPictogrammen([q], [{ nummer: 5, modelantwoord: "Gehoorbescherming verplicht", puntenverdeling: [] }]);
    assert.equal(uit!.pictogram, "gebod-gehoorbescherming");
  });
});

describe("ronde 2: strengere afwerking", () => {
  const oordeel = (nummer: number, extra: Record<string, unknown> = {}) => ({ nummer, eigenAntwoord: "", juisteOpties: [], oplosbaar: true, ontbreekt: "", realistisch: true, realisme: "", helder: true, helderheid: "", rubriekOk: true, rubriek: "", rtti: "T1", ...extra });
  it("open vraag met fout modelantwoord → sleutel-fout", () => {
    const o = parseControle(JSON.stringify({ oordelen: [oordeel(1, { eigenAntwoord: "2,4 m", modelantwoordKlopt: false })] }));
    const iss = controleIssues([v(1, "Bereken r.", { type: "berekening", punten: 4 })], [{ nummer: 1, modelantwoord: "1,35 m", puntenverdeling: [] }], o);
    assert.ok(iss.some((i) => i.code === "sleutel-fout" && /2,4 m/.test(i.uitleg)));
  });
  it("vraag die na reparatie en vervanging onbruikbaar blijft, gaat eraf en er wordt doorgenummerd", async () => {
    const vragen = Array.from({ length: 10 }, (_, i) => v(i + 1, `Leg uit waarom stof ${i + 1} oplost in water.`));
    const nakijk: NakijkItem[] = vragen.map((q) => ({ nummer: q.nummer, modelantwoord: "x", puntenverdeling: [{ criterium: "uitleg", punt: 1 }] }));
    const res = await werkVragenAf({
      vragen,
      nakijkmodel: nakijk,
      bron: "",
      vak: "NaSk",
      skipOrder: true,
      budgetMs: 60_000,
      controleer: async (p) => {
        const nrs = [...p.matchAll(/"nummer":(\d+)/g)].map((m) => Number(m[1]));
        return JSON.stringify({ oordelen: [...new Set(nrs)].map((nr) => oordeel(nr, nr === 4 ? { oplosbaar: false, ontbreekt: "massa" } : {})) });
      },
      repair: async () => null,
    });
    assert.equal(res.vragen.length, 9);
    assert.deepEqual(res.vragen.map((q) => q.nummer), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.ok(!res.vragen.some((q) => /stof 4 /.test(q.stam)));
    assert.deepEqual(res.controle?.verwijderd, [4]);
    assert.deepEqual(res.controle?.blijft, []);
  });
  it("zonder plaatjes: pictogram weg vóór de controle", async () => {
    let gezien = "";
    await werkVragenAf({
      vragen: [v(1, "Noem twee veiligheidsmaatregelen.", { punten: 2, pictogram: "gebod-gehoorbescherming" as Vraag["pictogram"] })],
      nakijkmodel: [{ nummer: 1, modelantwoord: "bril, haar vast", puntenverdeling: [{ criterium: "a", punt: 1 }, { criterium: "b", punt: 1 }] }],
      bron: "",
      vak: "NaSk",
      figuren: "geen",
      controleer: async (p) => {
        gezien = p;
        return JSON.stringify({ oordelen: [oordeel(1)] });
      },
      repair: async () => null,
    });
    assert.doesNotMatch(gezien, /gehoorbescherming/);
  });
  it("context niet herhalen in de stam; 'maakt geen fouten' is geen criterium", () => {
    const q = v(6, "Bij Frituur De Vette Hap staat een afzuiger van 89 dB. Hoe lang mag Daan er werken?", { context: "Bij Frituur De Vette Hap staat een afzuiger van 89 dB." });
    const r = repareerItemsDeterministisch([q], [{ nummer: 6, modelantwoord: "1 uur", puntenverdeling: [{ criterium: "gebruikt geen kenmerken van een ander mengsel", punt: 1 }] }], "");
    assert.equal(r.vragen[0]!.stam, "Hoe lang mag Daan er werken?");
    assert.ok(r.issues.some((i) => i.code === "rubriek"));
  });
  it("'noem drie' mag 2 punten (staffel), 'noem drie en leg uit' niet", () => {
    assert.equal(tekortPunten(v(1, "Noem drie soorten krachten.", { punten: 2 })), null);
    assert.ok(tekortPunten(v(1, "Noem drie stofeigenschappen. Leg uit waarom je niet mag proeven.", { punten: 2 })));
  });
  it("te kort: eerst open vragen uitbreiden, MC-aandeel blijft ≥ 50%", () => {
    const mcV = (n: number) => v(n, `MC ${n}`, { type: "meerkeuze", opties: [{ letter: "A", tekst: "a" }, { letter: "B", tekst: "b" }] });
    const vragen = [mcV(1), mcV(2), mcV(3), mcV(4), mcV(5), mcV(6), v(7, "Leg uit."), v(8, "Leg uit.", { punten: 2 }), v(9, "Bereken.", { punten: 3 }), v(10, "Leg uit.")];
    const iss = lengteIssues(vragen, 20, new Set());
    const nrs = iss.map((i) => i.nummer);
    assert.ok(nrs.includes(7) && nrs.includes(8) && nrs.includes(10));
    assert.ok(!nrs.includes(9));
    assert.ok(nrs.filter((nr) => nr <= 6).length <= 1);
  });
  it("figuur die de vraag tegenspreekt, wordt geen tabel", () => {
    assert.equal(wijstOpTegenspraak(["Grafiek toont T = 0,004 s wat f = 250 Hz impliceert; directe tegenspraak"]), true);
    const spec = { soort: "lijngrafiek", data: { xLabel: "t", yLabel: "u", reeksen: [{ naam: "a", punten: [{ x: 0, y: 0 }, { x: 1, y: 2 }] }] }, nietTonen: [] } as unknown as FiguurSpec;
    const q = v(11, "Bereken de trillingstijd bij 220 Hz.");
    assert.notEqual(vraagZonderFiguur(q, spec, { legacy: true, verwijst: true, tegenspraak: true }).fallback, "tabel");
  });
});

describe("ronde 3: context en pictogram", () => {
  it("context met gegevens wordt nooit als 'context-loos' weggegooid", () => {
    const q = v(13, "Bereken hoe ver de dichtstbijzijnde wand van Bram af staat.", { type: "berekening", punten: 3, context: "Bram roept in een sporthal en hoort na 0,2 s de echo." });
    const r = repareerItemsDeterministisch([q], [], "");
    assert.equal(r.vragen[0]!.context, q.context);
    const q2 = v(5, "Wat is de resulterende kracht op de slee?", { context: "Lotte trekt een slee met 120 N; de wrijving is 40 N." });
    assert.ok(repareerItemsDeterministisch([q2], [], "").vragen[0]!.context);
  });
  it("pictogram bij een drukberekening valt weg", () => {
    const q = v(11, "Bereken de druk onder de pan.", { type: "berekening", context: "Een pan van 240 N staat op 0,06 m².", pictogram: "ontvlambaar" as Vraag["pictogram"] });
    const [uit] = plaatsPictogrammen([q], []);
    assert.equal(uit!.pictogram, undefined);
  });
});

describe("ronde 4: taal en punten", () => {
  it("'hij' wordt de naam van de hoofdpersoon, niet 'de leerling'", () => {
    const q = v(7, "Boven welke geluidssterkte loopt Daan risico als hij lang blijft staan?", { context: "Daan gaat naar een concert." });
    const r = repareerItemsDeterministisch([q], [], "");
    assert.doesNotMatch(r.vragen[0]!.stam, /de leerling/);
    const zonder = repareerItemsDeterministisch([v(8, "Wat doet je buurman als hij de fles opent?")], [], "");
    assert.match(zonder.vragen[0]!.stam, /de leerling/);
  });
  it("'Hoe lang …? Leg uit' voor 1 punt → te weinig punten", () => {
    assert.ok(tekortPunten(v(12, "Hoe lang mag een bezoeker hier blijven? Leg uit hoe je dit weet.")));
  });
});

describe("ronde 4: figuur valt weg zonder kapotte zinnen", () => {
  it("maatcilinder: oorspronkelijke tekst met standen komt terug", async () => {
    const { plaatsMaatcilinders } = await import("./bron-figuren.ts");
    const q = v(10, "Bram dompelt een steen onder. De beginstand is 30 mL. Na het onderdompelen staat het water op 52 mL. Bereken het volume van de steen.", { punten: 3 });
    const [m] = plaatsMaatcilinders([q]);
    assert.ok(m!.maatcilinder && m!.tekstZonderFiguur);
    const spec = { soort: "maatcilinder", data: { maxMl: 100, standen: [{ label: "begin", ml: 30 }, { label: "na", ml: 52 }] }, nietTonen: [] } as unknown as FiguurSpec;
    const fb = vraagZonderFiguur(m!, spec, { legacy: true, verwijst: true });
    assert.match(fb.vraag.stam, /30 mL/);
    assert.match(fb.vraag.stam, /52 mL/);
    assert.equal(fb.vraag.tekstZonderFiguur, undefined);
  });
  it("pictogram: beschrijving van wat je ziet, zonder de betekenis", () => {
    const q = v(5, "Wat betekent dit gevarensymbool?", { type: "open" });
    const spec = { soort: "pictogram", data: { symbool: "giftig" }, nietTonen: [] } as unknown as FiguurSpec;
    const fb = vraagZonderFiguur(q, spec, { legacy: true, verwijst: true });
    assert.match(fb.vraag.stam, /doodshoofd/);
    assert.doesNotMatch(fb.vraag.stam, /giftig/);
  });
  it("tekenopdracht zonder tekening → op je antwoordblad", () => {
    const spec = { soort: "krachtenschema", data: { krachten: [{ naam: "Fz", richting: "omlaag", grootte: 120 }] }, nietTonen: [] } as unknown as FiguurSpec;
    const fb = vraagZonderFiguur(v(16, "Teken in de figuur de zwaartekracht."), spec, { legacy: true, verwijst: true });
    assert.match(fb.vraag.stam, /antwoordblad/);
  });
});
