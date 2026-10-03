import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { berekenStap0Voortgang, STAP0_TIJD, verwachteRondes, type Stap0Voortgang } from "./stap0-voortgang.ts";

const v = (fase: Stap0Voortgang["fase"], ronde = 0, open?: number): Stap0Voortgang => ({ fase, ronde, open, tekst: "…" });
const pct = (x: Stap0Voortgang, ms: number) => berekenStap0Voortgang(x, { faseStart: 0 }, ms).pct;

describe("wachtbalk stap 0", () => {
  it("vult per stap: eerste versie < rondes < inkorten < opslaan, en binnen een stap kruipt hij op zonder het deel te passeren", () => {
    assert.ok(pct(v("spec"), 0) === 0);
    assert.ok(pct(v("spec"), 60_000) > 20 && pct(v("spec"), 600_000) < 55);
    assert.ok(pct(v("herstel", 0, 4), 0) >= 55);
    assert.ok(pct(v("herstel", 1, 2), 0) > pct(v("herstel", 0, 4), 0));
    assert.ok(pct(v("herstel", 5, 1), 999_999) < 90);
    assert.ok(pct(v("afronden"), 0) >= 90 && pct(v("afronden"), 99_999) < 97);
    assert.ok(pct(v("opslaan"), 0) >= 97 && pct(v("opslaan"), 99_999) <= 100);
  });
  it("geschatte resttijd: eerste versie ± 3 min, daarna per open ronde; nooit negatief", () => {
    const r0 = berekenStap0Voortgang(v("spec"), { faseStart: 0 }, 0).restMs!;
    assert.ok(r0 > STAP0_TIJD.specMs && r0 < 4 * 60_000, String(r0));
    const r1 = berekenStap0Voortgang(v("herstel", 1, 9), { faseStart: 0 }, 0).restMs!;
    assert.ok(r1 >= 3 * STAP0_TIJD.rondeMs, String(r1));
    assert.ok(berekenStap0Voortgang(v("opslaan"), { faseStart: 0 }, 999_999).restMs! >= 0);
    assert.equal(verwachteRondes(0), 0);
    assert.equal(verwachteRondes(1), 1);
    assert.equal(verwachteRondes(9), 3);
  });
  it("labels per stap", () => {
    assert.equal(berekenStap0Voortgang(v("spec"), { faseStart: 0 }, 0).label, "Eerste versie schrijven");
    assert.match(berekenStap0Voortgang(v("herstel", 2), { faseStart: 0 }, 0).label, /ronde 3/);
    assert.equal(berekenStap0Voortgang(v("afronden"), { faseStart: 0 }, 0).label, "Inkorten en opmaken");
  });
});
