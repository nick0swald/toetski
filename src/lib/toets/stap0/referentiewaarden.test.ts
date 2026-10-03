import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRond, referentieRegel, rondeGetallenMelding } from "./referentiewaarden.ts";

const p = (waarde: number, naam = `p${waarde}`) => ({ naam, waarde, bron: "tekst" as const });

describe("referentiewaarden (stap c5)", () => {
  it("alleen de waarden die bij de lesstof horen, in de prompt", () => {
    const r = referentieRegel("Energie: kosten met de prijs per kWh. Netspanning 230 V.", 4);
    assert.match(r, /€ 0,26 per kWh/);
    assert.match(r, /230 V/);
    assert.doesNotMatch(r, /lichtsnelheid/);
    assert.match(r, /niet steeds ronde getallen/);
    assert.doesNotMatch(referentieRegel("kWh", 2), /ronde getallen/);
    assert.equal(referentieRegel("Het oog en de lens", 4), "");
  });
  it("ronde getallen: alleen een melding (klas ≥ 3, ≥ 4 gegevens, ≥ 60 % rond), referentiewaarden tellen niet", () => {
    assert.ok(isRond(2000) && isRond(0.5) && isRond(3) && !isRond(1840) && !isRond(2.4));
    const rond = [{ parameters: [p(2000), p(500), p(3), p(0.5), p(230), p(0.26)] }];
    assert.match(rondeGetallenMelding(rond, 4) ?? "", /4 van de 4 gegevens/);
    assert.equal(rondeGetallenMelding(rond, 2), null);
    assert.equal(rondeGetallenMelding([{ parameters: [p(1840), p(2.4), p(0.36), p(500)] }], 4), null);
  });
});
