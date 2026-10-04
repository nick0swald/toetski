import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generatieSchema, isMc, keurGeneratie, MC_FIGUUR_VELDEN, normaliseer, vraagstukSchema, type Generatie } from "./grok-spec.ts";
import { laadFixtures } from "./laad.ts";
import type { VraagstukSpec } from "./spec.ts";

type Obj = { required?: string[]; properties: Record<string, { anyOf?: { type?: string }[] }> };
const isNullable = (p?: { anyOf?: { type?: string }[] }) => Boolean(p?.anyOf?.some((x) => x.type === "null") && p.anyOf.some((x) => x.type !== "null"));

describe("R25: MC- en figuurvelden kunnen niet uit het schema of de geparste output verdwijnen", () => {
  for (const [naam, sch] of [["generatieSchema", generatieSchema()], ["vraagstukSchema", vraagstukSchema()]] as const) {
    it(`${naam}: opties, juist en figuurslots zijn verplicht én nullable`, () => {
      const d = (sch as { $defs: Record<string, Obj> }).$defs;
      const am = d.deelvraag!.properties.antwoordmodel as unknown as Obj;
      for (const [o, velden] of [[d.deelvraag!, MC_FIGUUR_VELDEN.deelvraag], [am, MC_FIGUUR_VELDEN.antwoordmodel], [d.vraagstuk!, MC_FIGUUR_VELDEN.vraagstuk]] as const)
        for (const k of velden) {
          assert.ok(o.required?.includes(k), `${k} niet verplicht`);
          assert.ok(isNullable(o.properties[k]), `${k} niet nullable`);
        }
      assert.ok(MC_FIGUUR_VELDEN.deelvraag.includes("opties") && MC_FIGUUR_VELDEN.antwoordmodel.includes("juist"));
    });
  }
  it("normaliseer: null = afwezig; MC met opties/juist blijft MC; de keuring ziet geen schemafouten", () => {
    const vs = laadFixtures().filter((f): f is VraagstukSpec & { soort: "vraagstuk" } => f.soort === "vraagstuk").slice(0, 4);
    const metNull = structuredClone(vs).map((v) => ({ ...v, figuur: v.figuur ?? null, deelvragen: v.deelvragen.map((d) => ({ ...d, opties: d.opties ?? null, figuur: d.figuur ?? null, tekenvraag: d.tekenvraag ?? null, antwoordmodel: { ...d.antwoordmodel, juist: d.antwoordmodel.juist ?? null, figuur: d.antwoordmodel.figuur ?? null } })) }));
    const g = normaliseer({ titel: "t", vraagstukken: metNull } as unknown as Generatie);
    const ref = normaliseer({ titel: "t", vraagstukken: vs });
    assert.deepEqual(g, ref);
    const mc = (x: Generatie) => x.vraagstukken.flatMap((v) => v.deelvragen).filter(isMc).length;
    assert.ok(mc(g) > 0, "fixtures bevatten MC");
    assert.equal(mc(g), mc({ titel: "t", vraagstukken: vs }));
    const inv = { titel: "t", leerweg: "GT" as const, leerjaar: 3, duurMinuten: 45, bronmateriaal: "x", rttiDoel: { R: 25, T1: 40, T2: 27, I: 8 } };
    const r = keurGeneratie(g, inv, { items: 10, punten: 30 });
    assert.ok(!r.fouten.some((f) => /schema|must be|moet .* zijn|null/i.test(f)), r.fouten.filter((f) => /schema|null/i.test(f)).join("\n"));
  });
});
