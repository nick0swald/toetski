import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lesstofVoorVragen } from "./lesstof-selectie.ts";
import { controlePrompt } from "./inhoud-controle.ts";
import { zetTekenvakken, tekentSchakeling } from "./tekenvak.ts";
import { veiligeNieuweStam } from "./figuren/spec.ts";
import type { Vraag } from "./types";

const vul = (s: string, n: number) => `${s} `.repeat(Math.ceil(n / (s.length + 1))).slice(0, n);
const lesstof = [
  "11.1 Fossiele brandstoffen", vul("centrale verbranding afvalwarmte", 15_000),
  "11.2 Zonne-energie", vul("zonnepaneel rendement", 15_000),
  "13.1 Geluid maken", vul("trilling bron tussenstof ontvanger", 15_000),
  "13.2 Toonhoogte", vul("frequentie hertz trillingstijd UNIEKTOONHOOGTE", 15_000),
].join("\n");

describe("lesstofVoorVragen (lange lesstof over meer hoofdstukken)", () => {
  it("korte lesstof blijft ongewijzigd", () => {
    assert.equal(lesstofVoorVragen("11.1 Kort\nabc", [], 20_000), "11.1 Kort\nabc");
  });
  it("neemt de paragraaf van de vraag mee, ook als die ver na de eerste 20k tekens staat", () => {
    const uit = lesstofVoorVragen(lesstof, [{ domein: "13.2 Toonhoogte", leerdoel: "frequentie berekenen" }], 20_000);
    assert.ok(uit.length <= 20_000);
    assert.match(uit, /UNIEKTOONHOOGTE/);
    for (const kop of ["11.1 Fossiele", "11.2 Zonne", "13.1 Geluid", "13.2 Toonhoogte"]) assert.ok(uit.includes(kop), kop);
  });
  it("zonder paragraafcode: overzicht van alle paragrafen in plaats van alleen het begin", () => {
    const uit = lesstofVoorVragen(lesstof, [{ domein: "Geluid", leerdoel: "" }], 20_000);
    assert.ok(uit.includes("13.2 Toonhoogte"));
  });
  it("controlePrompt gebruikt de selectie", () => {
    const q = { nummer: 1, type: "open", stam: "Bereken de frequentie.", punten: 2, domein: "13.2 Toonhoogte", leerdoel: "" } as unknown as Vraag;
    assert.match(controlePrompt([q], [], { lesstof }), /UNIEKTOONHOOGTE/);
  });
});

describe("tekenvak na herschrijven", () => {
  it("vraag die geen tekenopdracht meer is verliest het oude tekenvak", () => {
    const q = { nummer: 9, type: "open", stam: "Noem de energiesoort. Leg uit waarom.", punten: 2, tekenvak: { schaal: "1 cm ≙ 0,10 N" } } as unknown as Vraag;
    assert.equal(zetTekenvakken([q])[0]!.tekenvak, undefined);
  });
  it("tekenvraag houdt zijn tekenvak", () => {
    const q = { nummer: 3, type: "open", stam: "Teken de zwaartekracht op schaal.", punten: 2, tekenvak: { schaal: "1 cm ≙ 10 N" } } as unknown as Vraag;
    assert.ok(zetTekenvakken([q])[0]!.tekenvak);
  });
});

describe("figuurplanner", () => {
  it("'teken het schakelschema' krijgt geen kring-figuur", () => {
    assert.equal(tekentSchakeling({ stam: "Teken het schakelschema van deze schakeling." }), true);
    assert.equal(tekentSchakeling({ stam: "Bereken de stroomsterkte in de stroomkring." }), false);
  });
  it("nieuwe stam zonder herhaalde context", () => {
    const context = "Sanne heeft een zonnepaneel op het dak. Het paneel levert op een zonnige dag 288 W.";
    const oud = "Bereken het rendement van het zonnepaneel als er 1800 W zonlicht op valt.";
    const nieuw = `${context} In het staafdiagram zie je de vermogens. Bereken het rendement van het zonnepaneel als er 1800 W zonlicht op valt.`;
    const uit = veiligeNieuweStam(oud, nieuw, context)!;
    assert.ok(!uit.includes("Sanne heeft"));
    assert.match(uit, /staafdiagram/);
  });
  it("geen interne woorden als 'sfeerplaat' of 'de staafdiagram' in de stam", () => {
    const oud = "Bereken de afstand tussen Finn en de muur als de echo na 0,60 s terugkomt.";
    const uit = veiligeNieuweStam(oud, `In de sfeerplaat zie je Finn. In de staafdiagram staat niets. ${oud}`)!;
    assert.ok(!/sfeerplaat|de staafdiagram/i.test(uit), uit);
    assert.match(uit, /afbeelding/);
  });
});
