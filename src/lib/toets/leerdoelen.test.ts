import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractLeerdoelen, groepeerDomeinen, normaliseerSpelling, ongedekteLeerdoelen } from "./leerdoelen.ts";
import type { Vraag } from "./types.ts";

const BRON = `2.1 Stoffen herkennen
2.1.1 Je kunt stoffen herkennen aan hun eigenschappen
PLUS
2.1.4 Je kunt gevarensymbolen herkennen
2.2 Mengsels
2.2.2 Je kunt een oplossing en een suspensie onderscheiden
2.3 Massa en volume
2.3.1 Je kunt de massa van een voorwerp meten
2.3.5 Je kunt het volume via onderdompelen bepalen
2.4 Dichtheid
2.4.1 Je kunt uitleggen wat dichtheid is
`;

function q(domein: string, stam: string, nummer = 1): Vraag {
  return {
    nummer,
    type: "open",
    rtti: "R",
    domein,
    leerdoel: domein,
    punten: 1,
    stam,
  };
}

describe("leerdoelen", () => {
  it("corrigeert Stoffeigenschappen", () => {
    assert.equal(normaliseerSpelling("Stoffeigenschappen"), "Stofeigenschappen");
    assert.equal(normaliseerSpelling("stoffeigenschap"), "stofeigenschap");
  });

  it("leest paragrafen en PLUS", () => {
    const doelen = extractLeerdoelen(BRON);
    const plus = doelen.find((d) => d.code === "2.1.4");
    assert.equal(plus?.plus, true);
    assert.equal(plus?.paragraafTitel, "2.1 Stoffen herkennen");
    assert.equal(doelen.find((d) => d.code === "2.4.1")?.paragraafTitel, "2.4 Dichtheid");
  });

  it("groepeert rijen op paragraaf en markeert PLUS", () => {
    const out = groepeerDomeinen(
      [
        q("Stoffeigenschappen", "Je kunt stoffen herkennen aan hun eigenschappen.", 1),
        q("Gevarensymbolen", "Je kunt gevarensymbolen herkennen.", 2),
        q("Dichtheid berekenen", "Je kunt uitleggen wat dichtheid is.", 3),
        q("Volume berekenen", "Je kunt de massa van een voorwerp meten.", 4),
      ],
      BRON,
    );
    assert.equal(out[0]!.domein, "2.1 Stoffen herkennen");
    assert.equal(out[1]!.domein, "2.1 Stoffen herkennen · PLUS");
    assert.match(out[1]!.leerdoel, /^PLUS/);
    assert.equal(out[2]!.domein, "2.4 Dichtheid");
    assert.equal(out[3]!.domein, "2.3 Massa en volume");
  });

  it("vouwt losse rekenrijen samen als de lesstof geen nummers heeft", () => {
    const out = groepeerDomeinen(
      [
        q("Stoffeigenschappen", "kleur", 1),
        q("Dichtheid", "wat is dichtheid", 2),
        q("Dichtheid berekenen", "bereken", 3),
        q("Massa en volume", "meten", 4),
        q("Volume berekenen", "l keer b", 5),
      ],
      "Alleen een lap tekst zonder genummerde doelen.",
    );
    assert.equal(out[0]!.domein, "Stofeigenschappen");
    assert.equal(out[2]!.domein, "Dichtheid");
    assert.equal(out[4]!.domein, "Massa en volume");
  });

  it("ziet 2.3.5 als niet gedekt", () => {
    const vragen = [q("2.1", "Je kunt stoffen herkennen aan hun eigenschappen.", 1)];
    const mis = ongedekteLeerdoelen(BRON, vragen).map((d) => d.code);
    assert.ok(mis.includes("2.3.5"));
  });
});
