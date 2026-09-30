/**
 * Regressietests uit verbeterronde 1 (gegenereerde toetsen op Production, streng nagekeken).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detecteerItemIssues, isStubContext, isVraagzinStelling, repareerItemsDeterministisch, tekortPunten, vaagObjectBegin } from "./item-kwaliteit.ts";
import { lengteIssues, werkVragenAf } from "./afwerken.ts";
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
  it("afwerkbudget past binnen 100 s", () => {
    assert.equal(afwerkBudget(undefined), 60_000);
    assert.equal(afwerkBudget(20_000), 60_000);
    assert.equal(afwerkBudget(45_000), 43_000);
    assert.equal(afwerkBudget(80_000), 25_000);
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
  it("eerste figuurronde krijgt minstens 40 s na trage vragen, binnen 84 s", () => {
    assert.equal(eersteRondeEinde(0, 20_000), 72_000);
    assert.equal(eersteRondeEinde(0, 40_000), 80_000);
    assert.equal(eersteRondeEinde(0, 60_000), 84_000);
  });
  it("GHS-keuze van het model wijkt voor een bord als de tekst over gehoorbescherming gaat", () => {
    const q = v(5, "Welk veiligheidsbord hangt bij de machine waar je gehoorbescherming moet dragen?", { pictogram: "gezondheidsgevaar" as Vraag["pictogram"] });
    const [uit] = plaatsPictogrammen([q], [{ nummer: 5, modelantwoord: "Gehoorbescherming verplicht", puntenverdeling: [] }]);
    assert.equal(uit!.pictogram, "gebod-gehoorbescherming");
  });
});
