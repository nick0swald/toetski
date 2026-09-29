import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blokkenVoorVraag, heeftEchtFiguur } from "./blad-volgorde.ts";
import type { Vraag } from "./types.ts";

describe("blokkenVoorVraag", () => {
  it("zet een invultabel ná de stam en zonder antwoordlijnen", () => {
    const q: Vraag = {
      nummer: 25,
      type: "invul",
      rtti: "T1",
      domein: "Mengsels",
      leerdoel: "filtreren",
      punten: 4,
      context: "Je hebt thee gezet.",
      stam: "Geef bij elk begrip een voorbeeld bij thee.",
      tabel: {
        koppen: ["Begrip", "Voorbeeld bij thee"],
        rijen: [
          ["oplosmiddel", ""],
          ["filter", ""],
          ["filtraat", ""],
          ["residu", ""],
        ],
      },
    };
    assert.deepEqual(blokkenVoorVraag(q), ["context", "stam", "tabel"]);
    assert.equal(heeftEchtFiguur(q), false);
  });

  it("zet een pictogram vóór de stam", () => {
    const q: Vraag = {
      nummer: 4,
      type: "meerkeuze",
      rtti: "R",
      domein: "2.1 Stoffen herkennen · PLUS",
      leerdoel: "PLUS · 2.1.4 gevarensymbolen",
      punten: 1,
      stam: "Wat betekent dit gevarensymbool?",
      pictogram: "ontvlambaar",
      opties: [
        { letter: "A", tekst: "ontvlambaar" },
        { letter: "B", tekst: "giftig" },
      ],
    };
    assert.deepEqual(blokkenVoorVraag(q), ["stimulus", "stam", "opties"]);
    assert.equal(heeftEchtFiguur(q), true);
  });

  it("houdt antwoordlijnen bij een open vraag zonder tabel", () => {
    const q: Vraag = {
      nummer: 3,
      type: "open",
      rtti: "T1",
      domein: "x",
      leerdoel: "y",
      punten: 2,
      stam: "Leg uit.",
    };
    assert.deepEqual(blokkenVoorVraag(q), ["stam", "antwoordlijnen"]);
  });
});
