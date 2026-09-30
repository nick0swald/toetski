import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ghsPictogramSvg, grafiekSvg, maatcilinderSvg, schemaFiguurSvg } from "./figuur-svg.ts";
import { GHS_SYMBOLEN } from "./types.ts";

describe("grafiekSvg", () => {
  it("maakt B&W SVG met assen", () => {
    const svg = grafiekSvg({
      titel: "T tegen t",
      xLabel: "t (min)",
      yLabel: "T (°C)",
      punten: [
        { x: 0, y: 18 },
        { x: 10, y: 21 },
        { x: 20, y: 24 },
      ],
    });
    assert.match(svg, /<svg/);
    assert.match(svg, /T tegen t/);
    assert.match(svg, /stroke="#000000"/);
  });
});

describe("ghs en maatcilinder", () => {
  it("tekent elk GHS-symbool als ruit en elk veiligheidsbord in de juiste vorm/kleur", () => {
    for (const soort of GHS_SYMBOLEN) {
      const svg = ghsPictogramSvg(soort);
      assert.match(svg, /<svg/);
      if (soort.startsWith("gebod-")) assert.match(svg, /<circle cx="120" cy="120" r="108" fill="#005ca9"/, soort);
      else if (soort.startsWith("waarschuwing-")) assert.match(svg, /polygon points="120,20 226,210 14,210" fill="#f9c300"/, soort);
      else if (soort.startsWith("verbod-")) assert.match(svg, /stroke="#d2232a"/, soort);
      else assert.match(svg, /polygon points="110,14/, soort);
    }
  });

  it("gezondheidsgevaar: silhouet met ster op de borst (geen losse ster)", () => {
    const svg = ghsPictogramSvg("gezondheidsgevaar");
    assert.match(svg, /<circle cx="120" cy="74" r="19"/);
    assert.match(svg, /<polygon points="[^"]+" fill="#fff"\/>/);
  });

  it("zet mL-standen op de maatcilinder", () => {
    const svg = maatcilinderSvg({
      titel: "Maatcilinder",
      maxMl: 100,
      standen: [
        { label: "begin", ml: 34 },
        { label: "na onderdompelen", ml: 61 },
      ],
    });
    assert.match(svg, /begin/);
    assert.match(svg, /na onderdompelen/);
    assert.match(svg, /mL/);
  });
});

describe("schemaFiguurSvg", () => {
  it("tekent circuit/krachten/blokken", () => {
    for (const soort of ["circuit", "krachten", "blokken"] as const) {
      const svg = schemaFiguurSvg({ soort, titel: soort, labels: ["A", "B"] });
      assert.match(svg, /<svg/);
      assert.match(svg, new RegExp(soort));
    }
  });
});
