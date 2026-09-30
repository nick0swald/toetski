/**
 * Regressietests uit de review van een echte toets (NaSk KB2, H6 Geluid): elk probleem generiek afgevangen.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { APP_NAME } from "./constants.ts";
import { bevatSchoolnaam, borgFiguurVerwijzingen, onopgeloste, verwijderSchoolnamen } from "./context-regels.ts";
import { repareerItemsDeterministisch, detecteerItemIssues } from "./item-kwaliteit.ts";
import { finalizeVragen } from "./mc-balance.ts";
import { asOndergrens } from "./figuren/svg.ts";
import { toetsLengte } from "./lengte.ts";
import { extractParagrafen, paragraafDekking } from "./leerdoelen.ts";
import { rttiHerschrijfPlan, rttiPercentages } from "./rtti-balans.ts";
import { controleIssues, parseControle } from "./inhoud-controle.ts";
import { werkVragenAf } from "./afwerken.ts";
import { rekenAftrek, repareerPunten } from "./punten-rubric.ts";
import { bouwKwaliteit } from "./kwaliteit-check.ts";
import { beoordeelKeuring, KEURING_CHECKS } from "./figuren/keuring.ts";
import { plaatsPictogrammen } from "./bron-figuren.ts";
import { legacySpecs } from "./figuren/spec.ts";
import { bouwSystemPrompt, stuurdocumentTekst } from "./stuurdocument.ts";
import type { NakijkItem, Vraag } from "./types.ts";

const mc = (nummer: number, stam: string, opties: string[], extra: Partial<Vraag> = {}): Vraag => ({
  nummer,
  type: "meerkeuze",
  rtti: "R",
  domein: "6.1 Geluid",
  leerdoel: "",
  punten: 1,
  stam,
  opties: opties.map((tekst, i) => ({ letter: "ABCD"[i]!, tekst })),
  ...extra,
});
const open = (nummer: number, stam: string, extra: Partial<Vraag> = {}): Vraag => ({ nummer, type: "open", rtti: "T1", domein: "6.3", leerdoel: "", punten: 2, stam, ...extra });
const nk = (nummer: number, modelantwoord: string, punten = 1): NakijkItem => ({ nummer, modelantwoord, puntenverdeling: [{ punt: punten, criterium: "juist" }] });

describe("7. schoolnaam nooit in vragen", () => {
  it("branding heet Toetski; de systeemprompt noemt geen school", () => {
    assert.equal(APP_NAME, "Toetski");
    assert.doesNotMatch(APP_NAME, /Aeres|Ares058/);
    assert.doesNotMatch(bouwSystemPrompt(), /voor (Aeres|Ares058)|leerbedrijf Ares058|kas van Aeres/);
    assert.doesNotMatch(stuurdocumentTekst(), /leerbedrijf Ares058/);
    assert.match(stuurdocumentTekst(), /NOOIT de naam van de school/);
  });
  it("herkent en vervangt schoolnamen en school-leerbedrijven", () => {
    for (const t of ["Op het erf van Ares058 wordt getest.", "In de stal van Aeres VMBO staat een koe.", "Op het leerbedrijf hoort Daan een trekker.", "Een leerling van het Stedelijk College meet."]) {
      assert.ok(bevatSchoolnaam(t), t);
      const r = verwijderSchoolnamen(t);
      assert.ok(!bevatSchoolnaam(r), `${t} → ${r}`);
    }
    assert.equal(verwijderSchoolnamen("Op het erf van Ares058 wordt een apparaat getest."), "Op het erf van Boerderij De Vrolijke Koe wordt een apparaat getest.");
    assert.ok(!bevatSchoolnaam("Sanne werkt bij Frituur De Vette Hap."));
  });
  it("deterministische reparatie zit in de itemcontrole", () => {
    const v = [mc(1, "Een leerling staat bij een grote kas op Ares058. Wat is de bron?", ["a", "b", "c", "d"])];
    const r = repareerItemsDeterministisch(v, [nk(1, "A. a")], "");
    assert.ok(!bevatSchoolnaam(r.vragen[0]!.stam), r.vragen[0]!.stam);
    assert.ok(!r.issues.some((i) => i.code === "schoolnaam"));
  });
});

describe("6. juist/onjuist altijd A. Juist, B. Onjuist", () => {
  it("draait de volgorde terug en husselt niet", () => {
    for (let k = 0; k < 10; k++) {
      const v = [{ ...mc(1, "Frequentie is het aantal trillingen per minuut.", ["Onjuist", "Juist"]), type: "juist-onjuist" as const }];
      const r = finalizeVragen(v, [nk(1, "A. Onjuist")]);
      assert.deepEqual(r.vragen[0]!.opties!.map((o) => `${o.letter}. ${o.tekst}`), ["A. Juist", "B. Onjuist"]);
      assert.match(r.nakijkmodel[0]!.modelantwoord, /^B\. Onjuist/);
    }
  });
});

describe("8. vage verwijzingen", () => {
  it("'de installatie' zonder introductie wordt gemeld; een geïntroduceerd apparaat niet", () => {
    assert.deepEqual(onopgeloste("Welke stof is hier de tussenstof voor het geluid van de installatie?"), ["de installatie"]);
    assert.deepEqual(onopgeloste("Wat is de frequentie?", "In de stal staat een nieuwe voerautomaat. Het apparaat piept."), []);
    const issues = detecteerItemIssues([mc(1, "Welke stof is hier de tussenstof voor het geluid van de installatie?", ["a", "b", "c", "d"])], [nk(1, "A. a")], "");
    assert.ok(issues.some((i) => i.code === "vage-verwijzing"));
  });
});

describe("3. geen verwijzing naar een ontbrekende figuur", () => {
  it("haalt een losse verwijszin weg en verwijdert een vraag die zonder beeld niet kan", () => {
    const vragen = [
      mc(1, "Wat is de ontvanger?", ["oor", "lucht", "bron", "trommel"]),
      open(2, "Kijk naar de grafiek hieronder. Een machine maakt 95 dB. Hoe lang mag je er zonder gehoorbescherming werken?"),
      open(3, "Wat betekent dit pictogram in de context van de houtversnipperaar?", { context: "Bij de houtversnipperaar hangt een waarschuwingsbord." }),
      open(4, "Noem een maatregel bij de ontvanger."),
    ];
    const nakijk = [nk(1, "A. oor"), nk(2, "15 min", 2), nk(3, "Gehoorbescherming dragen", 1), nk(4, "oordoppen", 2)];
    const r = borgFiguurVerwijzingen(vragen, nakijk);
    assert.equal(r.vragen.length, 3);
    assert.deepEqual(r.verwijderd, [3]);
    assert.doesNotMatch(r.vragen[1]!.stam, /grafiek|hieronder/i);
    assert.match(r.vragen[1]!.stam, /95 dB/);
    assert.deepEqual(r.vragen.map((q) => q.nummer), [1, 2, 3]);
    assert.deepEqual(r.nakijkmodel.map((n) => n.modelantwoord), ["A. oor", "15 min", "oordoppen"]);
  });
  it("laat een vraag met een echte figuur of tabel ongemoeid", () => {
    const q = open(1, "Kijk naar de tabel. Welke stof heeft de grootste dichtheid?", { tabel: { koppen: ["stof", "ρ"], rijen: [["ijzer", "7,87"]] } });
    const r = borgFiguurVerwijzingen([q], [nk(1, "ijzer")]);
    assert.equal(r.meldingen.length, 0);
  });
  it("gehoorbescherming wordt een getekend gebodsbord, rubriek noemt geen GHS", () => {
    const q = open(1, "Bij de houtversnipperaar hangt een veiligheidsbord. Wat betekent dit pictogram?");
    const n = { nummer: 1, modelantwoord: "Gehoorbescherming dragen", puntenverdeling: [{ punt: 1, criterium: "Correcte interpretatie van het gezondheidsgevaar-pictogram" }] };
    const [uit] = plaatsPictogrammen([q], [n]);
    assert.equal(uit!.pictogram, "gebod-gehoorbescherming");
    assert.doesNotMatch(n.puntenverdeling[0]!.criterium, /gezondheidsgevaar/);
    const spec = legacySpecs(uit!)[0]!;
    assert.ok(!spec.verplichteElementen.includes("rode ruit"));
    assert.match(spec.verplichteElementen[0]!, /blauwe cirkel/);
  });
});

describe("4. sfeerplaat mag de vraag niet tegenspreken", () => {
  it("go vereist expliciet geen_tegenspraak_met_vraag", () => {
    const checks = Object.fromEntries(KEURING_CHECKS.map((k) => [k, true]));
    assert.equal(beoordeelKeuring({ besluit: "go", checks }).besluit, "go");
    assert.equal(beoordeelKeuring({ besluit: "go", checks: { ...checks, geen_tegenspraak_met_vraag: false } }).besluit, "no_go");
  });
});

describe("5. grafiekassen schalen mee met de data", () => {
  it("80–95 dB begint niet bij 0; 0,25–8 uur wel", () => {
    assert.ok(asOndergrens([80, 83, 86, 89, 92, 95]) >= 70);
    assert.equal(asOndergrens([0.25, 0.5, 1, 2, 4, 8]), 0);
    assert.ok(asOndergrens([80, 95], 0) >= 70, "expliciete 0 die de data platdrukt wordt genegeerd");
    assert.equal(asOndergrens([10, 50], 0), 0);
  });
});

describe("10. lengte past bij de toetsduur", () => {
  it("45 min KB ≈ 26 punten en 14 vragen (1 punt per 1,75 min)", () => {
    assert.deepEqual(toetsLengte(45, "KB"), { punten: 26, vragen: 14 });
    assert.ok(toetsLengte(45, "BB").punten < toetsLengte(45, "GT").punten);
  });
});

describe("11. dekking per paragraaf", () => {
  const antwoorden = "Antwoorden H6\n6.1 Geluid maken\n1 a trilling\n6.2 Hoog en laag\n6.3 Hard en zacht\n6.4 Geluidssnelheid\n6.5 Geluidshinder\nWeeg 1.5 kg af";
  it("haalt paragrafen uit de koppen van het antwoordenboek", () => {
    assert.deepEqual(extractParagrafen("", antwoorden).map((p) => p.code), ["6.1", "6.2", "6.3", "6.4", "6.5"]);
  });
  it("telt vragen per paragraaf op domein", () => {
    const d = paragraafDekking([mc(1, "x", ["a", "b"], { domein: "6.1 Geluid maken" }), mc(2, "y", ["a", "b"], { domein: "6.4 Geluidssnelheid" })], extractParagrafen(antwoorden));
    assert.deepEqual(d.map((x) => x.vragen.length), [1, 0, 0, 1, 0]);
  });
});

describe("12. RTTI naar het doel", () => {
  it("plant herschrijvingen van overschot naar tekort (H6: te veel T2)", () => {
    const v: Vraag[] = [
      mc(1, "a", ["a", "b"], { rtti: "R" }), mc(2, "b", ["a", "b"], { rtti: "R" }), mc(3, "c", ["a", "b"], { rtti: "T1" }), mc(4, "d", ["a", "b"], { rtti: "R" }),
      mc(5, "e", ["a", "b"], { rtti: "T1" }), mc(6, "f", ["a", "b"], { rtti: "I" }),
      open(7, "g", { rtti: "T2", punten: 3 }), open(8, "h", { rtti: "R", punten: 1 }), open(9, "i", { rtti: "T2", punten: 3 }), open(10, "j", { rtti: "T1", punten: 3 }),
    ];
    const doel = { R: 35, T1: 40, T2: 20, I: 5 };
    const plan = rttiHerschrijfPlan(v, doel);
    assert.ok(plan.length >= 1);
    assert.ok(plan.every((i) => [7, 9].includes(i.nummer)), JSON.stringify(plan));
    const na = v.map((q) => (plan.some((p) => p.nummer === q.nummer) ? { ...q, rtti: plan.find((p) => p.nummer === q.nummer)!.uitleg.match(/naar (R|T1|T2|I)/)![1] as Vraag["rtti"] } : q));
    const p = rttiPercentages(na);
    assert.ok(Math.abs(p.T2 - 20) <= 10 && Math.abs(p.T1 - 40) <= 10, JSON.stringify(p));
  });
});

describe("1/2/9. onafhankelijke inhoudscontrole", () => {
  const v6 = mc(6, "Welke frequentie ligt binnen het bereik van een mens maar buiten dat van een hond?", ["15 Hz", "45 000 Hz", "800 Hz", "18 000 Hz"]);
  it("geen juiste optie, verkeerde sleutel, ontbrekend gegeven en realisme worden issues", () => {
    const o = parseControle(JSON.stringify({ oordelen: [
      { nummer: 6, eigenAntwoord: "geen", juisteOpties: [], oplosbaar: true, realistisch: true, helder: true, rubriekOk: true },
      { nummer: 1, eigenAntwoord: "C", juisteOpties: ["C"], oplosbaar: true, realistisch: true, helder: true, rubriekOk: true },
      { nummer: 7, eigenAntwoord: "?", oplosbaar: false, ontbreekt: "geluidssterkte van de machine", realistisch: true, helder: true, rubriekOk: true },
      { nummer: 9, eigenAntwoord: "206 m", oplosbaar: true, realistisch: false, realisme: "kaswand op 206 m", helder: true, rubriekOk: true },
    ] }));
    const vragen = [v6, mc(1, "Welke optie?", ["a", "b", "c", "d"]), open(7, "Hoe lang mag je werken?"), open(9, "Hoe ver is de kaswand?")];
    const codes = controleIssues(vragen, [nk(6, "D. 18 000 Hz"), nk(1, "B. b")], o).map((i) => `${i.nummer}:${i.code}`);
    assert.deepEqual(codes.sort(), ["1:sleutel-fout", "6:geen-juiste-optie", "7:gegeven-ontbreekt", "9:realisme"]);
  });
  it("werkVragenAf: controle → reparatie → hercontrole, en logt het resultaat", async () => {
    let controles = 0;
    const controleer = async (prompt: string) => {
      controles++;
      const gerepareerd = prompt.includes("20 Hz");
      return JSON.stringify({ oordelen: [{ nummer: 6, eigenAntwoord: gerepareerd ? "A" : "geen", juisteOpties: gerepareerd ? ["A"] : [], oplosbaar: true, realistisch: true, helder: true, rubriekOk: true, rtti: "T1" }] });
    };
    const repair = async (prompt: string) => {
      assert.match(prompt, /geen-juiste-optie/);
      return JSON.stringify({
        vragen: [{ ...v6, stam: "Een mens hoort van 20 Hz tot 20 000 Hz, een hond van 15 Hz tot 50 000 Hz. Welke frequentie hoort een hond wel, maar een mens niet?", opties: [{ letter: "A", tekst: "30 000 Hz" }, { letter: "B", tekst: "800 Hz" }, { letter: "C", tekst: "5 000 Hz" }, { letter: "D", tekst: "18 000 Hz" }] }],
        nakijkmodel: [nk(6, "A. 30 000 Hz")],
        toelichting: "",
      });
    };
    const r = await werkVragenAf({ vragen: [v6], nakijkmodel: [nk(6, "D. 18 000 Hz")], bron: "", vak: "NaSk", controleer, repair });
    assert.equal(controles, 2);
    assert.ok(r.controle);
    assert.equal(r.controle!.gecontroleerd, 1);
    assert.deepEqual(r.controle!.gevonden.map((g) => g.code), ["geen-juiste-optie"]);
    assert.deepEqual(r.controle!.blijft, []);
    assert.match(r.vragen[0]!.stam, /20 Hz/);
    const k = bouwKwaliteit({ vragen: r.vragen, nakijkmodel: r.nakijkmodel, bron: "", vak: "NaSk", rttiDoel: { R: 25, T1: 25, T2: 25, I: 25 }, controle: r.controle });
    const ic = k.punten.find((p) => p.criterium === "Inhoudscontrole")!;
    assert.equal(ic.oordeel, "voldoet");
    assert.match(ic.toelichting, /geen juiste optie/);
    assert.ok(k.punten.find((p) => p.criterium === "Realisme"));
  });
  it("zonder controleoordeel: eerlijk 'let op' in de feedback", async () => {
    const r = await werkVragenAf({ vragen: [v6], nakijkmodel: [nk(6, "D. 18 000 Hz")], bron: "", vak: "NaSk", controleer: async () => null, repair: async () => null });
    assert.equal(r.controle!.gecontroleerd, 0);
    const k = bouwKwaliteit({ vragen: r.vragen, nakijkmodel: r.nakijkmodel, bron: "", vak: "NaSk", rttiDoel: { R: 25, T1: 25, T2: 25, I: 25 }, controle: r.controle });
    assert.equal(k.punten.find((p) => p.criterium === "Inhoudscontrole")!.oordeel, "let op");
  });
});

describe("13/14. feedback en rubriek", () => {
  it("geen 'figuuren' en geen modelopmerking", () => {
    const q = { ...open(1, "x"), figuur: undefined };
    const k = bouwKwaliteit({ vragen: [q], nakijkmodel: [nk(1, "y", 2)], bron: "", vak: "NaSk", rttiDoel: { R: 25, T1: 25, T2: 25, I: 25 }, llm: { samenvatting: "Vragen zijn origineel en volgen Cito-stijl en zijn heel erg eenduidig geformuleerd.", punten: [] } });
    assert.doesNotMatch(JSON.stringify(k), /figuuren|Opmerking|Cito-stijl/);
  });
  it("rekenvraag: deelpunten, fout kost 1 punt, doorrekenen telt", () => {
    const q: Vraag = { ...open(9, "Bereken hoe ver de wand is."), type: "berekening", punten: 3 };
    const n: NakijkItem = { nummer: 9, modelantwoord: "s = 343 × 0,6 = 206 m", puntenverdeling: [{ punt: 1, criterium: "t = 1,2 / 2 = 0,6 s" }, { punt: 1, criterium: "s = v × t" }, { punt: 1, criterium: "206 m" }], nietToekennen: ["Geen deling door 2"] };
    const r = repareerPunten([q], [n]);
    assert.deepEqual(r.nakijkmodel[0]!.puntenverdeling.map((p) => p.criterium), ["t = 1,2 / 2 = 0,6 s", "s = v × t", "206 m"]);
    assert.match(r.nakijkmodel[0]!.nietToekennen![0]!, /Geen deling door 2: 1 punt aftrek/);
    // Examenregel staat één keer bovenaan het nakijkmodel, niet onder elke vraag.
    assert.ok(!r.nakijkmodel[0]!.nietToekennen!.some((x) => /^examenregel/i.test(x)));
    assert.equal(rekenAftrek(rekenAftrek(["x"])).length, 1, "idempotent");
  });
});
