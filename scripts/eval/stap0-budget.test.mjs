import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { gelogdeKosten, maakBewaker, projectie, realistisch, worstCase } from "./stap0-budget.mjs";

test("realistische schatting ligt bij de gemeten kosten, ver onder de worst case", () => {
  const r = realistisch(35_000, "vraagstuk"); // ≈ 10,6k tokens in
  assert.ok(r > 0.028 && r < 0.04, String(r));
  assert.ok(worstCase(35_000, 6000) > r * 1.4);
});

test("parallelle aanroepen: realistisch opgeteld, niet worst case (ronde-2-fout)", () => {
  const b = maakBewaker({ caseBudget: 0.4, plafond: 1.23, gelogd: () => 0.063 });
  let ok = 0;
  for (let i = 0; i < 4; i++) if (b.aanvraag({ soort: "vraagstuk", schatting: 0.035, worst: 0.058 })) ok++;
  assert.equal(ok, 4); // ronde 2 weigerde hier 2–3 van de 4
});

test("hard plafond tegen de werkelijk gelogde kosten (alle cases)", () => {
  let gelogd = 1.2;
  const b = maakBewaker({ caseBudget: 10, plafond: 1.23, gelogd: () => gelogd });
  assert.equal(b.aanvraag({ soort: "vraagstuk", schatting: 0.03, worst: 0.058 }), false);
  gelogd = 1.1;
  assert.equal(b.aanvraag({ soort: "vraagstuk", schatting: 0.03, worst: 0.058 }), true);
  b.klaar(0.03, 0.031);
  assert.equal(b.eigen, 0.031);
  assert.equal(b.lopend, 0);
});

test("rechter buiten het casebudget alleen tegen het plafond", () => {
  const b = maakBewaker({ caseBudget: 0.1, plafond: 1.23, gelogd: () => 0.5 });
  b.klaar(0, 0.1);
  assert.equal(b.aanvraag({ soort: "rechter", schatting: 0.02, worst: 0.05 }), false);
  assert.equal(b.aanvraag({ soort: "rechter", schatting: 0.02, worst: 0.05, binnenCase: false }), true);
});

test("gelogde kosten: alleen stap0-ronde na de start", () => {
  const d = mkdtempSync(join(tmpdir(), "kosten-"));
  const p = join(d, "k.jsonl");
  writeFileSync(p, [{ t: "2026-10-03T06:00:00Z", script: "stap0-ronde", usd: 1 }, { t: "2026-10-03T07:00:00Z", script: "stap0-ronde", usd: 0.25 }, { t: "2026-10-03T07:00:00Z", script: "eval", usd: 9 }].map((x) => JSON.stringify(x)).join("\n") + "\nkapot\n");
  assert.equal(gelogdeKosten(p, "2026-10-03T06:30:00Z"), 0.25);
  assert.equal(gelogdeKosten(join(d, "nee"), "x"), 0);
});

test("projectie: in prioriteitsvolgorde zolang het binnen het plafond past", () => {
  const p = projectie([{ case: "a", gericht: 10 }, { case: "b", gericht: 10 }, { case: "c", gericht: 10 }, { case: "d", gericht: 10 }], 1.23);
  assert.deepEqual(p.cases.map((c) => c.past), [true, true, true, false]);
});
