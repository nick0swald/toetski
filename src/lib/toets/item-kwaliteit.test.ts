import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { repareerItemsDeterministisch } from "./item-kwaliteit.ts";
import type { NakijkItem, Vraag } from "./types.ts";

function mc(partial: Partial<Vraag> & { nummer: number; stam: string; opties: Vraag["opties"] }): Vraag {
  return {
    type: "meerkeuze",
    rtti: "R",
    domein: "Stoffen",
    leerdoel: "y",
    punten: 1,
    ...partial,
  };
}

function nakijk(nummer: number, modelantwoord: string): NakijkItem {
  return { nummer, modelantwoord, puntenverdeling: [{ punt: 1, criterium: "juist" }] };
}

const BOEK = "Voorbeeld: de dichtheid is 1,2 g/cm³. Aluminium heeft een dichtheid van 2,7 g/cm³.";

describe("repareerItemsDeterministisch", () => {
  it("beloont geen vlam bij een onbekende vloeistof", () => {
    const vragen = [
      mc({
        nummer: 5,
        stam: "Wat is de veiligste manier om te zien of een onbekende vloeistof brandbaar is?",
        opties: [
          { letter: "A", tekst: "het etiket lezen" },
          { letter: "B", tekst: "eraan ruiken" },
          { letter: "C", tekst: "proeven" },
          { letter: "D", tekst: "een beetje bij een vlam houden" },
        ],
      }),
    ];
    const out = repareerItemsDeterministisch(vragen, [nakijk(5, "D. een beetje bij een vlam houden")], "");
    assert.match(out.nakijkmodel[0]!.modelantwoord, /^A\./);
    assert.match(out.nakijkmodel[0]!.modelantwoord, /etiket|gevarensymbool/i);
    assert.equal(out.issues.some((i) => i.code === "onveilig"), false);
  });

  it("haalt een dubbele hiërarchie uit de opties", () => {
    const vragen = [
      mc({
        nummer: 9,
        stam: "Wat is dit sap?",
        opties: [
          { letter: "A", tekst: "een suspensie" },
          { letter: "B", tekst: "een mengsel" },
          { letter: "C", tekst: "een element" },
          { letter: "D", tekst: "een verbinding" },
        ],
      }),
    ];
    const out = repareerItemsDeterministisch(vragen, [nakijk(9, "A. een suspensie")], "");
    const teksten = out.vragen[0]!.opties!.map((o) => o.tekst.toLowerCase());
    const heeftKind = teksten.some((t) => /suspensie|oplossing|emulsie/.test(t));
    const heeftOuder = teksten.some((t) => t.includes("mengsel"));
    assert.equal(heeftKind && heeftOuder, false);
  });

  it("vervangt een afleider die de stam al uitsluit", () => {
    const vragen = [
      mc({
        nummer: 12,
        stam: "Welke vloeistof gebruik je in plaats van water?",
        opties: [
          { letter: "A", tekst: "alcohol" },
          { letter: "B", tekst: "water" },
          { letter: "C", tekst: "olie" },
          { letter: "D", tekst: "azijn" },
        ],
      }),
    ];
    const out = repareerItemsDeterministisch(vragen, [nakijk(12, "A. alcohol")], "");
    assert.equal(
      out.vragen[0]!.opties!.some((o) => o.tekst.toLowerCase().trim() === "water"),
      false,
    );
  });

  it("haalt de weegschaal uit een stam die het instrument vraagt", () => {
    const vragen = [
      mc({
        nummer: 13,
        stam: "Een leerling weegt een steen op een weegschaal. Welk instrument meet de massa?",
        opties: [
          { letter: "A", tekst: "weegschaal" },
          { letter: "B", tekst: "liniaal" },
          { letter: "C", tekst: "thermometer" },
          { letter: "D", tekst: "maatbeker" },
        ],
      }),
    ];
    const out = repareerItemsDeterministisch(vragen, [nakijk(13, "A. weegschaal")], "");
    assert.equal(out.vragen[0]!.stam, "Welk instrument meet de massa van een voorwerp?");
    assert.doesNotMatch(out.vragen[0]!.stam, /weegschaal/i);
  });

  it("vraagt kenmerken van een suspensie zonder het antwoord al te geven", () => {
    const vragen: Vraag[] = [
      {
        nummer: 24,
        type: "open",
        rtti: "T1",
        domein: "Mengsels",
        leerdoel: "suspensie",
        punten: 2,
        stam: "Je ziet een troebele vloeistof. Noem twee kenmerken van deze suspensie.",
      },
    ];
    const out = repareerItemsDeterministisch(
      vragen,
      [{ nummer: 24, modelantwoord: "troebel en de deeltjes zakken", puntenverdeling: [{ punt: 2, criterium: "twee kenmerken" }] }],
      "",
    );
    assert.equal(out.vragen[0]!.stam, "Noem twee kenmerken van een suspensie.");
    assert.doesNotMatch(out.vragen[0]!.stam, /troebel/i);
  });

  it("wijkt af van boekuitkomsten en vraagt geen afronding bij een exacte uitkomst", () => {
    const vragen: Vraag[] = [
      {
        nummer: 19,
        type: "berekening",
        rtti: "T2",
        domein: "Dichtheid",
        leerdoel: "berekenen",
        punten: 3,
        stam: "De massa is 24 g en het volume is 20 cm³. Bereken de dichtheid. Rond af op één decimaal.",
      },
    ];
    const out = repareerItemsDeterministisch(
      vragen,
      [{ nummer: 19, modelantwoord: "24 / 20 = 1,2 g/cm³", puntenverdeling: [{ punt: 3, criterium: "deling" }] }],
      BOEK,
    );
    assert.match(out.vragen[0]!.stam, /30 g/);
    assert.doesNotMatch(out.vragen[0]!.stam, /rond af/i);
    assert.match(out.nakijkmodel[0]!.modelantwoord, /1,5/);
    assert.doesNotMatch(out.nakijkmodel[0]!.modelantwoord, /1,2/);
  });

  it("schaalt 2,7 g/cm³ weg van het aluminiumvoorbeeld", () => {
    const vragen: Vraag[] = [
      {
        nummer: 28,
        type: "berekening",
        rtti: "T2",
        domein: "Dichtheid",
        leerdoel: "berekenen",
        punten: 3,
        stam: "Een blok heeft een massa van 81 g en een volume van 30 cm³. Bereken de dichtheid.",
      },
    ];
    const out = repareerItemsDeterministisch(
      vragen,
      [{ nummer: 28, modelantwoord: "2,7 g/cm³", puntenverdeling: [{ punt: 3, criterium: "deling" }] }],
      BOEK,
    );
    assert.doesNotMatch(out.nakijkmodel[0]!.modelantwoord, /2,7/);
    assert.match(out.vragen[0]!.stam, /87 g/);
  });

  it("schrijft genderneutraal en zonder 'volgens de lesstof'", () => {
    const vragen: Vraag[] = [
      {
        nummer: 2,
        type: "open",
        rtti: "R",
        domein: "x",
        leerdoel: "y",
        punten: 1,
        stam: "Wat doet de leerling voordat hij de fles opent, volgens de lesstof?",
      },
    ];
    const out = repareerItemsDeterministisch(
      vragen,
      [{ nummer: 2, modelantwoord: "etiket lezen", puntenverdeling: [{ punt: 1, criterium: "juist" }] }],
      "",
    );
    assert.doesNotMatch(out.vragen[0]!.stam, /volgens de lesstof/i);
    assert.doesNotMatch(out.vragen[0]!.stam, /\bhij\b/i);
    assert.match(out.vragen[0]!.stam, /de leerling/);
  });

  it("vervangt een overlappende meerkeuzevraag", () => {
    const vragen: Vraag[] = [
      mc({
        nummer: 16,
        stam: "Welke methode is de onderdompelmethode?",
        opties: [
          { letter: "A", tekst: "water verplaatsen" },
          { letter: "B", tekst: "liniaal" },
          { letter: "C", tekst: "weegschaal" },
          { letter: "D", tekst: "thermometer" },
        ],
      }),
      {
        nummer: 27,
        type: "berekening",
        rtti: "T2",
        domein: "Volume",
        leerdoel: "onderdompelen",
        punten: 3,
        stam: "Bereken het volume met de onderdompelmethode.",
      },
    ];
    const out = repareerItemsDeterministisch(
      vragen,
      [
        nakijk(16, "A. water verplaatsen"),
        { nummer: 27, modelantwoord: "eindstand min beginstand", puntenverdeling: [{ punt: 3, criterium: "verschil" }] },
      ],
      "",
    );
    assert.doesNotMatch(out.vragen[0]!.stam, /onderdompel/i);
    assert.match(out.vragen[1]!.stam, /onderdompel/i);
    assert.equal(out.issues.some((i) => i.code === "lek-tussen-vragen"), false);
  });
});
