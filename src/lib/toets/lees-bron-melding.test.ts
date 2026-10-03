import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inkortMelding } from "./lees-bron.ts";

describe("lesstof te lang: zichtbare melding, nooit stil inkorten", () => {
  it("geen melding als alles past", () => {
    assert.equal(inkortMelding("kort", 100), null);
  });
  it("noemt hoeveel er wegvalt en welke paragrafen", () => {
    const tekst = `${"a".repeat(90)}\n1.4 Vermogen en energie\nuitleg\n1.5 Kosten van energie\nmeer`;
    const m = inkortMelding(tekst, 90)!;
    assert.match(m, /te lang \(\d+ tekens, maximaal 90\)/);
    assert.match(m, /1\.4 Vermogen en energie; 1\.5 Kosten van energie/);
  });
  it("zonder koppen: noemt waar het weglaten begint", () => {
    assert.match(inkortMelding("x".repeat(10) + " het slot van de tekst", 10)!, /vanaf "het slot van de tekst…"/);
  });
});
