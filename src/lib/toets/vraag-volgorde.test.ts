import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isVolgordeGemengd, ordenVragenMcEerst } from "./vraag-volgorde.ts";
import type { NakijkItem, Vraag } from "./types.ts";

function q(nummer: number, type: Vraag["type"]): Vraag {
  return {
    nummer,
    type,
    rtti: "R",
    domein: "D",
    leerdoel: "L",
    punten: 1,
    stam: `Vraag ${nummer}`,
  };
}

describe("ordenVragenMcEerst", () => {
  it("zet MC eerst en synchroniseert nakijk", () => {
    const vragen = [q(1, "open"), q(2, "meerkeuze"), q(3, "berekening")];
    const nakijk: NakijkItem[] = [
      { nummer: 1, modelantwoord: "a", puntenverdeling: [] },
      { nummer: 2, modelantwoord: "B. x", puntenverdeling: [] },
      { nummer: 3, modelantwoord: "c", puntenverdeling: [] },
    ];
    const out = ordenVragenMcEerst(vragen, nakijk);
    assert.deepEqual(
      out.vragen.map((v) => v.type),
      ["meerkeuze", "open", "berekening"],
    );
    assert.deepEqual(
      out.vragen.map((v) => v.nummer),
      [1, 2, 3],
    );
    assert.equal(out.nakijkmodel[0]?.modelantwoord, "B. x");
    assert.equal(out.nakijkmodel[1]?.modelantwoord, "a");
  });
});

describe("isVolgordeGemengd", () => {
  it("true als open vóór MC staat", () => {
    assert.equal(isVolgordeGemengd([q(1, "open"), q(2, "meerkeuze")]), true);
  });
  it("false als MC al eerst staat", () => {
    assert.equal(isVolgordeGemengd([q(1, "meerkeuze"), q(2, "open")]), false);
  });
});
