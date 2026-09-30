import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { controleerStroomkringSymbolen, symboolLijstVoorKeuring, symboolSoort, verwachteSymbolen } from "./figuren/schakelsymbolen.ts";
import { parseFiguurSpec } from "./figuren/spec.ts";
import { tekenCodeFiguur } from "./figuren/svg.ts";
import { maakFiguurMetKeuring } from "./figuren/pijplijn.ts";
import { KEURING_CHECKS } from "./figuren/keuring.ts";
import type { FiguurSpec } from "./types.ts";

const kring = (data: Record<string, unknown>): FiguurSpec => {
  const r = parseFiguurSpec({ soort: "stroomkring", data });
  assert.ok(r.spec, r.fout);
  return r.spec!;
};

const ALLE = [
  "lampje",
  "schakelaar-open",
  "schakelaar-dicht",
  "weerstand",
  "variabele weerstand",
  "LDR",
  "NTC",
  "ampèremeter",
  "motor",
  "led",
  "diode",
  "zoemer",
  "zekering",
];

describe("symboolSoort", () => {
  it("herkent de standaardonderdelen", () => {
    assert.equal(symboolSoort("schakelaar"), "schakelaar-open");
    assert.equal(symboolSoort("schakelaar-dicht"), "schakelaar-dicht");
    assert.equal(symboolSoort("gesloten schakelaar"), "schakelaar-dicht");
    assert.equal(symboolSoort("lampje"), "lamp");
    assert.equal(symboolSoort("ampèremeter"), "ampèremeter");
    assert.equal(symboolSoort("stroommeter"), "ampèremeter");
    assert.equal(symboolSoort("spanningsmeter"), "voltmeter");
    assert.equal(symboolSoort("LED-lampje"), "led");
    assert.equal(symboolSoort("NTC-weerstand"), "ntc");
    assert.equal(symboolSoort("schuifweerstand"), "variabele-weerstand");
    assert.equal(symboolSoort("fluxcondensator"), "onbekend");
  });
});

describe("stroomkring-renderer: standaardsymbolen", () => {
  it("elk ondersteund onderdeel wordt met zijn eigen symbool getekend (serie)", () => {
    for (let i = 0; i < ALLE.length; i += 6) {
      const spec = kring({ schakeling: "serie", bron: { soort: "batterij", label: "6 V" }, componenten: ALLE.slice(i, i + 6).map((soort) => ({ soort })) });
      const svg = tekenCodeFiguur(spec).svg;
      assert.deepEqual(controleerStroomkringSymbolen(spec, svg), [], ALLE.slice(i, i + 6).join(","));
    }
  });

  it("parallel met schakelaars in hoofdstroom en tak, spanningsmeter over de bron", () => {
    const spec = kring({
      schakeling: "parallel",
      bron: { soort: "spanningsbron", label: "12 V" },
      componenten: [{ soort: "schakelaar-dicht" }, { soort: "ampèremeter" }],
      takken: [[{ soort: "lampje" }], [{ soort: "lampje" }, { soort: "schakelaar-open" }]],
      voltmeters: [{ over: "bron" }],
    });
    const svg = tekenCodeFiguur(spec).svg;
    assert.deepEqual(controleerStroomkringSymbolen(spec, svg), []);
    assert.equal(verwachteSymbolen(spec).length, 7);
  });

  it("open schakelaar: hendel schuin omhoog, raakt het tweede contact niet; gesloten: rechte lijn", () => {
    const open = tekenCodeFiguur(kring({ componenten: [{ soort: "schakelaar-open" }] })).svg;
    const dicht = tekenCodeFiguur(kring({ componenten: [{ soort: "schakelaar-dicht" }] })).svg;
    const hendel = (svg: string) => {
      const m = svg.match(/<line data-hendel="1" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/)!;
      return m.slice(1).map(Number) as [number, number, number, number];
    };
    const [ox1, oy1, ox2, oy2] = hendel(open);
    assert.ok(oy2 < oy1 - 10 && ox2 > ox1, "open: omhoog richting het andere contact");
    const [, dy1, , dy2] = hendel(dicht);
    assert.equal(dy1, dy2, "dicht: horizontaal");
    assert.equal((open.match(/data-contact="1"/g) ?? []).length, 2);
  });
});

describe("controleerStroomkringSymbolen", () => {
  const spec = kring({ schakeling: "serie", componenten: [{ soort: "schakelaar-dicht" }, { soort: "lampje" }] });

  it("schakelaar als losse stippen (zonder hendel) = no_go", () => {
    const goed = tekenCodeFiguur(spec).svg;
    const kaal = goed.replace(/<line data-hendel="1"[^>]*\/>/, "");
    const f = controleerStroomkringSymbolen(spec, kaal);
    assert.ok(f.some((x) => /losse stippen zonder hendel/.test(x)), f.join("; "));
  });

  it("oude weergave (twee stippen, geen schakelaarsymbool) = no_go", () => {
    const oud =
      '<svg><g data-symbool="batterij"><line data-plaat="1"/><line data-plaat="1"/></g><g data-symbool="lamp"><circle cx="1" cy="1" r="14"/><line/><line/><line/><line/></g>' +
      '<circle data-contact="1" cx="266" cy="84" r="3"/><circle data-contact="1" cx="294" cy="84" r="3"/></svg>';
    const f = controleerStroomkringSymbolen(spec, oud);
    assert.ok(f.some((x) => /ontbreekt/.test(x)));
    assert.ok(f.some((x) => /losse contactpunten/.test(x)));
  });

  it("open getekend terwijl de spec dicht zegt = no_go", () => {
    const openSvg = tekenCodeFiguur(kring({ schakeling: "serie", componenten: [{ soort: "schakelaar-open" }, { soort: "lampje" }] })).svg;
    assert.ok(controleerStroomkringSymbolen(spec, openSvg).length > 0);
  });

  it("ontbrekend of extra onderdeel = no_go", () => {
    const zonderLamp = tekenCodeFiguur(kring({ schakeling: "serie", componenten: [{ soort: "schakelaar-dicht" }, { soort: "weerstand" }] })).svg;
    const f = controleerStroomkringSymbolen(spec, zonderLamp);
    assert.ok(f.some((x) => /lampje ontbreekt/.test(x)));
    assert.ok(f.some((x) => /extra symbool.*weerstand/.test(x)));
  });

  it("onbekend onderdeel krijgt geen nep-symbool maar een no_go", () => {
    const s = kring({ componenten: [{ soort: "fluxcondensator" }] });
    const f = controleerStroomkringSymbolen(s, tekenCodeFiguur(s).svg);
    assert.ok(f.some((x) => /geen standaardsymbool/.test(x)));
  });

  it("de vision-prompt krijgt de lijst verwachte symbolen", () => {
    const t = symboolLijstVoorKeuring(spec);
    assert.match(t, /gesloten schakelaar/);
    assert.match(t, /cirkel met een kruis/);
  });
});

describe("pijplijn: symboolcheck vóór de vision-keuring", () => {
  it("onbekend onderdeel → no_go zonder vision-go te kunnen halen", async () => {
    let keur = 0;
    const alleGo = { besluit: "go", checks: Object.fromEntries(KEURING_CHECKS.map((k) => [k, true])), redenen: [] };
    let t = 0;
    const u = await maakFiguurMetKeuring(
      {
        vraag: { nummer: 1, type: "open", rtti: "T1", domein: "Elektriciteit", leerdoel: "schakelingen", punten: 1, stam: "Wat gebeurt er?" },
        spec: kring({ componenten: [{ soort: "fluxcondensator" }] }),
        legacy: false,
        verwijst: false,
      },
      {
        tekenPng: async () => new Uint8Array([1]),
        genereerBeeld: async () => ({ bytes: new Uint8Array(), mime: "image/jpeg" }),
        verkleinJpeg: (b) => ({ bytes: b, breedte: 1, hoogte: 1 }),
        keur: async () => {
          keur++;
          return alleGo;
        },
        vraagJson: async () => ({}),
        nu: () => (t += 10),
        nieuwId: () => "x",
      },
    );
    assert.equal(u.status, "gedropt");
    assert.equal(keur, 0, "vision-go kan de code-check niet overrulen");
    if (u.status === "gedropt") assert.ok(u.redenen.some((r) => /standaardsymbool/.test(r)));
  });
});

describe("planner zet de batterij ook als onderdeel", () => {
  it("bron-onderdeel wordt verwijderd; code-check slaagt; spanningsmeter schuift mee", () => {
    const r = parseFiguurSpec({
      soort: "stroomkring",
      doel: "x",
      data: { schakeling: "serie", bron: { soort: "batterij", label: "6 V" }, componenten: [{ soort: "batterij" }, { soort: "lampje" }, { soort: "schakelaar-dicht" }], voltmeters: [{ over: 1 }] },
    });
    assert.ok(r.spec, r.fout);
    const d = r.spec!.data as { componenten: { soort: string }[]; voltmeters: { over: unknown }[] };
    assert.deepEqual(d.componenten.map((c) => c.soort), ["lampje", "schakelaar-dicht"]);
    assert.deepEqual(d.voltmeters.map((v) => v.over), [0]);
    const g = tekenCodeFiguur(r.spec!);
    assert.deepEqual(controleerStroomkringSymbolen(r.spec!, g.svg), []);
  });
  it("bron als tekst of onbekende soort wordt genormaliseerd", () => {
    for (const bron of ["batterij", { soort: "accu", label: "12 V" }, { soort: "voeding" }]) {
      const r = parseFiguurSpec({ soort: "stroomkring", doel: "x", data: { bron, componenten: [{ soort: "lampje" }] } });
      assert.ok(r.spec, `${JSON.stringify(bron)}: ${r.fout}`);
      assert.deepEqual(controleerStroomkringSymbolen(r.spec!, tekenCodeFiguur(r.spec!).svg), []);
    }
  });
});
