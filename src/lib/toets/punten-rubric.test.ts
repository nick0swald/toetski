import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { repareerPunten, rubricSomKlopt } from "./punten-rubric.ts";
import type { NakijkItem, Vraag } from "./types.ts";

function open(partial: Partial<Vraag> & { nummer: number; stam: string; punten: number }): Vraag {
  return {
    type: "open",
    rtti: "T1",
    domein: "x",
    leerdoel: "y",
    ...partial,
  };
}

describe("repareerPunten", () => {
  it("houdt bij een open vraag het lump-criterium en laat 0,5p vallen", () => {
    const vragen = [
      open({
        nummer: 21,
        punten: 2,
        stam: "Noem vier stofeigenschappen.",
      }),
    ];
    const nakijk: NakijkItem[] = [
      {
        nummer: 21,
        modelantwoord: "kleur, geur, kookpunt, dichtheid",
        puntenverdeling: [
          { punt: 0.5, criterium: "0,5p voor elke juiste eigenschap, max 2" },
          { punt: 2, criterium: "2p bij minstens vier juiste eigenschappen" },
        ],
      },
    ];
    const out = repareerPunten(vragen, nakijk);
    assert.equal(out.vragen[0]!.punten, 2);
    assert.equal(out.nakijkmodel[0]!.puntenverdeling.length, 1);
    assert.equal(out.nakijkmodel[0]!.puntenverdeling[0]!.punt, 2);
    assert.equal(rubricSomKlopt(out.vragen, out.nakijkmodel).ok, true);
  });

  it("maakt van 4×0,75p vier hele punten", () => {
    const vragen = [
      open({
        nummer: 25,
        type: "invul",
        punten: 3,
        stam: "Vul de tabel in.",
      }),
    ];
    const nakijk: NakijkItem[] = [
      {
        nummer: 25,
        modelantwoord: "vier begrippen",
        puntenverdeling: [
          { punt: 0.75, criterium: "oplosmiddel" },
          { punt: 0.75, criterium: "filter" },
          { punt: 0.75, criterium: "filtraat" },
          { punt: 0.75, criterium: "residu" },
        ],
      },
    ];
    const out = repareerPunten(vragen, nakijk);
    assert.equal(out.vragen[0]!.punten, 4);
    assert.deepEqual(
      out.nakijkmodel[0]!.puntenverdeling.map((p) => p.punt),
      [1, 1, 1, 1],
    );
    assert.equal(rubricSomKlopt(out.vragen, out.nakijkmodel).ok, true);
  });

  it("scoort een rekenvraag in drie stappen, niet 4p voor één deling", () => {
    const vragen = [
      open({
        nummer: 28,
        type: "berekening",
        rtti: "T2",
        punten: 4,
        stam: "Bereken de dichtheid.",
      }),
    ];
    const nakijk: NakijkItem[] = [
      {
        nummer: 28,
        modelantwoord: "87 / 30 = 2,9 g/cm³",
        puntenverdeling: [{ punt: 4, criterium: "juiste deling" }],
      },
    ];
    const out = repareerPunten(vragen, nakijk);
    assert.equal(out.vragen[0]!.punten, 3);
    assert.deepEqual(
      out.nakijkmodel[0]!.puntenverdeling.map((p) => p.criterium),
      ["juist omrekenen of aflezen van de benodigde waarde", "gebruik van de juiste formule (grootheden benoemd)", "rest van de berekening juist (uitkomst met eenheid)"],
    );
    assert.equal(
      out.nakijkmodel[0]!.puntenverdeling.reduce((s, p) => s + p.punt, 0),
      3,
    );
    assert.equal(rubricSomKlopt(out.vragen, out.nakijkmodel).ok, true);
  });

  it("rondt meerkeuzepunten af op hele punten", () => {
    const vragen: Vraag[] = [
      {
        nummer: 1,
        type: "meerkeuze",
        rtti: "R",
        domein: "x",
        leerdoel: "y",
        punten: 0.75,
        stam: "Kies.",
        opties: [
          { letter: "A", tekst: "a" },
          { letter: "B", tekst: "b" },
        ],
      },
    ];
    const nakijk: NakijkItem[] = [
      { nummer: 1, modelantwoord: "A", puntenverdeling: [{ punt: 0.75, criterium: "juist" }] },
    ];
    const out = repareerPunten(vragen, nakijk);
    assert.equal(out.vragen[0]!.punten, 1);
    assert.equal(Number.isInteger(out.vragen[0]!.punten), true);
  });
});
