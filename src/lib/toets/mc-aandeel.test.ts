import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  annoteerMcAandeel,
  isTaalvaardigheidToets,
  mcAandeel,
  wilHogeMcShare,
} from "./mc-aandeel.ts";
import type { Vraag } from "./types.ts";

function q(type: Vraag["type"], n: number): Vraag {
  return {
    nummer: n,
    type,
    rtti: "R",
    domein: "X",
    leerdoel: "Y",
    punten: 1,
    stam: `Vraag ${n}`,
  };
}

describe("mcAandeel", () => {
  it("telt MC en juist-onjuist", () => {
    const vragen = [q("meerkeuze", 1), q("open", 2), q("juist-onjuist", 3), q("berekening", 4)];
    assert.equal(mcAandeel(vragen), 0.5);
  });
});

describe("wilHogeMcShare", () => {
  it("ja bij lange hoofdstukstof zonder vaste MC-telling", () => {
    assert.equal(
      wilHogeMcShare({
        bron: "Hoofdstuk 4 Warmte\n" + "x".repeat(700),
        titel: "Hoofdstuktoets warmte",
      }),
      true,
    );
  });
  it("nee bij dictee of vaste MC", () => {
    assert.equal(wilHogeMcShare({ bron: "x".repeat(800), titel: "Dictee week 3" }), false);
    assert.equal(wilHogeMcShare({ bron: "x".repeat(800), mcVragen: 3 }), false);
    assert.equal(isTaalvaardigheidToets("luistervaardigheid toets"), true);
  });
});

describe("annoteerMcAandeel", () => {
  it("zet aandachtspunt onder de 50%", () => {
    const vragen = [q("meerkeuze", 1), q("open", 2), q("open", 3), q("open", 4)];
    const k = annoteerMcAandeel({ samenvatting: "ok", punten: [] }, vragen, true);
    assert.ok(k.punten.some((p) => p.criterium === "MC-aandeel" && p.oordeel === "aandacht"));
  });
  it("laat ≥50% met rust", () => {
    const vragen = [q("meerkeuze", 1), q("meerkeuze", 2), q("open", 3), q("open", 4)];
    const k = annoteerMcAandeel({ samenvatting: "ok", punten: [] }, vragen, true);
    assert.equal(k.punten.some((p) => p.criterium === "MC-aandeel"), false);
  });
});
