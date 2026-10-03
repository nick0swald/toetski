/**
 * Preventie (first-time-right): instructies uit de inhoud, standaardantwoordregels, meterfiguur, weggevers over de hele
 * toets, eerlijke RTTI, boekparafrase, examendoelen en vraagtypen per klas, cesuurpercentage, labels in de docentversie.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { laadFixtures } from "./laad.ts";
import { verwerkToets } from "./pijplijn.ts";
import { hulpmiddelenVoor, instructieVoor, matrijsTotalen, vraagtypeLabel, vraagtypeNaam } from "./opmaak.ts";
import { standaardRegels } from "./pijplijn.ts";
import { keurMeter, meetMeter, meterSvg } from "./figuren/meter.ts";
import { isWeetvraag, zoekBoekParafrase, zoekGegevenWeggevers } from "./inhoud-keuring.ts";
import { autoHerstel } from "./auto-herstel.ts";
import { normaliseerVraagtype, officieelVraagtype, relevanteDoelen, vraagtypeSpreiding } from "./doelen.ts";
import { doelenRegel, mcModelantwoord, specPrompt, vraagtypeRegel, type SpecInvoer } from "./grok-spec.ts";
import { cesuurPct } from "./cijfer-n.ts";
import { reviewPrompt, verwerkReview } from "./docent-review.ts";
import type { MeterFiguur, VraagstukSpec } from "./spec.ts";

const FX = laadFixtures();
const vragenVan = (...ids: string[]) => verwerkToets({ titel: "t", vragen: ids }, FX).vragen;
const regelsVan = (ids: string[]) => instructieVoor(vragenVan(...ids)).flatMap((b) => b.regels).join(" | ");

test("voorbladinstructie volgt de inhoud: g alleen bij zwaartekracht, Binas/rekenmachine alleen als nodig", () => {
  const elek = FX.filter((f) => f.id.startsWith("se43")).map((f) => f.id);
  const kracht = FX.filter((f) => f.id.startsWith("se41")).map((f) => f.id);
  assert.ok(elek.length && kracht.length);
  assert.doesNotMatch(regelsVan(elek), /10 N\/kg/, "elektriciteit: geen g-regel");
  assert.match(regelsVan(kracht), /10 N\/kg/, "krachten: wel de g-regel");
  // Alleen MC-vragen: geen regel over lijnen of rekenen.
  const mc = vragenVan(...FX.map((f) => f.id)).filter((q) => q.opties?.length && !q.berekeningen?.length && !/bereken/i.test(q.stam));
  if (mc.length) {
    const r = instructieVoor(mc).flatMap((b) => b.regels).join(" ");
    assert.doesNotMatch(r, /lijnen|berekening/i);
    assert.ok(!hulpmiddelenVoor(mc).includes("Je mag een rekenmachine gebruiken."));
  }
});

test("standaard antwoordregels: MC 0, open vraag punten+1 (rekenen +1), 2–8", () => {
  assert.equal(standaardRegels({ stam: "Welke?", punten: 1, opties: ["a", "b"] }), 0);
  assert.equal(standaardRegels({ stam: "Leg uit waarom.", punten: 2 }), 3);
  assert.equal(standaardRegels({ stam: "Bereken de stroom.", punten: 3, berekeningen: [{ naam: "I", formule: "1", waarde: 1 }] }), 5);
  assert.equal(standaardRegels({ stam: "Noem één.", punten: 1 }), 2);
  assert.equal(standaardRegels({ stam: "x", punten: 12 }), 8);
  assert.equal(standaardRegels({ stam: "x", punten: 2, antwoordregels: 4 }), 4);
});

test("meterfiguur: waarde terug te lezen uit de SVG (wijzer en kWh) en keuring", () => {
  const w: MeterFiguur = { type: "meter", soort: "wijzer", eenheid: "V", min: 0, max: 10, streep: 0.5, getalElke: 2, waarde: 6.5, breedteCm: 6 };
  assert.ok(Math.abs(meetMeter(meterSvg(w)).waarde! - 6.5) < 0.01);
  assert.deepEqual(keurMeter(w), []);
  const k: MeterFiguur = { type: "meter", soort: "kwh", eenheid: "kWh", waarde: 4821.3, cijfers: 5, decimalen: 1, breedteCm: 6 };
  assert.ok(Math.abs(meetMeter(meterSvg(k)).waarde! - 4821.3) < 0.01);
  assert.ok(keurMeter({ ...w, waarde: 12 }).length > 0, "buiten de schaal");
});

const vs = (id: string, deel: Partial<VraagstukSpec["deelvragen"][number]>[], context: string[] = []): VraagstukSpec =>
  ({
    id,
    se: "SE4.3",
    hoofdstuk: "Elektriciteit",
    titel: id,
    context,
    deelvragen: deel.map((d, i) => ({ id: `${id}-${"abcd"[i]}`, vraagtype: { nr: 63, code: "OVERIG", naam: "Overig" }, niveau: "BB/KB/GT", punten: 1, stam: "Leg uit.", antwoordmodel: { regels: ["x"] }, scorestappen: [{ omschrijving: "x", punten: 1 }], rtti: "T1", ...d })),
  }) as unknown as VraagstukSpec;

test("weggever over de hele toets: 'Ga uit van 0,016 kW' na 'bereken het vermogen' (15 W)", () => {
  const lamp = vs("bureaulamp", [
    { stam: "Bereken het vermogen van de lamp.", punten: 3, parameters: [{ naam: "U", waarde: 230, eenheid: "V", bron: "tekst" }], berekeningen: [{ naam: "P", formule: "U*I", waarde: 15, eenheid: "W" }] },
    { stam: "Ga uit van een vermogen van 0,016 kW. Bereken de energie in 3 uur.", punten: 2 },
  ]);
  const b = zoekGegevenWeggevers([lamp]);
  assert.equal(b.length, 1);
  assert.match(b[0]!.tekst, /0,016 kW/);
  // ruim ernaast (20 %+): geen weggever
  const ok = structuredClone(lamp);
  ok.deelvragen[1]!.stam = "Ga uit van een vermogen van 0,020 kW. Bereken de energie in 3 uur.";
  assert.equal(zoekGegevenWeggevers([ok]).length, 0);
  // ook tussen vraagstukken (dan strenger: ≤ 2 %)
  const ander = vs("waterkoker", [{ stam: "Neem aan dat de lamp 15 W gebruikt. Hoeveel kost dat?", punten: 2 }]);
  assert.equal(zoekGegevenWeggevers([lamp, ander]).filter((x) => x.vraagstuk === "waterkoker").length, 1);
});

test("eerlijke RTTI: 1-punts weetvraag met label T1 wordt stil R", () => {
  const v = vs("lamp", [{ stam: "Wat is de functie van een zekering?", rtti: "T1" }, { stam: "Bereken de stroom.", punten: 2, rtti: "T1", berekeningen: [{ naam: "I", formule: "1", waarde: 1, eenheid: "A" }] }]);
  assert.ok(isWeetvraag(v.deelvragen[0]!));
  assert.ok(!isWeetvraag(v.deelvragen[1]!));
  const uit = autoHerstel({ titel: "t", vraagstukken: [v] } as never) as unknown as { gen: { vraagstukken: VraagstukSpec[] }; stappen: { wat: string }[] };
  const gen = uit.gen ?? (uit as unknown as { vraagstukken: VraagstukSpec[] });
  assert.equal(gen.vraagstukken[0]!.deelvragen[0]!.rtti, "R");
  assert.equal(gen.vraagstukken[0]!.deelvragen[1]!.rtti, "T1");
});

test("boekparafrase: dezelfde opdracht in andere woorden wordt gevonden", () => {
  const bron = "Opgave 4. Noteer twee mogelijke oorzaken waardoor een zekering in de meterkast doorslaat.\nDe stroom loopt door de draad.";
  const v = vs("zek", [{ stam: "Noem twee mogelijke oorzaken waardoor een zekering doorslaat in de meterkast." }, { stam: "Bereken de stroomsterkte door de waterkoker." }]);
  const b = zoekBoekParafrase([v], bron);
  assert.deepEqual(b.map((x) => x.id), ["zek-a"]);
});

test("vraagtypen: officieel nummer uit de 62, stille correctie en spreiding", () => {
  assert.deepEqual(officieelVraagtype("E-COMP")?.nr, 1);
  assert.equal(officieelVraagtype("K-ZWP")?.nr, 62);
  assert.equal(officieelVraagtype("OVERIG")?.nr, 63);
  const d = { vraagtype: { nr: 3, code: "E-COMP", naam: "x" } };
  normaliseerVraagtype(d);
  assert.equal(d.vraagtype.nr, 1);
  const onb = { vraagtype: { nr: 99, code: "BESTAAT-NIET", naam: "x" } };
  assert.match(normaliseerVraagtype(onb) ?? "", /63 OVERIG/);
  const s = vraagtypeSpreiding([vs("a", [{ vraagtype: { nr: 1, code: "E-COMP", naam: "" }, punten: 1 }, { vraagtype: { nr: 17, code: "E-R", naam: "" }, punten: 3 }])]);
  assert.equal(s.aantal, 2);
  assert.equal(s.maxAandeel, 75);
});

test("doelbron en vraagtypesturing per klas", () => {
  const bron = "De spanning en de stroomsterkte in een serieschakeling. De weerstand bereken je met de wet van Ohm. Spanning, stroomsterkte, weerstand en vervangingsweerstand in serie en parallel.";
  const k4 = relevanteDoelen(bron, 4, "GT");
  assert.ok(k4.some((d) => d.id === "K/5.6"), "klas 4: CvTE-eindterm");
  assert.ok(relevanteDoelen(bron, 3, "KB").every((d) => !d.id.startsWith("SLO")));
  assert.ok(relevanteDoelen(bron, 1, "GT").every((d) => d.id.startsWith("SLO")), "onderbouw: SLO-kerndoelen");
  assert.match(doelenRegel(4, k4), /examenniveau/);
  assert.match(doelenRegel(3, k4), /iets milder/);
  assert.match(doelenRegel(1, relevanteDoelen(bron, 1, "GT")), /SLO-kerndoelen/);
  assert.match(vraagtypeRegel(4, "1=E-COMP (x)"), /minstens 6/);
  assert.match(vraagtypeRegel(3, "1=E-COMP (x)"), /minstens 5/);
  assert.match(vraagtypeRegel(2, "1=E-COMP (x)"), /alleen een richting/);
  const inv = { titel: "Elektriciteit", leerjaar: 4, leerweg: "GT", duurMinuten: 50, bronmateriaal: bron, rttiDoel: { R: 25, T1: 40, T2: 25, I: 10 } } as unknown as SpecInvoer;
  const p = specPrompt(inv, { items: 20, punten: 30 });
  assert.match(p, /DOELEN \(CvTE-syllabus/);
  assert.match(p, /\b17=E-R\b/, "officiële nummers in de vraagtypelijst");
});

test("docent-review: doel- en vraagtypebevindingen; spreiding en doelen in de vraag", () => {
  const v = vs("lamp", [{ stam: "Bereken de stroom.", examendoel: "K/5.6", vraagtype: { nr: 17, code: "E-R", naam: "Weerstand" } }]);
  const gen = { titel: "t", vraagstukken: [v] } as never;
  const inv = { titel: "t", leerjaar: 4, leerweg: "GT", duurMinuten: 50, bronmateriaal: "spanning stroomsterkte weerstand ohm spanning weerstand" } as unknown as SpecInvoer;
  const { system, user } = reviewPrompt(gen, inv);
  assert.match(system, /examendoel/);
  assert.match(user, /SPREIDING VRAAGTYPEN/);
  assert.match(user, /CVTE-EINDTERMEN \(klas 4/);
  assert.match(user, /examendoel K\/5\.6; vraagtype 17/);
  const u = verwerkReview({ bevindingen: [{ id: "lamp-a", soort: "doel", ernst: "hoog", probleem: "doel past niet", fix: "ander doel" }, { id: "", soort: "vraagtype", ernst: "laag", probleem: "weinig variatie", fix: "ander type" }], figurenBeter: false } as never, gen);
  assert.equal(u.perVraagstuk.lamp?.length, 1);
  assert.equal(u.toets.length, 1);
  assert.equal(u.schoon, false);
});

test("labels en cijfers in de docentversie", () => {
  assert.equal(cesuurPct(16, 31), 52);
  assert.equal(vraagtypeNaam({ vraagtype: { nr: 1, code: "E-COMP", naam: "Componenten herkennen (E-COMP)" } }), "Componenten herkennen");
  assert.equal(vraagtypeLabel({ vraagtype: { nr: 1, code: "E-COMP", naam: "Componenten herkennen" } }), "Vraagtype 1 · Componenten herkennen");
  assert.equal(mcModelantwoord("D", "groengele isolatie", ["D. groengele isolatie"]).match(/groengele isolatie/g)?.length, 1);
  const t = matrijsTotalen(vragenVan(...FX.map((f) => f.id)));
  assert.ok(t.perVraagtype.length >= 3);
  assert.equal(t.perVraagtype.reduce((s, r) => s + r.punten, 0), t.punten);
  assert.ok(t.perParagraaf.length >= 1);
});

test("figuurbescherming: inkorten houdt minstens min(3, huidig) figuren", async () => {
  const { figuurAantal, inkorten, FIGUUR_BEHOUD } = await import("./grok-spec.ts");
  const toon = FX.find((f) => f.id === "se42-toongenerator") as VraagstukSpec;
  const kopie = (id: string, fig: boolean): VraagstukSpec => {
    const v = structuredClone(toon);
    const uit = { ...v, id, deelvragen: v.deelvragen.map((d, i) => ({ ...d, id: `${id}-${"abcd"[i]}`, begrip: `${id} ${i}` })) };
    if (!fig) {
      delete uit.figuur;
      for (const d of uit.deelvragen) delete d.figuur;
    }
    return uit;
  };
  const gen = { titel: "t", vraagstukken: [kopie("a", true), kopie("b", false), kopie("c", true), kopie("d", false), kopie("e", true), kopie("f", false)] };
  const voor = figuurAantal(gen);
  assert.ok(voor >= 3);
  const inv = { titel: "t", leerjaar: 4, leerweg: "GT", duurMinuten: 30, bronmateriaal: "x", rttiDoel: { R: 25, T1: 40, T2: 25, I: 10 } } as unknown as SpecInvoer;
  const totaal = gen.vraagstukken.flatMap((v) => v.deelvragen).reduce((s, d) => s + d.punten, 0);
  const r = inkorten(gen, inv, { items: 8, punten: Math.round(totaal / 3) });
  assert.ok(r.gen.vraagstukken.length < gen.vraagstukken.length || r.stappen.length > 0, "er is ingekort");
  assert.ok(figuurAantal(r.gen) >= Math.min(FIGUUR_BEHOUD, voor), `figuren ${figuurAantal(r.gen)} van ${voor}`);
});
