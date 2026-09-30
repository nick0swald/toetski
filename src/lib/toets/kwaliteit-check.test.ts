import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bouwKwaliteit } from "./kwaliteit-check.ts";
import type { NakijkItem, Vraag } from "./types.ts";

const BRON = `2.1 Stoffen herkennen
2.1.1 Je kunt vier stofeigenschappen noemen
2.3 Massa en volume
2.3.1 Je kunt de massa van een voorwerp meten
2.3.5 Je kunt volume via onderdompelen bepalen
`;

function q(partial: Partial<Vraag> & Pick<Vraag, "nummer" | "rtti" | "punten" | "stam">): Vraag {
  return {
    type: "open",
    domein: "x",
    leerdoel: "y",
    ...partial,
  };
}

describe("bouwKwaliteit", () => {
  const vragen: Vraag[] = [
    q({
      nummer: 1,
      rtti: "R",
      punten: 12,
      stam: "Noem vier stofeigenschappen van koper.",
    }),
    q({
      nummer: 2,
      rtti: "T1",
      punten: 22,
      stam: "Meet de massa van dit voorwerp.",
    }),
    q({
      nummer: 3,
      rtti: "T2",
      punten: 8,
      stam: "Bereken de dichtheid van het blok.",
      tabel: { koppen: ["Begrip", "Voorbeeld"], rijen: [["oplosmiddel", ""]] },
    }),
    q({
      nummer: 4,
      rtti: "I",
      punten: 4,
      type: "meerkeuze",
      stam: "Welke kleur heeft de stof?",
      opties: [
        { letter: "A", tekst: "rood" },
        { letter: "B", tekst: "blauw" },
        { letter: "C", tekst: "groen" },
        { letter: "D", tekst: "geel" },
      ],
    }),
  ];
  const nakijk: NakijkItem[] = [
    { nummer: 1, modelantwoord: "kleur, geur, kookpunt, dichtheid", puntenverdeling: [{ punt: 12, criterium: "vier eigenschappen" }] },
    { nummer: 2, modelantwoord: "aflezen van de weegschaal", puntenverdeling: [{ punt: 22, criterium: "juiste meting" }] },
    { nummer: 3, modelantwoord: "massa / volume", puntenverdeling: [{ punt: 8, criterium: "juiste berekening" }] },
    {
      nummer: 4,
      modelantwoord: "B. blauw",
      puntenverdeling: [{ punt: 4, criterium: "Juiste keuze B" }],
      nietToekennen: ["andere letters"],
    },
  ];

  const check = bouwKwaliteit({
    vragen,
    nakijkmodel: nakijk,
    bron: BRON,
    vak: "NaSk",
    rttiDoel: { R: 25, T1: 40, T2: 25, I: 10 },
    llm: {
      samenvatting:
        "Totaal 36 punten. De RTTI-verdeling is 35/42/18/5 procent. Figuren voldoet want er is een tabel. De toets dekt alle leerdoelen.",
      punten: [
        {
          criterium: "Taal",
          oordeel: "voldoet",
          toelichting: "De formulering is helder en past bij de leeftijd van de klas.",
        },
      ],
    },
  });

  it("rekent het puntentotaal uit de vragen, niet uit de LLM", () => {
    const punten = check.punten.find((p) => p.criterium === "Punten")!;
    assert.match(punten.toelichting, /Totaal 46 punten/);
    assert.equal(punten.oordeel, "voldoet");
    assert.match(check.samenvatting, /Totaal 46 punten/);
    assert.doesNotMatch(check.samenvatting, /36/);
  });

  it("zet RTTI-percentages uit de matrijs", () => {
    const rtti = check.punten.find((p) => p.criterium === "RTTI-balans")!;
    assert.match(rtti.toelichting, /R 26%/);
    assert.match(rtti.toelichting, /T1 48%/);
    assert.match(rtti.toelichting, /T2 17%/);
    assert.match(rtti.toelichting, /I 9%/);
    assert.doesNotMatch(rtti.toelichting, /(?<!\d)35%|(?<!\d)42%|(?<!\d)18%/);
    assert.doesNotMatch(check.samenvatting, /35\/42/);
  });

  it("telt een tabel niet als figuur", () => {
    const fig = check.punten.find((p) => p.criterium === "Figuren")!;
    assert.equal(fig.oordeel, "let op");
    assert.match(fig.toelichting, /tabel/i);
    assert.match(fig.toelichting, /niet/);
  });

  it("markeert een ontbrekend leerdoel", () => {
    const dek = check.punten.find((p) => p.criterium === "Leerdoeldekking")!;
    assert.equal(dek.oordeel, "let op");
    assert.match(dek.toelichting, /2\.3\.5/);
    assert.doesNotMatch(check.samenvatting, /dekt alle leerdoelen/i);
  });

  it("neemt geen modelclaims over in de feedback (alleen berekende controles)", () => {
    assert.doesNotMatch(check.samenvatting, /Opmerking/);
    assert.doesNotMatch(check.samenvatting, /voldoet/i);
    for (const p of check.punten) {
      if (p.oordeel === "voldoet") assert.doesNotMatch(p.toelichting, /36|tabel bij vraag/i);
    }
  });
});
