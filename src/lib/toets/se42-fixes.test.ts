import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanItem, PlanQuota } from "./bouwplan.ts";
import { bouwplanPrompt, contextBlokkenDoel, examenVorm, netteTitel, parseBouwplan, tekenSoortenUit } from "./bouwplan.ts";
import { balanceerRtti, herstelBouwplan, rttiPuntenVan } from "./bouwplan-check.ts";
import { boekEigennamen, boeknaamIssues } from "./samenhang.ts";
import { kalibratie } from "./kalibratie.ts";
import { parseFiguurSpec } from "./figuren/spec.ts";
import { tekenCodeFiguur } from "./figuren/svg.ts";
import { eindControle } from "./eind-controle.ts";
import { rechterPrompt } from "./eval/rubric.ts";
import type { GegenereerdeToets, Vraag } from "./types";

const item = (n: number, o: Partial<PlanItem>): PlanItem => ({ n, par: "1.1", vorm: "kort", rtti: "T1", punten: 1, begrip: `begrip${n}`, context: "", kern: `vraag ${n}`, antwoord: `antwoord${n}`, ...o });
const quota = (o: Partial<PlanQuota> = {}): PlanQuota => ({
  aantal: 10,
  punten: 20,
  paragrafen: [{ code: "1.1", titel: "Energie", aantal: 10 }],
  rttiPunten: { R: 3, T1: 9, T2: 7, I: 1 },
  vorm: { jn: 0, mc: 4, kort: 2, invul: 0, uitleg: 2, reken: 2, teken: 0 },
  reserve: 0,
  ...o,
});

describe("RTTI-balans in het plan (klas 4: T2 liep weg naar T1)", () => {
  it("labelt T1-items om naar T2 tot het doel binnen de marge ligt; rekenen/uitleggen eerst", () => {
    const items = [
      ...Array.from({ length: 4 }, (_, i) => item(i + 1, { vorm: "mc", rtti: i === 0 ? "R" : "T1", punten: 1 })),
      item(5, { vorm: "reken", punten: 3 }),
      item(6, { vorm: "uitleg", punten: 2 }),
      item(7, { vorm: "reken", punten: 3 }),
      item(8, { vorm: "kort", punten: 2 }),
      item(9, { vorm: "kort", punten: 2, rtti: "R" }),
      item(10, { vorm: "uitleg", punten: 2, rtti: "T2" }),
    ];
    const doel = { R: 3, T1: 9, T2: 7, I: 1 };
    assert.equal(rttiPuntenVan(items).T2, 2);
    const n = balanceerRtti(items, doel, 20);
    assert.ok(n >= 1);
    const r = rttiPuntenVan(items);
    assert.ok(Math.abs(r.T2 - doel.T2) <= 1, JSON.stringify(r));
    assert.ok(items.filter((it) => it.rtti === "T2").every((it) => it.vorm !== "mc" || it === items[9]));
    assert.ok(items.some((it) => it.let?.some((l) => /^T2-vraag/.test(l))));
  });
  it("herstelBouwplan meldt de omlabeling als hersteld", () => {
    const items = Array.from({ length: 10 }, (_, i) => item(i + 1, { vorm: i < 4 ? "mc" : i < 6 ? "reken" : "uitleg", punten: i < 4 ? 1 : i < 6 ? 3 : 2, begrip: `uniek begrip nummer ${["a","b","c","d","e","f","g","h","i","j"][i]}` }));
    const { plan, issues } = herstelBouwplan({ versie: 1, items, reserve: [] }, quota());
    const r = rttiPuntenVan(plan.items);
    assert.ok(r.T2 >= 5, JSON.stringify(r));
    assert.ok(issues.some((i) => i.code === "rtti"));
  });
});

describe("examenvorm klas 4 GT", () => {
  it("kalibratie cse → contextblokken met 3–5 deelvragen; prompt noemt examenvorm en korte titels", () => {
    const k = kalibratie(4, "GT", 60);
    const ex = examenVorm(k, 22)!;
    assert.deepEqual(ex.vragenPer, [2, 4]);
    assert.ok(ex.blokken >= 5 && ex.blokken * ex.vragenPer[0] <= 22, JSON.stringify(ex));
    const q = quota({ aantal: 22, examen: ex });
    assert.equal(contextBlokkenDoel(q), ex.blokken);
    const p = bouwplanPrompt(q);
    assert.match(p, /EXAMENVORM/);
    assert.match(p, /korte titel van 1–4 woorden/);
    assert.ok(examenVorm(kalibratie(4, "GT", 60, { examen: true }), 21)!.vragenPer[0] >= 4);
    assert.equal(examenVorm(kalibratie(3, "GT", 45), 24), undefined);
  });
  it("groepstitels zonder gegevens (\"Krat m=12 kg …\" → \"Krat\")", () => {
    assert.equal(netteTitel("Krat m=12 kg hijst hijskraan h=5,0 m; g="), "Krat");
    assert.equal(netteTitel("Finn roept bij steile muur; echo na 0,60"), "Finn roept bij steile muur");
    assert.equal(netteTitel("zonneboiler op het dak van een huis"), "Zonneboiler op het dak");
    const plan = parseBouwplan({ items: [0, 1, 2].map(() => ["1.1", "reken", "T1", 2, "x", "c", "", "k", "a", "Waterkrachtcentrale: 40 m val"]) });
    assert.equal(plan.items[0]!.groep, "Waterkrachtcentrale");
  });
});

describe("binnen de toetsstof en geen boeknamen", () => {
  const energie = "11.1 Fossiele brandstoffen\nDe Eemshavencentrale in Groningen stookt steenkool. Een energiestroomdiagram laat zien waar de energie heen gaat.\n13.2 Toonhoogte\nOp de oscilloscoop zie je de trilling. Waterkracht en windkracht.";
  it("tekensoorten volgen de lesstof (geen krachtpijl in een energie/geluid-toets)", () => {
    const t = tekenSoortenUit(energie);
    assert.ok(t.some((x) => /energiestroomdiagram/.test(x)));
    assert.ok(t.some((x) => /oscilloscoop/.test(x)));
    assert.ok(!t.some((x) => /kracht/.test(x)));
  });
  it("tekenvraag 'zwaartekracht als pijl' wordt korte open vraag; waterkracht-diagram blijft", () => {
    const items = [
      item(1, { vorm: "teken", punten: 2, begrip: "zwaartekracht", kern: "teken de zwaartekracht als pijl op schaal" }),
      item(2, { vorm: "teken", punten: 2, begrip: "energiestroom waterkracht", kern: "teken het energiestroomdiagram van een waterkrachtcentrale" }),
      ...Array.from({ length: 8 }, (_, i) => item(i + 3, { vorm: "mc", begrip: `los begrip ${"abcdefgh"[i]}` })),
    ];
    const { plan } = herstelBouwplan({ versie: 1, items, reserve: [] }, quota({ tekenSoorten: tekenSoortenUit(energie) }));
    const zw = plan.items.find((it) => it.begrip === "zwaartekracht")!;
    const wk = plan.items.find((it) => it.begrip === "energiestroom waterkracht")!;
    assert.equal(zw.vorm, "kort");
    assert.equal(wk.vorm, "teken");
  });
  it("eigennamen uit lesboek/antwoordenboek; prompt verbiedt ze; vraag met naam → reparatie", () => {
    const namen = boekEigennamen(`${energie}\nDe Sloecentrale bij Vlissingen is een gascentrale. In Nederland en Europa.`);
    for (const n of ["Eemshavencentrale", "Groningen", "Sloecentrale", "Vlissingen"]) assert.ok(namen.includes(n), n);
    for (const n of ["Nederland", "Europa", "Toonhoogte"]) assert.ok(!namen.includes(n), n);
    assert.match(bouwplanPrompt(quota({ eigennamen: namen })), /Neem geen eigennamen uit de lesstof over[^\n]*Eemshavencentrale/);
    const q = { nummer: 3, type: "meerkeuze", stam: "Waarvoor dient het koelwater?", context: "Bij de Eemshaven draait een centrale. De Eemshavencentrale stookt kolen.", punten: 1 } as unknown as Vraag;
    const iss = boeknaamIssues([q], namen);
    assert.equal(iss[0]?.code, "boeknaam");
    const opdr = boekEigennamen("Lees de tekst. a Bereken het vermogen. b Leg uit waarom. Je moet bereken en waarom gebruiken, Tijdbasis Tijdbasis staat op het scherm.");
    for (const n of ["Bereken", "Waarom", "Tijdbasis Tijdbasis"]) assert.ok(!opdr.includes(n), n);
    assert.equal(boeknaamIssues([{ ...q, context: "Bereken het vermogen.", stam: "Bereken." } as Vraag], ["Bereken"]).length, 1);
  });
});

describe("figuren: oscilloscoopscherm en nooit figuur + tekenvak", () => {
  it("oscilloscoopspec wordt geparst en getekend (raster, tijdbasis)", () => {
    const { spec, fout } = parseFiguurSpec({ soort: "oscilloscoopbeeld", doel: "toon aflezen", data: { signalen: [{ trillingstijdHokjes: 4, amplitudeHokjes: 2 }], tijdbasis: "0,5 ms/div" } });
    assert.equal(fout, undefined);
    assert.equal(spec!.soort, "oscilloscoop");
    const g = tekenCodeFiguur(spec!);
    assert.match(g.svg, /<polyline/);
    assert.deepEqual(g.teksten, ["tijdbasis: 0,5 ms/div"]);
  });
  it("eindControle: geplaatste figuur blijft, tekenvak vervalt", () => {
    const q = { nummer: 1, type: "open", stam: "Teken het pad van het geluid.", punten: 1, tekenvak: { soort: "raster", kolommen: 8, rijen: 8 }, figuur: { soort: "sfeerplaat", mime: "image/jpeg", data: "AAAA" } } as unknown as Vraag;
    const t = { vragen: [q], nakijkmodel: [], meta: { vak: "NaSk" } } as unknown as GegenereerdeToets;
    const uit = eindControle(t);
    assert.equal(uit.vragen[0]!.tekenvak, undefined);
    assert.ok(uit.vragen[0]!.figuur);
  });
});

describe("rechter ziet de hele lesstof en beoordeelt klas 4 op examenniveau", () => {
  it("geen afkapping op 20k; examenblok bij leerjaar 4", () => {
    const lang = `${"a".repeat(60_000)}SLOTPARAGRAAF`;
    const t = { vragen: [], nakijkmodel: [], meta: { vak: "NaSk" } } as unknown as GegenereerdeToets;
    const p = rechterPrompt(t, { bronmateriaal: lang, leerweg: "GT", leerjaar: 4, duurMinuten: 75, aantalVragen: 26, doelPunten: 47 } as never);
    assert.match(p, /SLOTPARAGRAAF/);
    assert.match(p, /EXAMENNIVEAU/);
  });
});
