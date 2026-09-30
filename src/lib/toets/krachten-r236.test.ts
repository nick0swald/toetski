/**
 * Review Krachten 3GT (r236-kr): rekencontrole met één g, samenhang (weggevers, dubbele situaties/verbanden,
 * afleiders), RTTI-labels en -doelen, vraagtypen, leerdoelen uit de lesstof, tekenvak, examenregel één keer.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { controleerBerekeningen, gInstructie, goedAfgerond, gUitBron, reken } from "./reken-check.ts";
import { dubbeleContexten, repareerTaal, samenhangIssues, parseToetsReview, taalHetWoorden } from "./samenhang.ts";
import { labelRtti } from "./rtti-regels.ts";
import { isHandmatigRtti, metRttiDoel, minInzichtVragen, rttiDoelVoor } from "./constants.ts";
import { verfijnVraagtype } from "./kalibratie.ts";
import { maakLeerdoelPlan, leerdoelDekking, leerdoelIssues } from "./leerdoelen-plan.ts";
import { blokkenVoorVraag } from "./blad-volgorde.ts";
import { herstelGroepen, zonderHerhaling } from "./context-groepen.ts";
import { DOORREKENEN, rekenAftrek, vraagSpecifiek } from "./punten-rubric.ts";
import { inzichtIssues } from "./rtti-balans.ts";
import { vraagSchema } from "./schema.ts";
import type { NakijkItem, Vraag } from "./types.ts";

const q = (nummer: number, stam: string, extra: Partial<Vraag> = {}): Vraag => ({ nummer, type: "open", rtti: "T1", domein: "", leerdoel: "", punten: 2, stam, ...extra });
const mc = (nummer: number, stam: string, opties: string[], extra: Partial<Vraag> = {}): Vraag =>
  q(nummer, stam, { type: "meerkeuze", punten: 1, opties: opties.map((tekst, i) => ({ letter: "ABCD"[i]!, tekst })), ...extra });
const nk = (nummer: number, modelantwoord: string, criteria: string[] = []): NakijkItem => ({ nummer, modelantwoord, puntenverdeling: criteria.map((criterium) => ({ punt: 1, criterium })) });

describe("1. rekencontrole en g", () => {
  it("rekent na en rondt correct af", () => {
    assert.equal(reken("18 × 9,81")?.toFixed(2), "176.58");
    assert.ok(!goedAfgerond("176", 176.58), "afkappen is fout");
    assert.ok(goedAfgerond("177", 176.58));
    assert.equal(gUitBron("Op aarde is g = 9,8 N/kg."), 9.8);
    assert.equal(gUitBron("Reken met g = 10 N/kg."), 10);
  });
  it("Fz-keten met 9,81 → g van de toets, correct afgerond, ook goed met andere g; rubriek mee", () => {
    const r = controleerBerekeningen(
      [q(13, "Het krat heeft een massa van 18 kg. Bereken de zwaartekracht op het krat.", { vraagtype: "K-FZ" })],
      [nk(13, "Fz = m × g = 18 × 9,81 = 176 N", ["juiste uitkomst 176 N"])],
      { g: 9.8 },
    );
    const ma = r.nakijkmodel[0]!.modelantwoord;
    assert.match(ma, /18 × 9,8 = 176 N/);
    assert.match(ma, /Ook goed: 177 N \(met g = 9,81 N\/kg\) of 180 N \(met g = 10 N\/kg\)/);
    assert.equal(r.issues.length, 0);
  });
  it("afgekapt antwoord met g = 9,81 wordt 177 (g van de lesstof 9,81)", () => {
    const r = controleerBerekeningen([q(1, "Bereken de zwaartekracht op een tas van 18 kg.", { vraagtype: "K-FZ" })], [nk(1, "Fz = 18 × 9,81 = 176 N", ["176 N"])], { g: 9.81 });
    assert.match(r.nakijkmodel[0]!.modelantwoord, /= 177 N/);
    assert.equal(r.nakijkmodel[0]!.puntenverdeling[0]!.criterium, "177 N");
  });
  it("grote rekenfout → sleutel-fout", () => {
    const r = controleerBerekeningen([q(19, "Bereken de last.")], [nk(19, "F2 = 180 × 65 / 15 = 700 N")]);
    assert.equal(r.issues[0]?.code, "sleutel-fout");
  });
  it("instructie met g op het blad alleen bij zwaartekrachtberekeningen", () => {
    assert.equal(gInstructie([q(1, "Een tas heeft een massa van 18 kg. Bereken de zwaartekracht.")], 9.8), "Gebruik voor de zwaartekracht g = 9,8 N/kg.");
    assert.equal(gInstructie([q(1, "Bereken de druk.")], 9.8), null);
  });
});

describe("2–4, 6. samenhang", () => {
  const vragen = [
    mc(1, "Welke kracht trekt het krat naar beneden?", ["Zwaartekracht", "Normaalkracht", "Spierkracht", "Veerkracht"], { context: "Bram tilt een krat op.", vraagtype: "K-SOORT" }),
    q(7, "Waarom lukt het Luuk om de zware steen te verplaatsen?", { context: "Luuk gebruikt een koevoet om een steen te verplaatsen.", vraagtype: "K-HEF" }),
    mc(8, "Wat geldt er bij evenwicht?", ["F1 × r1 is groter dan F2 × r2", "Alleen de armen zijn gelijk", "Alleen de krachten zijn gelijk", "F1 × r1 is gelijk aan F2 × r2"], { context: "Een wip is in evenwicht.", vraagtype: "K-MOM" }),
    q(12, "Noem twee soorten krachten die hier een rol spelen.", { context: "Emma tilt een krat met boeken op.", contextTitel: "Krat" }),
    q(18, "Leg uit waarom Daan de koevoet ver van de steen vastpakt.", { context: "Daan verplaatst een steen met een koevoet.", contextTitel: "Koevoet" }),
    q(19, "Bereken hoe groot de last is.", { contextTitel: "Koevoet", punten: 3, vraagtype: "K-MOM" }),
    mc(9, "Waarom zakt Sanne niet weg met sneeuwschoenen?", ["Groter oppervlak, kleinere druk", "Kleiner oppervlak, grotere druk", "Grotere kracht", "Kleinere kracht"], { vraagtype: "K-DRUKB" }),
    mc(10, "Waarom heeft een tractor brede banden?", ["Groter oppervlak, kleinere druk", "Kleiner oppervlak, grotere druk", "Grotere kracht", "Kleinere massa"], { vraagtype: "K-DRUKB" }),
    mc(2, "Hoe groot is de zwaartekracht op de tas?", ["Altijd 10 N", "Kleiner dan 0 N", "Magnetische kracht", "180 N"], { vraagtype: "K-FZ" }),
  ];
  const nakijk = [
    nk(1, "A. Zwaartekracht"),
    nk(7, "De arm van de spierkracht is groter.", ["arm groter"]),
    nk(8, "D. F1 × r1 is gelijk aan F2 × r2"),
    nk(12, "zwaartekracht en spierkracht", ["zwaartekracht", "spierkracht"]),
    nk(18, "grotere arm, kleinere kracht", ["arm"]),
    nk(19, "F1 × r1 = F2 × r2 → 180 × 65 = F2 × 15 → F2 = 780 N", ["gebruik van hefboomwet (F1 × r1 = F2 × r2)", "invullen", "780 N"]),
    nk(9, "A"),
    nk(10, "A"),
    nk(2, "D. 180 N"),
  ];
  const issues = samenhangIssues(vragen, nakijk);
  const van = (nr: number) => issues.filter((i) => i.nummer === nr).map((i) => i.code);
  it("formule als MC-optie die elders punten oplevert → verklapt", () => assert.ok(van(8).includes("verklapt")));
  it("MC-antwoord is deel van een open antwoord → verklapt", () => assert.ok(van(1).includes("verklapt")));
  it("koevoet + steen twee keer → dubbele situatie bij de losse vraag (groep blijft heel)", () => {
    assert.ok(van(7).includes("dubbele-context"));
    assert.ok(!van(18).includes("dubbele-context"));
  });
  it("hetzelfde verband twee keer → dubbel concept", () => assert.ok(van(10).includes("dubbel-concept")));
  it("onzinafleiders → afleider", () => assert.ok(van(2).includes("afleider")));
  it("dubbeleContexten vindt 'tilt … op' niet als het voorwerp verschilt", () => {
    assert.deepEqual(dubbeleContexten([q(1, "x", { context: "Bram tilt een doos op." }), q(2, "y", { context: "Sanne fietst naar huis." })]), []);
  });
  it("taal: het-woorden", () => {
    assert.equal(taalHetWoorden("Kleinere oppervlak"), "Kleiner oppervlak");
    assert.equal(taalHetWoorden("Daan tilt dezelfde krat op."), "Daan tilt hetzelfde krat op.");
    assert.equal(repareerTaal([q(1, "De krat is zwaar.")])[0]!.stam, "Het krat is zwaar.");
  });
  it("toetsreview wordt geparsed; onbekende codes/nummers vallen weg", () => {
    const r = parseToetsReview(JSON.stringify({ bevindingen: [{ nummer: 8, code: "verklapt", ander: 19, uitleg: "optie D" }, { nummer: 99, code: "verklapt" }, { nummer: 7, code: "iets" }] }), vragen);
    assert.equal(r.length, 1);
    assert.match(r[0]!.uitleg, /vraag 19/);
  });
});

describe("5. contextzin niet herhalen in de stam", () => {
  it("bijna letterlijke herhaling eruit, ook bij een losse vraag", () => {
    assert.equal(zonderHerhaling(["Bram tilt een krat met gereedschap op in zijn werkplaats."], "Bram tilt een krat met gereedschap op. Noem twee krachten."), "Noem twee krachten.");
    const r = herstelGroepen([q(1, "Emma hangt een blok aan een veer. Hoe groot is de uitrekking?", { context: "Emma hangt een blok aan een veer." })]);
    assert.equal(r[0]!.stam, "Hoe groot is de uitrekking?");
  });
});

describe("8. RTTI", () => {
  it("klas 1–4 uit één bron: R daalt, T2 stijgt; klas 3 = 25/40/27/8", () => {
    const d = [1, 2, 3, 4].map((j) => rttiDoelVoor(j));
    assert.deepEqual(d[2], { R: 25, T1: 40, T2: 27, I: 8 });
    for (let i = 1; i < 4; i++) {
      assert.ok(d[i]!.R <= d[i - 1]!.R);
      assert.ok(d[i]!.T2 >= d[i - 1]!.T2);
    }
    for (const v of d) assert.equal(v.R + v.T1 + v.T2 + v.I, 100);
    assert.equal(minInzichtVragen(3), 1);
    assert.equal(minInzichtVragen(2), 0);
  });
  it("oude harnas-/formulierwaarde R10/T1 50 wordt het klasdoel, tenzij handmatig", () => {
    const basis = { leerjaar: 3, moeilijkheid: "normaal" as const, rttiDoel: { R: 10, T1: 50, T2: 35, I: 5 } };
    assert.deepEqual(metRttiDoel(basis).rttiDoel, { R: 25, T1: 40, T2: 27, I: 8 });
    assert.deepEqual(metRttiDoel({ ...basis, rttiHandmatig: true }).rttiDoel, basis.rttiDoel);
    assert.ok(isHandmatigRtti(basis.rttiDoel, 3));
  });
  it("30 − 10 kiezen = T1; formule herkennen = R; één helder label met korte reden", () => {
    const [a, b] = labelRtti([
      mc(4, "Wat is de resulterende kracht?", ["40 N naar rechts", "20 N naar links", "0 N", "20 N naar rechts"], { rtti: "T2", vraagtype: "K-RES", context: "Sanne trekt met 30 N naar rechts en duwt met 10 N naar links op een kist." }),
      mc(8, "Wat geldt er bij evenwicht?", ["F1 × r1 is groter dan F2 × r2", "Alleen de armen zijn gelijk", "Alleen de krachten zijn gelijk", "F1 × r1 is gelijk aan F2 × r2"], { rtti: "T2", vraagtype: "K-MOM" }),
    ]);
    assert.equal(a!.rtti, "T1");
    assert.equal(b!.rtti, "R");
    assert.match(b!.rttiUitleg ?? "", /^R — /);
    assert.doesNotMatch(b!.rttiUitleg ?? "", /→|model:/);
  });
  it("geen I-vraag in klas 3 → één open vraag wordt I", () => {
    const r = inzichtIssues([q(1, "Bereken de druk.", { rtti: "T2", punten: 3 }), mc(2, "x", ["a", "b", "c", "d"])], 1);
    assert.equal(r.length, 1);
    assert.equal(r[0]!.nummer, 1);
  });
});

describe("9. vraagtypen", () => {
  it("Fz- en veerberekeningen krijgen een domeintype, geen S-CALC-OV", () => {
    assert.equal(verfijnVraagtype(q(1, "Het krat heeft een massa van 18 kg. Bereken de zwaartekracht op het krat.", { vraagtype: "S-CALC-OV" })), "K-FZ");
    assert.equal(verfijnVraagtype(q(1, "Een veer rekt 4 cm uit bij 8 N. Bereken de veerconstante.", { vraagtype: "S-CALC-OV" })), "K-VEER");
    assert.equal(verfijnVraagtype(mc(6, "Hoe verandert de uitrekking van de veer?", ["Recht evenredig", "Omgekeerd evenredig", "Niet", "Kwadratisch"], { vraagtype: "K-SOORT" })), "K-VEER");
    assert.equal(verfijnVraagtype(q(1, "Bereken de druk in N/cm².", { vraagtype: "S-CALC-OV" })), "K-DRUK");
  });
});

const KRACHTEN = `Hoofdstuk 3 Krachten
3.1 Soorten krachten
Een kracht kan een voorwerp van vorm doen veranderen of laten versnellen. Kracht meet je met een krachtmeter (veerunster) in newton. Soorten: zwaartekracht, veerkracht, spankracht, normaalkracht, wrijvingskracht, spierkracht. Fz = m × g met g = 9,8 N/kg.
3.2 Krachten tekenen
Je tekent een kracht als een pijl. Het beginpunt is het aangrijpingspunt, de lengte is de grootte (krachtenschaal, bijvoorbeeld 1 cm ≙ 10 N). De normaalkracht werkt loodrecht op het steunvlak en zwaartekracht grijpt aan in het midden.
3.3 Krachten samenstellen
Twee krachten op één lijn in dezelfde richting tel je op; in tegengestelde richting trek je ze af. Dat is de resulterende kracht. Twee krachten die een hoek maken stel je samen met de parallellogrammethode en een vector.
3.4 Veren
Een veer rekt uit als je eraan trekt. De uitrekking u is recht evenredig met de kracht: F = C × u. C is de veerconstante in N/cm. In een F-u-diagram is dat een rechte lijn door de oorsprong.
3.5 Hefbomen
Een hefboom draait om een draaipunt. Moment = kracht × arm. Hefboomwet: F1 × r1 = F2 × r2. Voorbeelden: koevoet, kruiwagen, wip, tang. Met een lange arm heb je een kleine kracht nodig.
3.6 Druk
Druk is kracht per oppervlakte: p = F / A in N/m² (pascal). Een groter oppervlak geeft een kleinere druk (sneeuwschoenen), een klein oppervlak een grote druk (punaise, mes).`;

describe("10. leerdoelen uit de lesstof", () => {
  const plan = maakLeerdoelPlan({ titel: "H3 Krachten", bron: KRACHTEN, leerjaar: 3, leerweg: "GT", doelPunten: 34, aantalVragen: 24, zonderPlaatjes: true })!;
  const ids = plan.doelen.map((d) => d.id);
  it("geen katrol (niet in de lesstof); wel krachtmeter, veer, hefboom, druk", () => {
    assert.ok(!ids.includes("K/9.3"), ids.join(" "));
    for (const id of ["K/3.4", "K/9.1", "K/9.2", "K/9.10"]) assert.ok(ids.includes(id), `${id} in ${ids.join(" ")}`);
    assert.match(plan.herkomst, /lesstof/);
  });
  it("tekendoel zonder plaatjes is geen gat; ontbrekend doel → vervangverzoek", () => {
    const v2 = plan.doelen.find((d) => d.tekenen);
    assert.ok(v2, "er is een tekendoel (vector/parallellogram)");
    const vragen = [q(1, "a", { leerdoelId: "K/9.1" }), q(2, "b", { leerdoelId: "K/9.1" }), q(3, "c", { leerdoelId: "K/9.1" })];
    const dek = leerdoelDekking(vragen, plan);
    assert.ok(dek.alleenTekening.some((r) => r.id === v2!.id));
    assert.ok(!dek.ongedekt.some((r) => r.id === v2!.id));
    const iss = leerdoelIssues(vragen, plan);
    assert.ok(iss.length >= 1 && iss[0]!.code === "dekking");
  });
});

describe("11. tekenvak", () => {
  it("schema accepteert tekenvak; blad krijgt een tekenvak in plaats van lijnen", () => {
    const v = vraagSchema.parse({ nummer: 5, type: "open", rtti: "T1", domein: "3.2", leerdoel: "", punten: 3, stam: "Teken de zwaartekracht (1 cm ≙ 10 N).", tekenvak: { soort: "raster", kolommen: 10, rijen: 6, schaal: "1 cm ≙ 10 N" } });
    assert.equal(v.tekenvak?.soort, "raster");
    const blokken = blokkenVoorVraag(v as Vraag);
    assert.ok(blokken.includes("tekenvak"));
    assert.ok(!blokken.includes("antwoordlijnen"));
  });
});

describe("12. examenregel één keer", () => {
  it("niet meer per vraag; oude data gefilterd", () => {
    assert.ok(!rekenAftrek(["geen deling door 2"]).includes(DOORREKENEN));
    assert.deepEqual(vraagSpecifiek([DOORREKENEN, "geen eenheid"]), ["geen eenheid"]);
  });
});
