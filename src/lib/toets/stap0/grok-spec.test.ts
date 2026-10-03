import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alsGegenereerdeToets,
  alsToetsSpec,
  generatieSchema,
  genereerSpec,
  inkorten,
  keurGeneratie,
  naarXaiSchema,
  ontbrekendeParagrafen,
  vraagstukSchema,
  zoekDubbeleBegrippen,
  zoekKruisWeggevers,
  zoekWeggevers,
  type ChatFn,
  type SpecInvoer,
} from "./grok-spec.ts";
import { laadFixtures } from "./laad.ts";
import { verwerkToets } from "./pijplijn.ts";
import { isSeToets, uitlegIndeling } from "./opmaak.ts";
import { leerlingGroepen } from "./export-pdf.ts";
import type { VraagstukSpec } from "./spec.ts";
import { kalibratie } from "../kalibratie.ts";
import { scoorToets } from "../eval/rubric.ts";

const vs = () => laadFixtures().filter((f): f is VraagstukSpec & { soort: "vraagstuk" } => f.soort === "vraagstuk");
const toon = () => structuredClone(vs()[0]!);
const inv: SpecInvoer = { titel: "H13 Geluid", leerweg: "GT", leerjaar: 4, duurMinuten: 45, bronmateriaal: "13.2 Toonhoogte\nFrequentie.\n13.3 Trillingstijd\nOscilloscoop.", rttiDoel: { R: 15, T1: 45, T2: 34, I: 6 } };
const klein = { items: 4, punten: 6 };
const W = ["alfa", "beta", "gamma", "delta"];
/** Kopie van het toongenerator-vraagstuk met nieuwe ids (en dus een ander vraagstuk). */
const kopie = (id: string): VraagstukSpec => {
  const v = toon();
  return { ...v, id, deelvragen: v.deelvragen.map((d, i) => ({ ...d, id: `${id}-${"abcd"[i]}`, begrip: `${id} ${W[i]}`, antwoordmodel: { ...d.antwoordmodel, regels: [`${id}${W[i]} uniek${id}${W[i]} zinnetje${id}${W[i]}`, ...d.antwoordmodel.regels.slice(1)] } })) };
};

describe("stap 0 + Grok: spec-generatie (offline)", () => {
  it("schema voor xAI: $defs, geen ^…$ in patronen, vraagstuk 3–4 deelvragen, begrip verplicht", () => {
    const s = JSON.stringify(generatieSchema());
    assert.ok(!s.includes("#/definitions/") && s.includes("#/$defs/vraagstuk"));
    assert.ok(!/"pattern":"\^/.test(s));
    const o = naarXaiSchema({ type: "object", anyOf: [{ required: ["a"] }, { required: ["b"] }], properties: { a: { pattern: "^x$" } } }) as Record<string, unknown>;
    assert.equal(o.anyOf, undefined);
    assert.deepEqual(o.properties, { a: { pattern: "x" } });
    const d = generatieSchema().$defs as Record<string, { properties: Record<string, { minItems: number; maxItems: number }>; required: string[] }>;
    assert.deepEqual([d.vraagstuk.properties.deelvragen.minItems, d.vraagstuk.properties.deelvragen.maxItems], [3, 4]);
    assert.ok(d.deelvraag.required.includes("begrip"));
    assert.ok(JSON.stringify(vraagstukSchema()).includes('"required":["vraagstuk"]'));
  });

  it("keuring: fixtures zijn goed behalve de lengte; standaard één leerlingdeel, geen splitsing", () => {
    const r = keurGeneratie({ titel: "t", vraagstukken: vs() }, inv, klein);
    assert.deepEqual(r.fouten, []);
    assert.equal(r.feiten.figuren, r.feiten.figurenGo);
    assert.equal(r.toets.delen, undefined);
    assert.equal(r.res.delen.length, 1);
    assert.ok(keurGeneratie({ titel: "t", vraagstukken: vs() }, inv, { items: 17, punten: 28 }).fouten.some((f) => /lengte/.test(f)));
  });

  it("keuring: rekenfout, weggever, merk- en schoolnaam worden gevonden", () => {
    const v = toon();
    v.deelvragen[1]!.berekeningen![2]!.waarde = 1300;
    v.deelvragen[2]!.context = ["De toon van 1250 Hz klinkt in de aula van het Vechtdal College."];
    const r = keurGeneratie({ titel: "t", vraagstukken: [v] }, inv, klein);
    assert.ok(r.fouten.some((f) => /spec zegt 1300/.test(f)), r.fouten.join("\n"));
    assert.ok(r.fouten.some((f) => /weggever/.test(f)));
    assert.ok(r.fouten.some((f) => /schoolnaam/.test(f)));
    assert.ok(zoekWeggevers([v]).length >= 1);
  });

  it("keuring: tekenvraag met een al ingevulde grafiek is fout", () => {
    const v = toon();
    v.deelvragen[0]!.stam = "Teken de grafiek van de meetwaarden.";
    v.deelvragen[0]!.figuur = { type: "grafiek", x: { label: "t (s)", min: 0, max: 4, stap: 1 }, y: { label: "s (m)", min: 0, max: 8, stap: 2 }, reeksen: [{ punten: [[0, 0], [4, 8]], vorm: "punten" }], breedteCm: 8, controle: [{ meting: "y@4", verwacht: 8 }] };
    assert.ok(keurGeneratie({ titel: "t", vraagstukken: [v] }, inv, klein).fouten.some((f) => /tekenvraag/.test(f)));
  });

  it("dubbel begrip (label of bijna hetzelfde antwoord) en MC-opties die een ander antwoord verklappen", () => {
    const a = kopie("orgel");
    const b = kopie("fluit");
    b.deelvragen[0]!.begrip = a.deelvragen[0]!.begrip;
    const d = zoekDubbeleBegrippen([a, b]);
    assert.ok(d.some((x) => x.id === "fluit-a" && x.vraagstuk === "fluit"));
    // bijna hetzelfde modelantwoord in een ander vraagstuk
    const c = kopie("gitaar");
    c.deelvragen[0]!.antwoordmodel.regels = ["De amplitude is groter, dus het geluid klinkt harder"];
    const e = kopie("trommel");
    e.deelvragen[2]!.antwoordmodel = { regels: ["Grotere amplitude: het geluid klinkt harder"] };
    e.deelvragen[2]!.opties = undefined;
    e.deelvragen[2]!.scorestappen = [{ omschrijving: "harder", punten: 1 }];
    assert.ok(zoekDubbeleBegrippen([c, e]).some((x) => /bijna hetzelfde antwoord/.test(x.tekst)));
    // MC-optie verklapt het antwoord van een open vraag
    const f = kopie("viool");
    f.deelvragen[0]!.antwoordmodel.regels = ["De snaar trilt sneller en de toon klinkt hoger"];
    f.deelvragen[2]!.opties = ["De snaar trilt sneller en de toon klinkt hoger", "beeld B", "beeld C", "beeld D"];
    const k = zoekKruisWeggevers([f]);
    assert.ok(k.some((x) => x.gever === "viool-c" && /in de opties/.test(x.tekst)), JSON.stringify(k));
    assert.ok(keurGeneratie({ titel: "t", vraagstukken: [f] }, inv, klein).fouten.some((x) => /verklapt het antwoord/.test(x)));
  });

  it("dekking: ontbrekende paragrafen uit de lesstof worden genoemd", () => {
    const v = kopie("toon");
    v.deelvragen.forEach((d) => (d.leerdoel = "13.2 frequentie"));
    v.context = ["Een toon."];
    v.deelvragen.forEach((d) => (d.stam = d.stam.replace(/geluid/gi, "toon")));
    const o = ontbrekendeParagrafen([v], { ...inv, bronmateriaal: "13.1 Geluid maken\nTrillingen.\n13.2 Toonhoogte\nFrequentie." });
    assert.deepEqual(o.map((p) => p.code), ["13.1"]);
  });

  it("gericht herstel: afgekeurd vraagstuk wordt opnieuw gegenereerd (niet geschrapt)", async () => {
    const fout = toon();
    fout.deelvragen[1]!.berekeningen![2]!.waarde = 1300;
    const goed = toon();
    const prompts: string[] = [];
    const chat: ChatFn = async (m, schema) => {
      if (schema.naam === "toets_spec") return JSON.stringify({ titel: "x", vraagstukken: [fout] });
      prompts.push(m.at(-1)!.content);
      return JSON.stringify({ vraagstuk: goed });
    };
    const g = await genereerSpec(inv, klein, chat);
    assert.equal(g.gerichteAanroepen, 1);
    assert.match(prompts[0]!, /AFGEKEURD[\s\S]*spec zegt 1300/);
    assert.deepEqual(g.rapport.fouten, []);
    assert.deepEqual(g.gen.vraagstukken.map((v) => v.id), [fout.id]);
    assert.ok(g.stappen.some((s) => s.ok && /opnieuw/.test(s.wat)));
  });

  it("gericht herstel: na 2 mislukte pogingen geschrapt en aangevuld tot binnen 90–110 %", async () => {
    const fout = kopie("kapot");
    fout.deelvragen[1]!.berekeningen![2]!.waarde = 1300;
    const blijft = kopie("heel");
    let nieuw = 0;
    const chat: ChatFn = async (m, schema) => {
      if (schema.naam === "toets_spec") return JSON.stringify({ titel: "x", vraagstukken: [blijft, fout] });
      const p = m.at(-1)!.content;
      if (/AFGEKEURD/.test(p)) return JSON.stringify({ vraagstuk: fout }); // blijft fout
      nieuw++;
      return JSON.stringify({ vraagstuk: kopie("vervanger") });
    };
    const g = await genereerSpec(inv, { items: 8, punten: 12 }, chat);
    assert.ok(g.stappen.some((s) => s.wat === "geschrapt" && s.id === "kapot"));
    assert.equal(nieuw, 1, JSON.stringify(g.stappen, null, 1));
    assert.deepEqual(g.gen.vraagstukken.map((v) => v.id), ["heel", "aanvulling-1"]);
    assert.equal(g.rapport.feiten.punten, 12);
    assert.deepEqual(g.rapport.fouten, []);
  });

  it("gericht herstel: budgetweigering breekt niet af", async () => {
    const fout = toon();
    fout.deelvragen[1]!.berekeningen![2]!.waarde = 1300;
    const chat: ChatFn = async (_m, schema) => {
      if (schema.naam === "toets_spec") return JSON.stringify({ titel: "x", vraagstukken: [fout] });
      throw new Error("budget");
    };
    const g = await genereerSpec(inv, klein, chat);
    assert.equal(g.gerichteAanroepen, 1);
    assert.ok(g.stappen.some((s) => s.wat === "geschrapt"));
  });

  it("adapter werkt met de rubriek; figuur van het vraagstuk geldt voor alle deelvragen", () => {
    const r = keurGeneratie({ titel: "x", vraagstukken: vs() }, inv, klein);
    const kal = kalibratie(4, "GT", 45);
    const toets = alsGegenereerdeToets(r.res, inv, kal);
    assert.equal(toets.vragen.length, 4);
    assert.ok(toets.vragen.every((q) => (q as unknown as { figuur?: unknown }).figuur));
    assert.match(toets.vragen[0]!.context ?? "", /figuur bij vraag 1 \(als afbeelding bijgevoegd\)/);
    assert.match(toets.nakijkmodel.find((x) => x.nummer === 3)!.modelantwoord, /^[A-D]\. /);
    const kaart = scoorToets(toets, { ...inv, doelPunten: 28, aantalVragen: 17 });
    assert.ok(kaart.hard.find((h) => h.id === "H-mc")!.ok);
    assert.ok(kaart.hard.find((h) => h.id === "H-figuur")!.ok);
    assert.equal(alsToetsSpec({ titel: "x", vraagstukken: [] }, inv).voorblad?.schoolveld, "");
  });

  it("klas: in klas 2 geen SE-/klas-4-teksten, codes per onderwerp", () => {
    const klas2 = { ...inv, leerjaar: 2, leerweg: "KB" as const };
    const t = alsToetsSpec({ titel: "x", vraagstukken: vs() }, klas2);
    assert.deepEqual(t.klas, { leerjaar: 2, leerweg: "KB" });
    const res = verwerkToets(t, vs());
    assert.ok(res.vragen.every((q) => /^[KMEBA]-\d\d$/.test(q.code)), res.vragen.map((q) => q.code).join());
    assert.ok(!/klas 4|PTA|SE-toets/.test(uitlegIndeling(t.klas)));
    assert.match(uitlegIndeling({ leerjaar: 4, leerweg: "KB" }), /PTA klas 4 KB/);
    assert.ok(isSeToets(undefined) && isSeToets(4) && !isSeToets(3));
    const t4 = alsToetsSpec({ titel: "x", vraagstukken: vs() }, inv);
    assert.ok(verwerkToets(t4, vs()).vragen.every((q) => /^SE4\.\d-\d\d$/.test(q.code)));
  });

  it("opmaak: een vraagstuk is één groep (korte vraagstukken delen een pagina, nooit midden in de titel)", () => {
    const res = verwerkToets({ titel: "x", vragen: [kopie("a").id, kopie("b").id] }, [{ ...kopie("a"), soort: "vraagstuk" } as never, { ...kopie("b"), soort: "vraagstuk" } as never]);
    const g = leerlingGroepen(res.vragen);
    assert.deepEqual(g.map((x) => x.length), [4, 4]);
  });
  it("aanvullen: te korte toets en ontbrekende paragraaf worden aangevuld (parallel, nieuwe vraagstukken)", async () => {
    const inv3 = { ...inv, bronmateriaal: "13.1 Het oor\nHet trommelvlies trilt mee.\n13.2 Toonhoogte\nFrequentie.\n13.3 Trillingstijd\nOscilloscoop." };
    let n = 0;
    const chat: ChatFn = async (m, schema) => {
      if (schema.naam === "toets_spec") return JSON.stringify({ titel: "x", vraagstukken: [kopie("start")] });
      const p = m.at(-1)!.content;
      assert.match(p, /NIEUW vraagstuk[\s\S]*13\.1 Het oor/);
      const v = kopie(`nieuw${++n}`);
      v.deelvragen.forEach((d) => (d.leerdoel = "13.1 het trommelvlies in het oor"));
      return JSON.stringify({ vraagstuk: v });
    };
    const g = await genereerSpec(inv3, { items: 8, punten: 12 }, chat);
    assert.equal(n, 1, JSON.stringify({ s: g.stappen, f: g.rapport.fouten, e: g.eerste.fouten }, null, 1));
    assert.deepEqual(g.rapport.fouten, []);
    assert.deepEqual(g.rapport.feiten.ontbrekendeParagrafen, []);
    assert.equal(g.rapport.feiten.lengtePct, 100);
  });

  it("inkorten: te lang → vraagstuk met de laagste waarde deterministisch geschrapt (geen aanroep)", () => {
    const a = kopie("een");
    const b = kopie("twee");
    const c = kopie("drie");
    for (const v of [a, c]) v.deelvragen.forEach((d) => (d.rtti = "T2"));
    b.deelvragen.forEach((d) => (d.rtti = "R"));
    const k = inkorten({ titel: "x", vraagstukken: [a, b, c] }, inv, { items: 8, punten: 12 });
    assert.deepEqual(k.gen.vraagstukken.map((v) => v.id), ["een", "drie"]);
    assert.match(k.stappen[0]!.wat, /geschrapt \(te lang/);
    // binnen 110 %: niets
    assert.equal(inkorten({ titel: "x", vraagstukken: [a, c] }, inv, { items: 8, punten: 12 }).stappen.length, 0);
  });

  it("gericht herstel: hoogstens 4 aanroepen tegelijk", async () => {
    const fouten = ["piet", "quinten", "robin", "sanne", "tomas", "ursula"].map((id) => {
      const v = kopie(id);
      v.deelvragen[1]!.berekeningen![2]!.waarde = 1300;
      return v;
    });
    let bezig = 0;
    let max = 0;
    const chat: ChatFn = async (m, schema) => {
      if (schema.naam === "toets_spec") return JSON.stringify({ titel: "x", vraagstukken: fouten });
      bezig++;
      max = Math.max(max, bezig);
      await new Promise((r) => setTimeout(r, 5));
      bezig--;
      const id = /zelfde id \("([a-z0-9-]+)"\)/.exec(m.at(-1)!.content)?.[1] ?? "z";
      return JSON.stringify({ vraagstuk: kopie(id) });
    };
    const g = await genereerSpec(inv, { items: 24, punten: 36 }, chat, { maxGericht: 12 });
    assert.ok(max <= 4 && max >= 2, String(max));
    assert.deepEqual(g.rapport.fouten, []);
  });
});
