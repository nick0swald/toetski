import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bouwDekkingHint, extractOnderwerpen } from "./dekking.ts";
import type { Vraag } from "./types.ts";

const BRON = `# Temperatuur en warmte

Leerdoel: De leerling leest een temperatuurgrafiek af.
Leerdoel: De leerling legt warmtetransport uit (geleiding, stroming, straling).
Paragraaf 3: Faseovergangen

Extra tekst over een kas in Friesland.
`;

function v(partial: Partial<Vraag> & Pick<Vraag, "nummer" | "stam">): Vraag {
  return {
    type: "meerkeuze",
    rtti: "R",
    domein: "Temperatuur",
    leerdoel: "",
    punten: 1,
    ...partial,
  };
}

describe("extractOnderwerpen", () => {
  it("vindt leerdoelen en paragrafen", () => {
    const topics = extractOnderwerpen(BRON);
    assert.ok(topics.some((t) => /temperatuurgrafiek/i.test(t)));
    assert.ok(topics.some((t) => /warmtetransport|Faseovergangen/i.test(t)));
  });
});

describe("bouwDekkingHint", () => {
  it("markeert dunne plekken", () => {
    const vragen: Vraag[] = [
      v({
        nummer: 1,
        leerdoel: "Temperatuurgrafiek aflezen",
        stam: "Lees T af bij t = 20.",
        domein: "Temperatuur",
      }),
    ];
    const hint = bouwDekkingHint(BRON, vragen);
    assert.ok(hint);
    assert.ok(hint!.gedekt.length >= 1);
    assert.ok(hint!.dun.some((d) => /warmte|fase/i.test(d)));
  });

  it("geeft null bij te weinig signalen", () => {
    assert.equal(bouwDekkingHint("kort", []), null);
  });
});
