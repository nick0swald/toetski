import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanItem, PlanQuota } from "./bouwplan.ts";
import { bouwplanPrompt, examenVorm, maakQuota } from "./bouwplan.ts";
import { dwingExamenBlokken, herstelBouwplan } from "./bouwplan-check.ts";
import { kalibratie } from "./kalibratie.ts";
import { buitenLesstofIssues, buitenStammenVoor, herstelMcOpties, herstelTitels, metDoelFiguren, uitkomsten, vervolgWeggeverIssues } from "./examen-checks.ts";
import { deterministisch } from "./afwerken.ts";
import { tekenvakVoor } from "./tekenvak.ts";
import type { NakijkItem, Vraag } from "./types";

const item = (n: number, o: Partial<PlanItem>): PlanItem => ({ n, par: "11.1", vorm: "kort", rtti: "T1", punten: 1, begrip: `begrip ${n}`, context: `situatie nummer ${n} met iets`, kern: `vraag ${n}`, antwoord: `antwoord${n}`, ...o });
const v = (nummer: number, o: Partial<Vraag> = {}): Vraag => ({ nummer, type: "open", rtti: "T1", domein: "11.1", leerdoel: "", punten: 1, stam: `Vraag ${nummer}?`, ...o }) as Vraag;
const nk = (nummer: number, modelantwoord: string, criterium = "juist"): NakijkItem => ({ nummer, modelantwoord, puntenverdeling: [{ punt: 1, criterium }] });

describe("SE4.2 run 2: contextblokken afdwingen (plan)", () => {
  it("plan met alleen losse vragen → 6–11 blokken van 2–4, vrijwel niets los, titels kort", () => {
    const pars = ["11.1", "11.2", "11.3", "11.4", "11.5", "13.1", "13.2", "13.3", "13.4", "2.1", "4.1", "4.2", "7.1", "7.4"];
    const items = Array.from({ length: 30 }, (_, i) => item(i + 1, { par: pars[i % pars.length]!, vorm: i % 3 === 0 ? "mc" : i % 3 === 1 ? "reken" : "kort", rtti: (["R", "T1", "T2"] as const)[i % 3], context: `${["Zonnepaneel", "Windmolen", "Stuwmeer", "Fietsdynamo", "Echolood"][i % 5]} op plek ${i}` }));
    const ex = examenVorm(kalibratie(4, "GT", 90), 30)!;
    const r = dwingExamenBlokken(items, ex);
    const groepen = new Map<string, PlanItem[]>();
    for (const it of items) if (it.groep) groepen.set(it.groep, [...(groepen.get(it.groep) ?? []), it]);
    assert.ok(r.blokken >= 6 && r.blokken <= 11, `blokken ${r.blokken}`);
    for (const [, l] of groepen) assert.ok(l.length >= 2 && l.length <= 4, `blok van ${l.length}`);
    assert.ok(items.filter((it) => !it.groep).length <= 3);
    // blokken aaneen, binnen een hoofdstuk, één situatie (alleen de eerste heeft context)
    for (const [, l] of groepen) {
      const idx = l.map((it) => items.indexOf(it));
      assert.equal(Math.max(...idx) - Math.min(...idx), l.length - 1);
      assert.equal(new Set(l.map((it) => it.par.split(".")[0])).size, 1);
      assert.ok(l.slice(1).every((it) => !it.context && it.let?.[0]?.startsWith("deelvraag in het blok")));
    }
  });
  it("herstelBouwplan doet het in examenvorm en houdt de blokvolgorde (geen gesloten-eerst)", () => {
    const items = Array.from({ length: 12 }, (_, i) => item(i + 1, { par: i < 6 ? "11.1" : "13.1", vorm: i % 2 ? "mc" : "reken", punten: i % 2 ? 1 : 3, begrip: `uniek ${"abcdefghijkl"[i]} begrip`, context: `${"abcdefghijkl"[i]} heel andere situatie ${i}` }));
    const q: PlanQuota = { aantal: 12, punten: 24, paragrafen: [{ code: "11.1", titel: "Energie", aantal: 6 }, { code: "13.1", titel: "Geluid", aantal: 6 }], rttiPunten: { R: 4, T1: 10, T2: 8, I: 2 }, vorm: { jn: 0, mc: 6, kort: 0, invul: 0, uitleg: 0, reken: 6, teken: 0 }, reserve: 0, examen: { blokken: 3, vragenPer: [2, 4], introWoorden: [20, 50] } };
    const { plan, issues } = herstelBouwplan({ versie: 1, items, reserve: [] }, q);
    const titels = plan.items.map((it) => it.groep);
    assert.ok(titels.every(Boolean));
    assert.ok(new Set(titels).size >= 3);
    assert.ok(issues.some((i) => i.code === "context" && i.hersteld));
  });
  it("quota examenvorm: minstens 2 uitlegvragen; lesstofgrens in de prompt", () => {
    const bron = `11.1 Energie\n${"Een centrale zet chemische energie om in elektrische energie. ".repeat(120)}\n13.1 Geluid\n${"Geluid is een trilling. ".repeat(100)}`;
    const q = maakQuota({ bron, paragrafen: [{ code: "11.1", titel: "Energie" }, { code: "13.1", titel: "Geluid" }], aantalVragen: 30, doelPunten: 56, rttiDoel: { R: 15, T1: 45, T2: 34, I: 6 }, kal: kalibratie(4, "GT", 90) });
    assert.ok(q.vorm.uitleg >= 2, JSON.stringify(q.vorm));
    assert.ok(q.buitenStammen?.includes("filtre"));
    assert.match(bouwplanPrompt(q), /Staat NIET in deze lesstof[^\n]*filtreren/);
  });
});

describe("SE4.2 run 2: checks op de toets", () => {
  it("dubbele MC-optie eruit, sleutel en rubriek omgeletterd; te weinig over → issue", () => {
    const q1 = v(1, { type: "meerkeuze", opties: [{ letter: "A", tekst: "een zand" }, { letter: "B", tekst: "een zand" }, { letter: "C", tekst: "een mengsel" }, { letter: "D", tekst: "een zuivere stof" }] });
    const r = herstelMcOpties([q1], [nk(1, "D. een zuivere stof", "Juiste keuze D")]);
    assert.deepEqual(r.vragen[0]!.opties!.map((o) => `${o.letter} ${o.tekst}`), ["A een zand", "B een mengsel", "C een zuivere stof"]);
    assert.match(r.nakijkmodel[0]!.modelantwoord, /^C\. een zuivere stof/);
    assert.equal(r.nakijkmodel[0]!.puntenverdeling[0]!.criterium, "Juiste keuze C");
    assert.equal(r.issues.length, 0);
    const q2 = v(2, { type: "meerkeuze", opties: [{ letter: "A", tekst: "zand" }, { letter: "B", tekst: "Zand." }, { letter: "C", tekst: "water" }] });
    const r2 = herstelMcOpties([q2], [nk(2, "C. water")]);
    assert.equal(r2.issues[0]?.code, "mc-opties");
  });
  it("deterministisch (na elke reparatie) valideert MC-opties en meldt weggevers tussen opeenvolgende vragen", () => {
    const q15 = v(15, { type: "berekening", punten: 2, context: "Lars stofzuigt. Zijn stofzuiger heeft een vermogen van 1,2 kW en staat een half uur aan.", stam: "Bereken het energieverbruik in kWh." });
    const q16 = v(16, { context: "Het energieverbruik is daardoor 0,60 kWh. 1 kWh kost € 0,25.", stam: "Wat kost het stofzuigen?" });
    assert.deepEqual(uitkomsten("E = P × t = 1,2 × 0,5 = 0,60 kWh"), ["0,60 kwh"]);
    const w = vervolgWeggeverIssues([q15, q16], [nk(15, "E = P × t = 1,2 × 0,5 = 0,60 kWh"), nk(16, "€ 0,15")]);
    assert.equal(w[0]?.nummer, 16);
    assert.equal(w[0]?.code, "weggever-vervolg");
    const det = deterministisch([q15, q16], [nk(15, "E = P × t = 1,2 × 0,5 = 0,60 kWh"), nk(16, "€ 0,15")], "x".repeat(100));
    assert.ok(det.issues.some((i) => i.code === "weggever-vervolg"));
  });
  it("lesstofgrens: filtreren buiten de SE4.2-lesstof → vervangen", () => {
    const bron = "Stofeigenschappen: smeltpunt, kookpunt, dichtheid. Een zuivere stof en een mengsel.";
    const buiten = buitenStammenVoor(bron);
    const q7 = v(7, { context: "Koen giet troebel kalkwater in een trechter met filterpapier.", stam: "Noteer de naam van deze scheidingsmethode." });
    const iss = buitenLesstofIssues([q7, v(8, { stam: "Wat is het smeltpunt?" })], [nk(7, "filtreren"), nk(8, "0 °C")], buiten);
    assert.deepEqual(iss.map((i) => i.nummer), [7]);
    assert.match(iss[0]!.uitleg, /filtreren|scheidingsmethoden/);
    assert.equal(buitenLesstofIssues([q7], [nk(7, "filtreren")], buitenStammenVoor(`${bron} Bij filtreren blijft het residu achter. scheidingsmethode`)).length, 0);
  });
  it("titels alleen op blokken; titel die niet past wordt vervangen", () => {
    const vr = herstelTitels([
      v(1, { type: "meerkeuze", contextTitel: "Fles etiket", context: "Lisa leest een etiket." }),
      v(2, { contextTitel: "Windpark", context: "In de moestuin groeien tomatenplanten in de zon. De tomatenplanten maken suikers.", stam: "Welke omzetting vindt plaats in de tomatenplanten?" }),
      v(3, { contextTitel: "Windpark", stam: "Waarom groeien tomatenplanten beter in de zon?" }),
    ]);
    assert.equal(vr[0]!.contextTitel, undefined);
    assert.equal(vr[0]!.context, "Lisa leest een etiket.");
    assert.equal(vr[1]!.contextTitel, "Tomatenplanten");
    assert.equal(vr[2]!.contextTitel, "Tomatenplanten");
  });
  it("figuurdoel: ~1 per blok (0,7), tussen basis en max", () => {
    const vr = Array.from({ length: 24 }, (_, i) => v(i + 1, { contextTitel: `Blok ${Math.floor(i / 3)}` }));
    assert.equal(metDoelFiguren(vr, 3, 6), 6);
    assert.equal(metDoelFiguren(vr.slice(0, 6), 3, 6), 3);
  });
});

describe("SE4.2 run 2: tekenvakmaat", () => {
  it("tekenvak: volle breedte, hoogte naar de tekening", () => {
    const tv = tekenvakVoor(v(1, { stam: "Teken een zijaanzicht. Schaal 1 cm ≙ 2 m. Het scherm is 16 m hoog." }));
    assert.equal(tv.kolommen, 16);
    assert.equal(tv.rijen, 11);
  });
});
