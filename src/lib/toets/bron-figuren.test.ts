import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectVakProfiel,
  extractBronFiguren,
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
    assert.equal(out[0]?.grafiek, undefined);
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

describe("suggestSchemaFiguur", () => {
  it("kiest circuit bij schakeling", () => {
    assert.equal(suggestSchemaFiguur("serieschakeling met lamp").soort, "circuit");
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
