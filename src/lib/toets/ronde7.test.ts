import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { borgFiguurVerwijzingen, figuurVerwijzingenZonderFiguur } from "./context-regels.ts";
import { omrekenenNodig, repareerPunten } from "./punten-rubric.ts";
import { rttiVolgensRegels } from "./rtti-regels.ts";
import type { NakijkItem, Vraag } from "./types.ts";
import { herstelGroepen } from "./context-groepen.ts";
import { markeerExamenvragen } from "./examenvragen.ts";
import { herstelZinsbreuk } from "./eind-controle.ts";

const v = (nummer: number, x: Partial<Vraag>): Vraag => ({ nummer, type: "open", stam: "", punten: 1, rtti: "T1", ...x }) as Vraag;

describe("ronde 7", () => {
  it("aanduiden op een niet getekend voorwerp vraagt een figuur", () => {
    assert.ok(figuurVerwijzingenZonderFiguur(v(1, { stam: "Geef op je antwoordblad het draaipunt aan en teken de twee armen." })).length);
    assert.ok(figuurVerwijzingenZonderFiguur(v(2, { stam: "Geef op je antwoordblad het aangrijpingspunt van de zwaartekracht aan en teken de richting." })).length);
    // Zelfstandig tekenen van een pijl met schaal is wel te maken; een rekenvraag over de arm ook.
    assert.equal(figuurVerwijzingenZonderFiguur(v(3, { stam: "Teken de kracht van 35 N met een geschikte krachtenschaal. Geef de schaal aan." })).length, 0);
    assert.equal(figuurVerwijzingenZonderFiguur(v(4, { stam: "Bereken hoe groot de arm aan de kant van de kok moet zijn." })).length, 0);
  });

  it("omrekenpunt alleen als er iets om te rekenen is", () => {
    assert.equal(omrekenenNodig({ stam: "Een krat van 240 N, arm 0,15 m, kracht 80 N. Bereken de arm." }), false);
    assert.equal(omrekenenNodig({ stam: "De veer rekt 6,0 cm uit. Bereken de veerconstante in N/m." }), true);
    assert.equal(omrekenenNodig({ stam: "Hij hoort de echo na 0,3 s. Bereken de afstand tot de wand." }), true);
    const q = v(1, { type: "berekening", punten: 3, stam: "Een krat van 240 N, arm 0,15 m, kracht 80 N. Bereken de arm aan de kant van de kok." });
    const n: NakijkItem = { nummer: 1, modelantwoord: "0,45 m", puntenverdeling: [
      { punt: 1, criterium: "omrekenen of aflezen van waarden" },
      { punt: 1, criterium: "gebruik van de hefboomwet" },
      { punt: 1, criterium: "rest van de berekening juist" },
    ] } as NakijkItem;
    const uit = repareerPunten([q], [n]);
    assert.equal(uit.vragen[0]!.punten, 3);
    assert.ok(!uit.nakijkmodel[0]!.puntenverdeling!.some((c) => /omreken|aflez/i.test(c.criterium)));
  });

  it("keuzevraag met getallen is geen reproductie", () => {
    assert.equal(rttiVolgensRegels({ type: "meerkeuze", stam: "Lotte heeft een rugzak van 5 kg. Hoe groot is de zwaartekracht?", punten: 1, vraagtype: "K-SOORT" }).rtti, "T1");
  });

  it("verwijzing weghalen die de introductie meeneemt → vraag eruit", () => {
    const q1 = v(1, { stam: "Emma ziet dit pictogram op een pot met schoonmaakmiddel. Noteer wat ze moet doen voordat Emma de pot opent." });
    const q2 = v(2, { stam: "Kijk naar de grafiek hieronder. Een auto rijdt 20 m/s. Hoe ver komt de auto in 5 s?" });
    const n: NakijkItem[] = [{ nummer: 1, modelantwoord: "bril op", puntenverdeling: [{ punt: 1, criterium: "bril" }] } as NakijkItem, { nummer: 2, modelantwoord: "100 m", puntenverdeling: [{ punt: 1, criterium: "100 m" }] } as NakijkItem];
    const uit = borgFiguurVerwijzingen([q1, q2], n);
    assert.deepEqual(uit.verwijderd, [1]);
    assert.equal(uit.vragen.length, 1);
    assert.match(uit.vragen[0]!.stam, /^Een auto rijdt/);
  });

  it("ronde 8: herhaalde situatiezinnen uit de stam, nep-examentitel neutraal, getal zonder rekenwerk", () => {
    const [a, b] = herstelGroepen([
      v(1, { contextTitel: "Oude radio", context: "Luuk repareert een oude radio.", stam: "Luuk ziet dat een toon 440 trillingen per seconde maakt. Bereken de trillingstijd." }),
      v(2, { contextTitel: "Oude radio", stam: "Luuk ziet dat een toon 440 trillingen per seconde maakt. Leg uit of dit een hoge toon is." }),
    ]);
    assert.match(a!.stam, /^Luuk ziet/);
    assert.equal(b!.stam, "Leg uit of dit een hoge toon is.");
    const [c] = markeerExamenvragen([v(1, { contextTitel: "Examenvragen", stam: "Bij een fabriek meet een technicus 110 dB." })], []);
    assert.equal(c!.contextTitel, "Situatie");
    assert.equal(c!.bronvermelding, undefined);
    assert.equal(rttiVolgensRegels({ type: "meerkeuze", stam: "Bram meet 92 dB bij een motor. Wat is juist over de amplitude?", opties: [{ letter: "A", tekst: "groot" }, { letter: "B", tekst: "klein" }], punten: 1, vraagtype: "G-DB" }).rtti, "T1");
  });

  it("ronde 8: zinsbreuk context/stam en vraag zonder opdracht", () => {
    const q = herstelZinsbreuk({ context: "Bram luistert naar muziek.", stam: "op zijn telefoon. Noem twee geluidsbronnen." });
    assert.equal(q.context, "Bram luistert naar muziek op zijn telefoon.");
    assert.equal(q.stam, "Noem twee geluidsbronnen.");
    const n: NakijkItem[] = [1, 2].map((nummer) => ({ nummer, modelantwoord: "x", puntenverdeling: [{ punt: 1, criterium: "x" }] }) as NakijkItem);
    const uit = borgFiguurVerwijzingen([v(1, { stam: "Emma ziet een fles met een gevarensymbool van een doodshoofd." }), v(2, { stam: "Noteer wat giftig betekent." })], n);
    assert.deepEqual(uit.verwijderd, [1]);
  });
});
