import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyVoldoende,
  bevestigingsRegel,
  cesuurPunten,
  cesuurZin,
  cijferVanScore,
  cijferVanScoreRaw,
  curvePunten,
  DEFAULT_CIJFER,
  instructiesMetCesuur,
  nlCijfer,
  omzetTabel,
  roundCijfer,
} from "./cijfer.ts";

describe("lineair 1,0–10,0", () => {
  const n = DEFAULT_CIJFER;

  it("0 punten is 1,0 en maximum is 10,0", () => {
    assert.equal(cijferVanScore(0, 40, n), 1);
    assert.equal(cijferVanScore(40, 40, n), 10);
  });

  it("helft van de punten is 5,5", () => {
    assert.equal(cijferVanScore(20, 40, n), 5.5);
    assert.equal(cesuurPunten(40, n), 20);
  });

  it("27 punten: 5,5 bij 14/27, niet 15/27", () => {
    assert.equal(cesuurPunten(27, n), 14);
    assert.equal(cesuurZin(27, n), "Cesuur 5,5 bij 14/27 punten (lineair).");
    assert.notEqual(cesuurPunten(27, n), 15);
  });

  it("bevestigingsregel volgt het vaste format", () => {
    assert.equal(
      bevestigingsRegel({
        leerweg: "KB",
        leerjaar: 2,
        versie: "A",
        moeilijkheid: "normaal",
        duurMinuten: 50,
        aantalVragen: 10,
        doelPunten: 40,
        model: "lineair",
      }),
      "KB · leerjaar 2 · versie A · normaal · 50 min · 10 vragen · max 40 pt · norm lineair",
    );
  });

  it("instructies vervangen een tegenstrijdige 15/27", () => {
    const out = instructiesMetCesuur(
      ["Cesuur 5,5 bij 15/27 punten (lineair).", "Lees rustig."],
      27,
      n,
    );
    assert.equal(out[0], "Cesuur 5,5 bij 14/27 punten (lineair).");
    assert.deepEqual(out.slice(1), ["Lees rustig."]);
  });

  it("elk punt telt even zwaar", () => {
    const a = cijferVanScore(10, 40, n);
    const b = cijferVanScore(11, 40, n);
    const c = cijferVanScore(12, 40, n);
    assert.ok(Math.abs(b - a - (c - b)) < 0.05);
  });
});

describe("gebroken grafiek", () => {
  it("knik bij 5,5 op de gekozen cesuur", () => {
    const norm = { model: "gebroken" as const, cesuurPct: 40, exponent: 1 };
    assert.equal(cijferVanScore(0, 50, norm), 1);
    assert.equal(cijferVanScore(20, 50, norm), 5.5);
    assert.equal(cijferVanScore(50, 50, norm), 10);
    assert.equal(cesuurPunten(50, norm), 20);
  });

  it("makkelijker halen geeft 5,5 bij minder punten dan lineair", () => {
    const easy = applyVoldoende("gebroken", "makkelijker");
    const hard = applyVoldoende("gebroken", "moeilijker");
    assert.ok(cesuurPunten(40, easy) < 20);
    assert.ok(cesuurPunten(40, hard) > 20);
  });
});

describe("exponentieel", () => {
  it("k = 1 valt samen met lineair", () => {
    const exp = { model: "exponentieel" as const, cesuurPct: 55, exponent: 1 };
    assert.equal(cijferVanScore(20, 40, exp), cijferVanScore(20, 40, DEFAULT_CIJFER));
  });

  it("k < 1 maakt de voldoende makkelijker", () => {
    const easy = applyVoldoende("exponentieel", "makkelijker");
    assert.ok(cijferVanScore(20, 40, easy) > 5.5);
  });

  it("k > 1 maakt de voldoende moeilijker", () => {
    const hard = applyVoldoende("exponentieel", "moeilijker");
    assert.ok(cijferVanScore(20, 40, hard) < 5.5);
  });
});

describe("afronding en tabel", () => {
  it("rondt op één decimaal tussen 1,0 en 10,0", () => {
    assert.equal(roundCijfer(0), 1);
    assert.equal(roundCijfer(11), 10);
    assert.equal(nlCijfer(5.5), "5,5");
  });

  it("omzettingstabel loopt van 0 tot maximum", () => {
    const t = omzetTabel(10, DEFAULT_CIJFER);
    assert.equal(t[0]?.punten, 0);
    assert.equal(t[t.length - 1]?.punten, 10);
    assert.equal(t[0]?.cijfer, 1);
    assert.equal(t[t.length - 1]?.cijfer, 10);
  });
});

describe("grafiekpunten zonder zaagtand", () => {
  it("lineair heeft twee knikpunten", () => {
    const pts = curvePunten(40, DEFAULT_CIJFER);
    assert.equal(pts.length, 2);
    assert.equal(pts[0]?.cijfer, 1);
    assert.equal(pts[1]?.cijfer, 10);
  });

  it("gebroken heeft drie knikpunten met 5,5 in het midden", () => {
    const norm = { model: "gebroken" as const, cesuurPct: 40, exponent: 1 };
    const pts = curvePunten(50, norm);
    assert.equal(pts.length, 3);
    assert.equal(pts[1]?.cijfer, 5.5);
    assert.equal(pts[1]?.p, 20);
  });

  it("exponentieel gebruikt onafgeronde waarden, dus geen plateaus van 0,1", () => {
    const norm = { model: "exponentieel" as const, cesuurPct: 55, exponent: 0.7 };
    const pts = curvePunten(40, norm);
    assert.ok(pts.length > 10);
    let plateaus = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      assert.ok(b.cijfer >= a.cijfer - 1e-9);
      if (b.cijfer === a.cijfer) plateaus += 1;
    }
    assert.ok(plateaus < 3);
    const mid = pts[Math.floor(pts.length / 2)]!;
    assert.notEqual(mid.cijfer, roundCijfer(mid.cijfer));
  });

  it("raw wijkt af van afgerond op niet-mooie scores", () => {
    const raw = cijferVanScoreRaw(7, 40, DEFAULT_CIJFER);
    const rounded = cijferVanScore(7, 40, DEFAULT_CIJFER);
    assert.ok(Math.abs(raw - (1 + 9 * (7 / 40))) < 1e-12);
    assert.equal(rounded, roundCijfer(raw));
    assert.notEqual(raw, rounded);
  });
});
