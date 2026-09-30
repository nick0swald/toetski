import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFiguurSpec } from "./figuren/spec.ts";
import { bevriesGoedgekeurd, bewaakFiguren, figuurIsGeldig } from "./figuren/bevriezing.ts";
import { verwijderFiguur } from "./figuren/verwijder.ts";
import type { GegenereerdeToets, Vraag } from "./types.ts";

const spec = parseFiguurSpec({
  soort: "lijngrafiek",
  titel: "Afkoelen",
  doel: "aflezen",
  nietTonen: [],
  data: { xLabel: "tijd", xEenheid: "min", yLabel: "temperatuur", yEenheid: "°C", reeksen: [{ punten: [{ x: 0, y: 80 }, { x: 10, y: 50 }] }] },
}).spec!;
const fig = bevriesGoedgekeurd({ id: "f1", soort: "lijngrafiek", bron: "code", mime: "image/png", data: "iVBORw0KGgo=", breedte: 480, hoogte: 320, alt: "Lijngrafiek", spec, pogingen: 1, keuring: { besluit: "go", redenen: ["ok"], model: "t", tijdstip: "2026-09-30T10:00:00.000Z" } });
const q = (nummer: number, extra: Partial<Vraag> = {}): Vraag => ({ nummer, type: "open", rtti: "T1", domein: "Warmte", leerdoel: "x", punten: 2, stam: "Lees in de grafiek af hoe warm de thee na 10 minuten is.", ...extra });
const toets = (): GegenereerdeToets =>
  ({
    id: "t",
    vragen: [q(1, { figuur: fig }), q(2, { stam: "Andere vraag." })],
    nakijkmodel: [],
    figuurPijplijn: 1,
    figuurRapport: { versie: 1, items: [{ nummer: 1, soort: "lijngrafiek", bron: "code", status: "go", pogingen: 1, redenen: ["ok"], figuurId: "f1" }], meldingen: [] },
  }) as unknown as GegenereerdeToets;

describe("figuur verwijderen door de docent", () => {
  it("verwijdert alleen die figuur; vraag blijft bruikbaar (tabel) en rapport vermeldt het", () => {
    const t = verwijderFiguur(toets(), 1, new Date("2026-09-30T12:00:00Z"));
    assert.equal(t.vragen[0]!.figuur, undefined);
    assert.equal(t.vragen[0]!.figuurVerwijderd, "f1");
    assert.ok(t.vragen[0]!.tabel, "grafiekdata als tabel");
    assert.match(t.vragen[0]!.stam, /tabel/);
    assert.equal(t.figuurRapport!.items[0]!.docentVerwijderd, "2026-09-30T12:00:00.000Z");
    assert.ok(figuurIsGeldig(fig), "de figuur zelf is niet gewijzigd");
  });
  it("bewaakFiguren zet een door de docent verwijderde figuur nooit terug", () => {
    const oud = toets();
    const nieuw = verwijderFiguur(oud, 1);
    const r = bewaakFiguren(oud.vragen, nieuw.vragen, { pijplijn: true });
    assert.equal(r.vragen[0]!.figuur, undefined);
    assert.deepEqual(r.hersteld, []);
    // ook niet via een latere stap die het id terugzet
    const r2 = bewaakFiguren(oud.vragen, [{ ...nieuw.vragen[0]!, figuurId: "f1" }, nieuw.vragen[1]!]);
    assert.equal(r2.vragen[0]!.figuur, undefined);
  });
  it("gewone bewaking blijft werken: wijzigen wordt hersteld", () => {
    const oud = toets();
    const r = bewaakFiguren(oud.vragen, [{ ...oud.vragen[0]!, figuur: { ...fig, data: "AAAA" } }, oud.vragen[1]!]);
    assert.equal(r.vragen[0]!.figuur!.data, fig.data);
  });
});
