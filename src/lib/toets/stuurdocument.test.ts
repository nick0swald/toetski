import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STUUR_SECTIES,
  SYSTEM_PROMPT,
  bouwSystemPrompt,
  stuurdocumentTekst,
} from "./stuurdocument.ts";

describe("stuurdocument", () => {
  it("zit in de systeemprompt", () => {
    const tekst = stuurdocumentTekst();
    assert.match(tekst, /Lesstof is leidend/);
    assert.match(tekst, /cijfer = 1 \+ 9/);
    assert.match(tekst, /EERST situatieschets\/inleiding/);
    assert.match(SYSTEM_PROMPT, /JSON-object/);
    assert.match(SYSTEM_PROMPT, /wordt VOOR de stam getoond/);
    for (const s of STUUR_SECTIES) {
      assert.equal(SYSTEM_PROMPT.includes(s.titel), true, s.titel);
    }
  });

  it("override vervangt de regels maar houdt het JSON-schema", () => {
    const prompt = bouwSystemPrompt("Alleen meerkeuze. Geen open vragen.");
    assert.match(prompt, /Alleen meerkeuze/);
    assert.match(prompt, /JSON-object/);
    assert.equal(prompt.includes("NaSk en exacte vakken"), false);
  });

  it("constructeursleutel is versleuteld", async () => {
    const { CONSTRUCTOR_SLEUTEL_HASH, hashSleutel } = await import("./stuurdocument.ts");
    assert.equal(await hashSleutel("1137"), CONSTRUCTOR_SLEUTEL_HASH);
    assert.notEqual(await hashSleutel("0000"), CONSTRUCTOR_SLEUTEL_HASH);
  });
});