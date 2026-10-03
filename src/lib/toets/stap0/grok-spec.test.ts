import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alsGegenereerdeToets, alsToetsSpec, generatieSchema, genereerSpec, keurGeneratie, naarXaiSchema, pasHerstelToe, zoekWeggevers, type ChatFn, type SpecInvoer } from "./grok-spec.ts";
import { laadFixtures } from "./laad.ts";
import type { VraagstukSpec } from "./spec.ts";
import { kalibratie } from "../kalibratie.ts";
import { scoorToets } from "../eval/rubric.ts";

const vs = () => laadFixtures().filter((f): f is VraagstukSpec => f.soort === "vraagstuk");
const inv: SpecInvoer = { titel: "H13 Geluid", leerweg: "GT", leerjaar: 4, duurMinuten: 45, bronmateriaal: "13.1 Geluid maken\nTrillingen.\n13.2 Toonhoogte\nFrequentie.", rttiDoel: { R: 15, T1: 45, T2: 34, I: 6 } };

describe("stap 0 + Grok: spec-generatie (offline)", () => {
  it("schema voor xAI: $defs, geen ^…$ in patronen, vraagstuk 3–4 deelvragen", () => {
    const s = JSON.stringify(generatieSchema());
    assert.ok(!s.includes("#/definitions/") && s.includes("#/$defs/vraagstuk"));
    assert.ok(!/"pattern":"\^/.test(s));
    const o = naarXaiSchema({ type: "object", anyOf: [{ required: ["a"] }, { required: ["b"] }], properties: { a: { pattern: "^x$" } } }) as Record<string, unknown>;
    assert.equal(o.anyOf, undefined);
    assert.deepEqual(o.properties, { a: { pattern: "x" } });
    const d = (generatieSchema().$defs as Record<string, { properties: Record<string, { minItems: number; maxItems: number }> }>).vraagstuk.properties.deelvragen;
    assert.deepEqual([d.minItems, d.maxItems], [3, 4]);
  });

  it("keuring: fixtures zijn goed behalve de lengte; standaard één leerlingdeel, geen splitsing", () => {
    const r = keurGeneratie({ titel: "t", vraagstukken: vs() }, inv, { items: 4, punten: 6 });
    assert.deepEqual(r.fouten, []);
    assert.equal(r.feiten.figuren, r.feiten.figurenGo);
    assert.equal(r.toets.delen, undefined);
    assert.deepEqual(r.res.delen.length, 1);
    const kort = keurGeneratie({ titel: "t", vraagstukken: vs() }, inv, { items: 17, punten: 28 });
    assert.ok(kort.fouten.some((f) => /lengte/.test(f)));
  });

  it("keuring: rekenfout, weggever, merk- en schoolnaam worden gevonden", () => {
    const v = structuredClone(vs()[0]!);
    v.deelvragen[1]!.berekeningen![2]!.waarde = 1300;
    v.deelvragen[2]!.context = ["De toon van 1250 Hz klinkt in de aula van het Vechtdal College."];
    const r = keurGeneratie({ titel: "t", vraagstukken: [v] }, inv, { items: 4, punten: 6 });
    assert.ok(r.fouten.some((f) => /spec zegt 1300/.test(f)), r.fouten.join("\n"));
    assert.ok(r.fouten.some((f) => /weggever/.test(f)));
    assert.ok(r.fouten.some((f) => /schoolnaam/.test(f)));
    assert.ok(zoekWeggevers([v]).length >= 1);
  });

  it("keuring: tekenvraag met een al ingevulde grafiek is fout", () => {
    const v = structuredClone(vs()[0]!);
    v.deelvragen[0]!.stam = "Teken de grafiek van de meetwaarden.";
    v.deelvragen[0]!.figuur = { type: "grafiek", x: { label: "t (s)", min: 0, max: 4, stap: 1 }, y: { label: "s (m)", min: 0, max: 8, stap: 2 }, reeksen: [{ punten: [[0, 0], [4, 8]], vorm: "punten" }], breedteCm: 8, controle: [{ meting: "y@4", verwacht: 8 }] };
    const r = keurGeneratie({ titel: "t", vraagstukken: [v] }, inv, { items: 4, punten: 6 });
    assert.ok(r.fouten.some((f) => /tekenvraag/.test(f)), r.fouten.join("\n"));
  });

  it("herstel: vervangen, toevoegen en schrappen per vraagstuk-id", () => {
    const [a] = vs();
    const b = { ...structuredClone(a!), id: "nieuw" };
    const g = pasHerstelToe({ titel: "t", vraagstukken: [a!] }, { vraagstukken: [b], schrappen: [a!.id] });
    assert.deepEqual(g.vraagstukken.map((x) => x.id), ["nieuw"]);
  });

  it("genereerSpec: 1 herstelronde alleen bij fouten; adapter werkt met de rubriek", async () => {
    let n = 0;
    const chat: ChatFn = async (_m, schema) => {
      n++;
      return JSON.stringify(schema.naam === "toets_spec" ? { titel: "x", vraagstukken: vs() } : { vraagstukken: [], schrappen: [] });
    };
    const kal = kalibratie(4, "GT", 45);
    const g = await genereerSpec(inv, kal, chat);
    assert.equal(n, 2);
    assert.ok(g.hersteld);
    const ok = await genereerSpec(inv, { items: 4, punten: 6 }, chat);
    assert.equal(ok.hersteld, false);
    const toets = alsGegenereerdeToets(ok.rapport.res, inv, kal);
    assert.equal(toets.vragen.length, 4);
    assert.ok(toets.vragen.every((q) => (q as unknown as { figuur?: unknown }).figuur), "figuur van het vraagstuk geldt voor alle deelvragen");
    assert.match(toets.nakijkmodel.find((x) => x.nummer === 3)!.modelantwoord, /^[A-D]\. /);
    const kaart = scoorToets(toets, { ...inv, doelPunten: 28, aantalVragen: 17 });
    assert.ok(kaart.hard.find((h) => h.id === "H-mc")!.ok);
    assert.ok(kaart.hard.find((h) => h.id === "H-figuur")!.ok);
    assert.equal(alsToetsSpec({ titel: "x", vraagstukken: [] }, inv).voorblad?.schoolveld, "");
  });
});
