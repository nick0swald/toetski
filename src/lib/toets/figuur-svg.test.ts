import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { grafiekSvg, schemaFiguurSvg } from "./figuur-svg.ts";

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

describe("schemaFiguurSvg", () => {
  it("tekent circuit/krachten/blokken", () => {
    for (const soort of ["circuit", "krachten", "blokken"] as const) {
      const svg = schemaFiguurSvg({ soort, titel: soort, labels: ["A", "B"] });
      assert.match(svg, /<svg/);
      assert.match(svg, new RegExp(soort));
    }
  });
});
