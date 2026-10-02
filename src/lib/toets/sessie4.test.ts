/**
 * Plan-first sessie 4 (vangnet): tekenvak, rekencontrole, minder herhaling (dubbels/weggevers/kernbegrippen),
 * lengte passend bij de toetstijd, snellere afwerking (meteen vervangen als iets niet in de lesstof staat).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { NakijkItem, Vraag } from "./types.ts";
import { isTekenvraag, leesSchaal, zetTekenvakken } from "./tekenvak.ts";
import { blokkenVoorVraag, tekenvakMaat } from "./blad-volgorde.ts";
import { vraagSchema } from "./schema.ts";
import { controleerBerekeningen, gInstructie, gVoorToets, goedAfgerond, reken } from "./reken-check.ts";
import { dubbelsWeg, kernbegrippen, ontbrekendeKern, ontbrekendeTermen, samenhangIssues, vindDubbels } from "./samenhang.ts";
import { aantalVoorTijd, bouwplanPrompt, maakQuota, type Bouwplan, type PlanItem, type PlanQuota } from "./bouwplan.ts";
import { herstelBouwplan } from "./bouwplan-check.ts";
import { kalibratie } from "./kalibratie.ts";
import { vervangBuitenLesstof, werkVragenAf } from "./afwerken.ts";

const v = (nummer: number, stam: string, extra: Partial<Vraag> = {}): Vraag => ({ nummer, type: "open", rtti: "T1", domein: "6.3 Hard en zacht geluid", leerdoel: "", punten: 1, stam, ...extra });
const nk = (nummer: number, modelantwoord: string, punten = 1): NakijkItem => ({ nummer, modelantwoord, puntenverdeling: Array.from({ length: punten }, (_, i) => ({ punt: 1, criterium: `criterium ${i + 1}` })) });

const LESSTOF = `Hoofdstuk 6 Geluid

6.2 Hoge en lage tonen
De frequentie is het aantal trillingen per seconde. Geluid boven 20 000 Hz heet ultrasoon; geluid onder 20 Hz heet infrasoon.

6.3 Hard en zacht geluid
De geluidssterkte meet je met een decibelmeter in decibel (dB). Voorbeelden: fluisteren 30 dB. Bij elke 3 dB meer halveert de veilige tijd: 89 dB 1 uur, 92 dB 30 minuten, 95 dB 15 minuten.

6.4 Geluidssnelheid
In lucht is de geluidssnelheid ongeveer 343 m/s. Echo: geluid kaatst terug tegen een wand.

6.5 Geluidshinder
Ongewenst geluid heet lawaai of geluidshinder.`;

describe("sessie 4: tekenvak", () => {
  it("open tekenvraag krijgt een raster met schaal; meerkeuze en figuurvragen niet", () => {
    const vragen = [
      v(1, "Een lamp hangt aan het plafond. De zwaartekracht is 50 N. Teken de zwaartekracht met de schaal 1 cm ≙ 10 N."),
      v(2, "Welke pijl hoort bij de zwaartekracht? Teken niets.", { type: "meerkeuze", opties: [{ letter: "A", tekst: "omhoog" }, { letter: "B", tekst: "omlaag" }] }),
      v(3, "Noteer de eenheid van kracht."),
      v(4, "Geef de krachten aan.", { vormPlan: "teken" }),
    ];
    const uit = zetTekenvakken(vragen);
    assert.equal(uit[0]!.tekenvak?.soort, "raster");
    assert.equal(uit[0]!.tekenvak?.schaal, "1 cm ≙ 10 N");
    assert.ok((uit[0]!.tekenvak?.kolommen ?? 0) >= 8);
    assert.equal(uit[1]!.tekenvak, undefined);
    assert.equal(uit[2]!.tekenvak, undefined);
    assert.ok(uit[3]!.tekenvak, "geplande vorm teken → tekenvak");
    assert.equal(isTekenvraag(v(5, "Teken de pijl in de figuur.", { figuurId: "f1" })), false);
  });
  it("schaal in de gedeelde context van een groep telt mee", () => {
    const vragen = [
      v(1, "Noteer twee kenmerken van een krachtpijl.", { contextTitel: "Hangende lamp", context: "De zwaartekracht op de lamp is 50 N. Krachtenschaal: 1 cm = 25 N." }),
      v(2, "Teken de zwaartekracht op de lamp.", { contextTitel: "Hangende lamp" }),
    ];
    assert.equal(zetTekenvakken(vragen)[1]!.tekenvak?.schaal, "1 cm ≙ 25 N");
    assert.deepEqual(leesSchaal("schaal: 1 cm staat voor 5 newton"), { tekst: "1 cm ≙ 5 N", perCm: 5, eenheid: "N" });
  });
  it("blad: tekenvak vervangt de antwoordlijnen; maat begrensd; schema accepteert het veld", () => {
    const q = vraagSchema.parse({ nummer: 5, type: "open", rtti: "T1", domein: "3.2", leerdoel: "", punten: 3, stam: "Teken de zwaartekracht (1 cm ≙ 10 N).", tekenvak: { soort: "raster", kolommen: 40, rijen: 6, schaal: "1 cm ≙ 10 N" } }) as Vraag;
    assert.equal(q.tekenvak?.soort, "raster");
    assert.equal(q.tekenvak?.kolommen, undefined, "te breed → catch → standaardbreedte");
    const blokken = blokkenVoorVraag(q);
    assert.ok(blokken.includes("tekenvak"));
    assert.ok(!blokken.includes("antwoordlijnen"));
    assert.deepEqual(tekenvakMaat(q), { kolommen: 14, rijen: 6 });
    assert.ok(blokkenVoorVraag(v(6, "Leg uit.")).includes("antwoordlijnen"));
  });
});

describe("sessie 4: rekencontrole (uit 38d3c0b)", () => {
  it("rekent ketens na: kleine afrondfout hersteld, grote afwijking = sleutel-fout", () => {
    assert.equal(reken("343 × 4"), 1372);
    assert.ok(goedAfgerond("176", 176.4));
    const vragen = [v(1, "Bereken de afstand.", { punten: 2 }), v(2, "Bereken de afstand tot het onweer.", { punten: 2 })];
    const r = controleerBerekeningen(vragen, [nk(1, "s = 343 × 4 = 1371 m", 2), nk(2, "s = 343 × 4 = 1600 m", 2)], { g: 10 });
    assert.match(r.nakijkmodel[0]!.modelantwoord, /= 1372 m/);
    assert.deepEqual(r.hersteld, [1]);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0]!.code, "sleutel-fout");
    assert.equal(r.issues[0]!.nummer, 2);
  });
  it("één g: lesstof, anders wat de toets gebruikt, anders 10 N/kg; instructie op het blad", () => {
    assert.equal(gVoorToets("Gebruik g = 9,81 N/kg.", [], []), 9.81);
    assert.equal(gVoorToets("", [v(1, "Bereken Fz van 5 kg.")], [nk(1, "Fz = 5 × 9,8 = 49 N")]), 9.8);
    assert.equal(gVoorToets("", [], []), 10);
    const fz = [v(1, "Bereken de zwaartekracht op een tas van 5 kg.")];
    assert.equal(gInstructie(fz, 10), "Gebruik voor de zwaartekracht g = 10 N/kg.");
    assert.equal(gInstructie([v(1, "Noteer de eenheid van frequentie.")], 10), null);
  });
});

describe("sessie 4: herhaling en weggevers in de geschreven toets", () => {
  const vragen = [
    v(1, "Waarmee meet je de geluidssterkte?", { type: "meerkeuze", opties: [{ letter: "A", tekst: "een decibelmeter" }, { letter: "B", tekst: "een thermometer" }] }),
    v(2, "Noteer de geluidssnelheid in lucht. Geef ook de eenheid.", { domein: "6.4 Geluidssnelheid", punten: 2 }),
    v(3, "Noteer de maximale veilige tijd zonder gehoorbescherming bij 89 dB. Gebruik de reeks veilige blootstellingstijden.", { context: "Bram werkt bij een friteuse." }),
    v(4, "Later meet Bram 95 dB. Noteer de maximale veilige tijd.", {}),
    v(5, "Noteer de maximale veilige blootstellingstijd bij 95 dB. Gebruik de reeks veilige tijden.", { context: "Lotte staat bij een bouwklus." }),
    v(6, "Bereken de afstand tot het onweer. De geluidssnelheid is 343 m/s.", { context: "Sem ziet de bliksem en hoort 4 s later de donder.", domein: "6.4 Geluidssnelheid", punten: 2 }),
    v(7, "Noteer de functie van de oorschelp.", { domein: "6.6 Het oor" }),
  ];
  const nakijk = [nk(1, "A. een decibelmeter"), nk(2, "343 m/s", 2), nk(3, "1 uur"), nk(4, "15 minuten"), nk(5, "15 minuten"), nk(6, "s = 343 × 4 = 1372 m", 2), nk(7, "vangt het geluid op")];
  it("vindt zelfde uitkomst, zelfde begrippen en een opgevraagde waarde die elders gegeven wordt", () => {
    const d = vindDubbels(vragen, nakijk);
    assert.ok(d.some((x) => x.soort === "zelfde-antwoord" && x.a === 4 && x.b === 5));
    assert.ok(d.some((x) => x.soort === "overlap" && [3, 5].includes(x.a) && [3, 5].includes(x.b)));
    const w = d.find((x) => x.soort === "verklapt" && x.a === 2);
    assert.ok(w, "343 m/s staat in de rekenvraag");
    assert.equal(w!.slachtoffer, 2, "de rekenvraag heeft het gegeven nodig → de noteer-vraag wordt vervangen");
    assert.equal(d.findIndex((x) => x.soort === "verklapt") > d.findIndex((x) => x.soort === "overlap"), true, "ernstigste eerst");
  });
  it("kernbegrippen uit de lesstof; rijtjes (ultrasoon/infrasoon) gedekt met één; synoniem telt", () => {
    const kern = kernbegrippen(LESSTOF);
    assert.deepEqual(kern.map((k) => k.term), ["ultrasoon", "infrasoon", "decibelmeter", "echo", "lawaai"]);
    assert.equal(kern.find((k) => k.term === "decibelmeter")?.zwak, true);
    assert.deepEqual(kern.find((k) => k.term === "lawaai")?.alt, ["geluidshinder"]);
    const mis = ontbrekendeTermen(kern, (k) => ["ultrasoon", "geluidshinder"].some((t) => [k.term, ...(k.alt ?? [])].includes(t)));
    assert.deepEqual(mis.map((k) => k.term), ["decibelmeter", "echo"]);
    assert.deepEqual(ontbrekendeKern(vragen, nakijk, kern).map((k) => k.term), ["ultrasoon", "echo", "lawaai"]);
  });
  it("reparatie-opdrachten: dubbele vraag vervangen door een ontbrekend kernbegrip (echo); figuurvragen nooit", () => {
    const iss = samenhangIssues(vragen, nakijk, { kern: kernbegrippen(LESSTOF), max: 3 });
    assert.ok(iss.length >= 2 && iss.length <= 3);
    assert.ok(iss.every((i) => i.code === "herhaling" || i.code === "verklapt"));
    assert.ok(iss.some((i) => i.nummer === 2 && /"echo"/.test(i.uitleg)), "vraag in 6.4 krijgt echo");
    const metFiguur = vragen.map((q) => (q.nummer === 4 ? { ...q, figuurId: "f" } : q));
    assert.ok(!samenhangIssues(metFiguur, nakijk, { max: 5 }).some((i) => i.nummer === 4));
  });
  it("na reparatie nog dubbel → 1-puntsvraag eraf, binnen de grenzen", () => {
    assert.deepEqual(dubbelsWeg(vragen, nakijk, { minVragen: 5, minPunten: 0 }).length > 0, true);
    assert.deepEqual(dubbelsWeg(vragen, nakijk, { minVragen: 7, minPunten: 0 }), []);
  });
  it("niets dubbel in een nette toets", () => {
    const net = [v(1, "Noteer de eenheid van frequentie."), v(2, "Leg uit waarom je de bliksem eerder ziet dan je de donder hoort.")];
    assert.deepEqual(vindDubbels(net, [nk(1, "hertz"), nk(2, "licht gaat veel sneller dan geluid")]), []);
  });
});

describe("sessie 4: lengte en plancontrole", () => {
  it("aantal vragen past bij de toetstijd (2KB 45 min: 26 → 23), nooit onder 86 %, examen ongemoeid", () => {
    assert.equal(aantalVoorTijd(26, { minuten: 45, leerweg: "KB", examen: false }), 23);
    assert.equal(aantalVoorTijd(24, { minuten: 45, leerweg: "GT", examen: false }), 24);
    assert.equal(aantalVoorTijd(30, { minuten: 45, leerweg: "BB", examen: false }), 26);
    assert.equal(aantalVoorTijd(30, { minuten: 45, leerweg: "BB", examen: true }), 30);
  });
  it("quota: ingekort, punten gelijk, kernbegrippen in de planprompt", () => {
    const k = kalibratie(2, "KB", 45);
    const q = maakQuota({ bron: LESSTOF, paragrafen: [{ code: "6.2", titel: "Hoge en lage tonen" }, { code: "6.3", titel: "Hard en zacht geluid" }, { code: "6.4", titel: "Geluidssnelheid" }, { code: "6.5", titel: "Geluidshinder" }], aantalVragen: 26, doelPunten: 31, rttiDoel: { R: 35, T1: 40, T2: 20, I: 5 }, kal: k });
    assert.equal(q.aantal, 23);
    assert.equal(q.punten, 31);
    assert.equal(q.ingekortVan, 26);
    const p = bouwplanPrompt(q);
    assert.match(p, /Kernbegrippen uit de lesstof.*echo \(6\.4\)/);
    assert.match(p, /twee keer veilige tijd/);
  });
  const item = (n: number, o: Partial<PlanItem>): PlanItem => ({ n, par: "6.6", vorm: "kort", rtti: "R", punten: 1, begrip: `begrip${n}`, context: "", kern: `vraag ${n}`, antwoord: `antwoord${n}`, ...o });
  const quota: PlanQuota = {
    aantal: 6,
    punten: 8,
    paragrafen: [
      { code: "6.4", titel: "Geluidssnelheid", aantal: 2 },
      { code: "6.6", titel: "Het oor", aantal: 4 },
    ],
    rttiPunten: { R: 4, T1: 3, T2: 1, I: 0 },
    vorm: { jn: 0, mc: 0, kort: 5, invul: 0, uitleg: 0, reken: 1, teken: 0 },
    reserve: 1,
    kern: [{ par: "6.4", term: "echo" }],
  };
  it("zelfde antwoord in het plan → dubbel; ontbrekend kernbegrip (echo) neemt die plek in", () => {
    const plan: Bouwplan = {
      versie: 1,
      items: [
        item(1, { par: "6.4", vorm: "reken", punten: 2, rtti: "T1", begrip: "afstand onweer", kern: "bereken s = v × t", antwoord: "1372 m" }),
        item(2, { par: "6.4", begrip: "geluidssnelheid water", antwoord: "1500 m/s" }),
        item(3, { begrip: "onderdelen oor", kern: "noem drie delen na elkaar", antwoord: "trommelvlies gehoorbeentjes slakkenhuis", punten: 3 }),
        item(4, { begrip: "functie oorschelp", antwoord: "vangt het geluid op" }),
        item(5, { begrip: "schade haartjes", antwoord: "slakkenhuis" }),
        item(6, { begrip: "functie gehoorbeentjes", antwoord: "versterken de trilling", rtti: "T2" }),
      ],
      reserve: [],
    };
    const { plan: uit, issues } = herstelBouwplan(plan, quota);
    assert.ok(issues.some((i) => i.code === "begrip" && /hetzelfde antwoord/.test(i.detail)));
    const echo = uit.items.find((it) => it.begrip === "echo");
    assert.ok(echo, "echo heeft nu een vraag");
    assert.equal(echo!.par, "6.4");
    assert.ok(!uit.items.some((it) => it.begrip === "schade haartjes"), "de dubbele vraag is omgezet");
    assert.ok(issues.some((i) => i.code === "kern" && i.hersteld));
  });
  it("geen dubbel en geen vrije R-vraag → kernbegrip alleen gemeld (goede vragen blijven)", () => {
    const plan: Bouwplan = {
      versie: 1,
      items: [
        item(1, { par: "6.4", vorm: "reken", punten: 2, rtti: "T1", begrip: "afstand onweer", antwoord: "1372 m" }),
        item(2, { par: "6.4", begrip: "geluidssnelheid water", antwoord: "1500 m/s", rtti: "T1" }),
        item(3, { begrip: "onderdelen oor", antwoord: "trommelvlies", rtti: "T1" }),
        item(4, { begrip: "functie oorschelp", antwoord: "vangt het geluid op", rtti: "T1" }),
        item(5, { begrip: "gehoorschade", antwoord: "haartjes kapot", rtti: "T2" }),
        item(6, { begrip: "hamer aambeeld stijgbeugel", antwoord: "versterken de trilling", rtti: "T2" }),
      ],
      reserve: [],
    };
    const { issues } = herstelBouwplan(plan, quota);
    assert.ok(issues.some((i) => i.code === "kern" && !i.hersteld && /echo/.test(i.detail)));
  });
});

describe("sessie 4: afwerken", () => {
  it("'staat niet in de lesstof' → meteen vervangen door een ontbrekend kernbegrip", () => {
    const [i] = vervangBuitenLesstof([{ nummer: 3, code: "gegeven-ontbreekt", uitleg: "Niet oplosbaar: in de lesstof staat nergens dat het gehoor niet even gevoelig is." }], [{ par: "6.4", term: "echo" }]);
    assert.match(i!.uitleg, /VERVANG de vraag dan door een nieuwe vraag over "echo"/);
    const [j] = vervangBuitenLesstof([{ nummer: 3, code: "gegeven-ontbreekt", uitleg: "Niet oplosbaar: de massa ontbreekt." }], []);
    assert.doesNotMatch(j!.uitleg, /VERVANG/);
  });
  it("herhaling gaat mee in reparatieronde 1; tekenvak en rekenherstel staan in het resultaat", async () => {
    const vragen = [
      v(1, "Noteer de maximale veilige tijd bij 95 dB. Gebruik de reeks veilige blootstellingstijden.", { context: "Bram werkt bij een friteuse." }),
      v(2, "Noteer de maximale veilige blootstellingstijd bij 95 dB. Gebruik de reeks veilige tijden.", { context: "Lotte staat bij een bouwklus." }),
      v(3, "Bereken de afstand tot het onweer.", { context: "Sem ziet de bliksem en hoort 4 s later de donder. De geluidssnelheid is 343 m/s.", punten: 2, domein: "6.4 Geluidssnelheid" }),
      v(4, "Een kist wordt met 30 N naar rechts geduwd. Teken deze kracht met de schaal 1 cm ≙ 10 N.", { punten: 2, domein: "3.2 Krachten tekenen" }),
    ];
    const nakijk = [nk(1, "15 minuten"), nk(2, "15 minuten"), nk(3, "s = 343 × 4 = 1371 m", 2), nk(4, "pijl van 3 cm naar rechts", 2)];
    let repairPrompt = "";
    const res = await werkVragenAf({
      vragen,
      nakijkmodel: nakijk,
      bron: LESSTOF,
      vak: "NaSk",
      skipOrder: true,
      budgetMs: 60_000,
      controleer: async (p) => {
        const nrs = [...new Set([...p.matchAll(/"nummer":(\d+)/g)].map((m) => Number(m[1])))];
        return JSON.stringify({ oordelen: nrs.map((nummer) => ({ nummer, eigenAntwoord: "", juisteOpties: [], oplosbaar: true, ontbreekt: "", realistisch: true, realisme: "", helder: true, helderheid: "", rubriekOk: true, rubriek: "", rtti: "T1" })) });
      },
      repair: async (p) => {
        repairPrompt += p;
        return JSON.stringify({ vragen: [{ ...vragen[0], stam: "Leg uit wat een echo is." }], nakijkmodel: [nk(1, "teruggekaatst geluid")] });
      },
    });
    assert.match(repairPrompt, /herhaling: Vraag 1 toetst hetzelfde als vraag 2/);
    assert.match(repairPrompt, /NIEUWE vraag over "(ultrasoon|echo|lawaai|decibelmeter)"/);
    assert.ok(res.controle?.gevonden.some((g) => g.code === "herhaling"));
    const teken = res.vragen.find((q) => /Teken deze kracht/.test(q.stam));
    assert.equal(teken?.tekenvak?.schaal, "1 cm ≙ 10 N");
    assert.match(res.nakijkmodel.find((n) => /343/.test(n.modelantwoord))!.modelantwoord, /1372 m/);
  });
});

describe("sessie 4: één g na de gate (krachten plan5 v11)", () => {
  it("g = 10 in de vraag bij g = 9,8 in de lesstof → vraag en uitwerking gelijkgetrokken, 80 N wordt 78,4 N", () => {
    const vragen = [v(11, "Bereken de zwaartekracht op het krat.", { context: "Lotte tilt een melkkrat. De massa van het krat is 8 kg. Gebruik g = 10 N/kg.", punten: 2 })];
    const r = controleerBerekeningen(vragen, [nk(11, "Fz = m × g; Fz = 8 × 10 = 80 N", 2)], { g: 9.8 });
    assert.match(r.vragen[0]!.context!, /g = 9,8 N\/kg/);
    assert.match(r.nakijkmodel[0]!.modelantwoord, /8 × 9,8 = 78,4 N|8 × 9,8 = 78 N/);
    assert.doesNotMatch(r.nakijkmodel[0]!.modelantwoord.split(/ook goed/i)[0]!, /\b80 N/);
    assert.deepEqual(r.issues, []);
    assert.ok(r.hersteld.includes(11));
  });
  it("zonder g-omzetting blijft 180 voor 176,4 goed (significante cijfers)", () => {
    assert.ok(goedAfgerond("180", 176.4));
    assert.ok(!goedAfgerond("180", 176.4, true));
  });
});

describe("sessie 4: tekenvak alleen bij een echte tekenopdracht (plan5 energie v21)", () => {
  it("geplande tekenvraag die als rekenvraag is uitgeschreven krijgt geen tekenvak", () => {
    assert.equal(isTekenvraag(v(21, "Bereken de nettokracht op de trekker. Geef ook de richting.", { vormPlan: "teken" })), false);
    assert.equal(isTekenvraag(v(22, "Geef de krachten aan op de kar.", { vormPlan: "teken" })), true);
  });
});

describe("sessie 4: letterlijke kopie na reparatie (plan5 stoffen v1 = v2)", () => {
  it("twee identieke juist/onjuist-stellingen → dubbel; de 1-puntsvraag kan eraf", () => {
    const jo = { type: "juist-onjuist" as const, opties: [{ letter: "A", tekst: "Juist" }, { letter: "B", tekst: "Onjuist" }] };
    const vr = [v(1, "Verdampen is de overgang van vloeibaar naar gas.", jo), v(2, "Verdampen is de overgang van vloeibaar naar gas.", jo), v(3, "Een suspensie is troebel.", jo)];
    const n = [nk(1, "A. Juist"), nk(2, "A. Juist"), nk(3, "A. Juist")];
    assert.ok(vindDubbels(vr, n).some((d) => d.detail === "letterlijk dezelfde vraag"));
    assert.equal(dubbelsWeg(vr, n, { minVragen: 2, minPunten: 0 }).length, 1);
    assert.match(samenhangIssues(vr, n, { max: 2 })[0]!.uitleg, /blijft staan: "Verdampen/);
  });
});
