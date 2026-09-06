import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { herkenBatch, herkenBron, isUrlRegel } from "./herken-bron.ts";

const leeg = { heeftLesstof: false, heeftAntwoorden: false };

describe("herkenBron", () => {
  it("herkent een url", () => {
    assert.equal(isUrlRegel("https://aeres.nl/lesstof"), true);
    assert.equal(herkenBron("", "https://aeres.nl/lesstof", leeg).rol, "url");
  });

  it("herkent antwoordenboek aan de bestandsnaam", () => {
    const r = herkenBron("antwoorden-kb-klas2.pdf", "1. glucose 2. zuurstof", leeg);
    assert.equal(r.rol, "antwoorden");
  });

  it("herkent leerlingboek aan de bestandsnaam", () => {
    const r = herkenBron("leerlingboek-biologie.pdf", "Fotosynthese is een proces.", leeg);
    assert.equal(r.rol, "lesstof");
  });

  it("herkent Word-notities aan de naam", () => {
    const r = herkenBron("notities-toets.docx", "Geen meerkeuze. Graag kortere stammen.", leeg);
    assert.equal(r.rol, "notities");
  });

  it("herkent korte aansturing in het tekstvak", () => {
    const r = herkenBron("", "Geen meerkeuze, maak 8 vragen, versie B.", {
      heeftLesstof: true,
      heeftAntwoorden: false,
    });
    assert.equal(r.rol, "notities");
  });

  it("zet een ingevuld werkboek op lesstof én antwoorden", () => {
    const tekst = `
      Leerdoelen 14.1.1 Je kunt uitleggen wat het moment van een kracht is.
      Paragraaf 1 Werken met hefbomen. Hoofdstuk 14 werktuigen. Leerstof.
      gegevens F = 8,0 kN  gevraagd M = ?
      uitwerking M = F · l = 8000 × 7,5 = 60 kNm
      gegevens F1 = 0,6 N gevraagd l2
      uitwerking 0,6 × 8 = 0,4 × l2
      uitwerking F2 = 24 N
    `;
    const batch = herkenBatch([{ naam: "toetski nask test.pdf", tekst }]);
    assert.equal(batch[0].rol, "lesstof");
    assert.equal(batch.some((b) => b.rol === "antwoorden"), true);
  });
});
