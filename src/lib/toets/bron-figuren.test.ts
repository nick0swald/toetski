import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectVakProfiel,
  extractBronFiguren,
  plaatsMaatcilinders,
  plaatsPictogrammen,
  suggestSchemaFiguur,
  verzekerBronFiguren,
} from "./bron-figuren.ts";
import type { Vraag } from "./types.ts";

const LESSTOF = `Lesstof klas 2 KB NaSk — Temperatuur

tijdstip t (min) | temperatuur T (°C)
0 | 18,0
10 | 21,5
20 | 24,0
30 | 25,5
40 | 26,0

De grafiek van T tegen t vlakt af.
`;

describe("extractBronFiguren", () => {
  it("leest een pijptabel én maakt een grafiek", () => {
    const fig = extractBronFiguren(LESSTOF);
    assert.ok(fig?.tabel);
    assert.deepEqual(fig.tabel?.koppen, ["tijdstip t (min)", "temperatuur T (°C)"]);
    assert.equal(fig.tabel?.rijen.length, 5);
    assert.equal(fig.tabel?.rijen[0]?.[1], "18,0");
    assert.ok(fig.grafiek);
    assert.equal(fig.grafiek?.punten.length, 5);
    assert.equal(fig.grafiek?.punten[0]?.x, 0);
    assert.equal(fig.grafiek?.punten[0]?.y, 18);
    assert.equal(fig.grafiek?.punten[4]?.y, 26);
  });

  it("negeert lesstof zonder pijptabel", () => {
    assert.equal(extractBronFiguren("Alleen tekst over fotosynthese."), null);
  });
});

describe("verzekerBronFiguren", () => {
  const kaal: Vraag[] = [
    {
      nummer: 1,
      type: "open",
      rtti: "T1",
      domein: "Meten",
      leerdoel: "De leerling leest een tabel af.",
      punten: 2,
      stam: "Lees T af bij t = 20 min.",
    },
  ];

  it("plakt tabel en grafiek als de AI ze weglaat", () => {
    const out = verzekerBronFiguren(kaal, LESSTOF, "nask");
    assert.ok(out[0]?.tabel);
    assert.ok(out[0]?.grafiek);
    assert.equal(out[0]?.tabel?.rijen.length, 5);
  });

  it("raakt bestaande figuren niet aan", () => {
    const met: Vraag[] = [
      {
        ...kaal[0]!,
        tabel: { koppen: ["x"], rijen: [["1"]] },
      },
    ];
    const out = verzekerBronFiguren(met, LESSTOF, "nask");
    assert.deepEqual(out[0]?.tabel?.koppen, ["x"]);
    assert.ok(out[0]?.grafiek, "een tabel telt niet als figuur; de brongrafiek komt erbij");
    assert.equal(out[0]?.grafiek?.punten.length, 5);
  });

  it("doet niets bij generiek profiel", () => {
    const out = verzekerBronFiguren(kaal, LESSTOF, "generiek");
    assert.equal(out[0]?.tabel, undefined);
  });

  it("plakt schema bij ruime NaSk-stof over schakelingen zonder pijptabel", () => {
    const bron = `Hoofdstuk 5 Elektriciteit\n${"De stroomkring en de schakeling. ".repeat(40)}`;
    const out = verzekerBronFiguren(kaal, bron, "nask");
    assert.ok(out[0]?.schemaFiguur);
    assert.equal(out[0]?.schemaFiguur?.soort, "circuit");
  });
});

describe("pictogram en maatcilinder", () => {
  it("zet een GHS-pictogram en schrapt de beschrijving uit de stam", () => {
    const vragen: Vraag[] = [
      {
        nummer: 4,
        type: "meerkeuze",
        rtti: "R",
        domein: "Stoffen",
        leerdoel: "gevarensymbool",
        punten: 1,
        stam: "Wat betekent het rode pictogram met vlammen op de fles?",
        opties: [
          { letter: "A", tekst: "ontvlambaar" },
          { letter: "B", tekst: "giftig" },
          { letter: "C", tekst: "bijtend" },
          { letter: "D", tekst: "milieu" },
        ],
      },
    ];
    const out = plaatsPictogrammen(vragen, [
      { nummer: 4, modelantwoord: "A. ontvlambaar", puntenverdeling: [{ punt: 1, criterium: "juist" }] },
    ]);
    assert.equal(out[0]?.pictogram, "ontvlambaar");
    assert.doesNotMatch(out[0]!.stam, /vlammen|rood pictogram/i);
    assert.match(out[0]!.stam, /gevarensymbool/i);
  });

  it("zet een doodshoofd als giftig pictogram", () => {
    const vragen: Vraag[] = [
      {
        nummer: 8,
        type: "open",
        rtti: "R",
        domein: "Stoffen",
        leerdoel: "gevarensymbool",
        punten: 1,
        stam: "Wat betekent het doodshoofd-pictogram?",
      },
    ];
    const out = plaatsPictogrammen(vragen);
    assert.equal(out[0]?.pictogram, "giftig");
    assert.doesNotMatch(out[0]!.stam, /doodshoofd/i);
  });

  it("laat de standen van de maatcilinder in de figuur staan, niet in de stam", () => {
    const vragen: Vraag[] = [
      {
        nummer: 16,
        type: "berekening",
        rtti: "T2",
        domein: "Volume",
        leerdoel: "onderdompelmethode",
        punten: 3,
        stam: "De beginstand is 34 mL. Na het onderdompelen is de stand 61 mL. Bereken het volume.",
      },
    ];
    const out = plaatsMaatcilinders(vragen);
    assert.equal(out[0]?.maatcilinder?.standen[0]?.ml, 34);
    assert.equal(out[0]?.maatcilinder?.standen[1]?.ml, 61);
    assert.doesNotMatch(out[0]!.stam, /34|61/);
    assert.match(out[0]!.stam, /maatcilinder/i);
  });
});

describe("suggestSchemaFiguur", () => {
  it("kiest circuit bij schakeling", () => {
    assert.equal(suggestSchemaFiguur("serieschakeling met lamp")?.soort, "circuit");
  });
});

describe("detectVakProfiel", () => {
  it("herkent NaSk", () => {
    assert.equal(detectVakProfiel("NaSk", ""), "nask");
    assert.equal(detectVakProfiel("Natuurkunde", "schakeling"), "nask");
  });
  it("herkent biologie", () => {
    assert.equal(detectVakProfiel("Biologie", ""), "biologie");
  });
  it("valt terug op generiek", () => {
    assert.equal(detectVakProfiel("Nederlands", ""), "generiek");
  });
});
