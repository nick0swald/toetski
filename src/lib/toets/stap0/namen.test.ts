import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nietWesterseNamen, vervangNamen } from "./namen.ts";
import { WESTERSE_NAMEN, MEISJES, JONGENS } from "./namen-data.ts";
import { autoHerstel } from "./auto-herstel.ts";

const vraagstuk = () => ({
  id: "v1",
  soort: "vraagstuk" as const,
  titel: "Lampjes aan de muur",
  se: "SE4.3" as const,
  hoofdstuk: "Elektriciteit",
  context: ["Fatima en Youssef bouwen een schakeling met twee lampjes. Jamal en Aisha kijken toe.", "Youssef's lampje brandt feller. Fatima meet de stroom; zij gebruikt een stroommeter."],
  deelvragen: [
    {
      id: "v1a",
      stam: "Bereken de weerstand van het lampje van Youssef.",
      antwoordmodel: { regels: ["Youssef: R = U / I = 6 / 0,5 = 12 Ω"] },
      scorestappen: [{ omschrijving: "Fatima's meting juist gebruikt", punten: 1 }],
    },
  ],
});

describe("namen: alleen westerse/Nederlandse voornamen (stille auto-fix)", () => {
  it("namenlijst is groot genoeg en uniek", () => {
    assert.ok(WESTERSE_NAMEN.length >= 300, String(WESTERSE_NAMEN.length));
    assert.equal(new Set(MEISJES).size, MEISJES.length);
    assert.equal(new Set(JONGENS).size, JONGENS.length);
  });
  it("Fatima en Youssef worden consequent vervangen, ook in antwoordmodel en scorestappen", () => {
    const { v, vervangen } = vervangNamen(vraagstuk());
    const map = Object.fromEntries(vervangen);
    assert.ok(map.Fatima && map.Youssef && map.Fatima !== map.Youssef);
    assert.ok((MEISJES as readonly string[]).includes(map.Fatima), "meisjesnaam voor Fatima");
    assert.ok((JONGENS as readonly string[]).includes(map.Youssef), "jongensnaam voor Youssef");
    const s = JSON.stringify(v);
    assert.ok(!/Fatima|Youssef|Jamal|Aisha/.test(s), s);
    assert.ok(v.deelvragen[0]!.antwoordmodel.regels[0]!.startsWith(`${map.Youssef}:`));
    assert.ok(v.context[1]!.startsWith(`${map.Youssef}'s`));
    assert.equal(v.deelvragen[0]!.scorestappen[0]!.omschrijving, `${map.Fatima}'s meting juist gebruikt`);
    assert.deepEqual(vervangNamen(vraagstuk()).vervangen, vervangen, "deterministisch");
  });
  it("westerse namen, plaatsnamen, vaktermen en zinsbeginwoorden blijven staan", () => {
    assert.deepEqual(nietWesterseNamen(["Sanne en Daan meten de spanning in Utrecht.", "Water kookt bij 100 °C. Het water verdampt.", "Bereken de stroom. Gebruik Binas.", "De lamp brandt.", "Lotte's fiets heeft een dynamo."]), []);
  });
  it("onbekende naam op een naamplek wordt herkend (bezit, werkwoord, 'en …')", () => {
    assert.deepEqual(nietWesterseNamen(["Daarna sluit Kwabena de schakelaar."]).sort(), []);
    assert.deepEqual(nietWesterseNamen(["Sanne en Oluwaseun bouwen een kring."]), ["Oluwaseun"]);
    assert.deepEqual(nietWesterseNamen(["Het lampje van Sanne is fel. Tunde meet de stroom."]), ["Tunde"]);
  });
  it("auto-herstel vervangt stil (geen keuring, geen aanroep) en vermijdt namen uit andere vraagstukken", () => {
    const ander = { ...vraagstuk(), id: "v2", context: ["Emma fietst naar huis."], deelvragen: [] };
    const r = autoHerstel({ vraagstukken: [vraagstuk() as never, ander as never] });
    const s = JSON.stringify(r.gen.vraagstukken[0]);
    assert.ok(!/Fatima|Youssef/.test(s));
    assert.ok(!/\bEmma\b/.test(s), "Emma staat al in een ander vraagstuk");
    assert.ok(r.stappen.some((x) => x.wat.startsWith("namen vervangen")));
  });
});
