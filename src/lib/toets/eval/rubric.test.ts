import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { GegenereerdeToets } from "../types.ts";
import { parseRechter, poort, scoorToets } from "./rubric.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const lees = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const baseline = lees("scripts/eval/baselines/energie-geluid-gt4.8079c92.json") as GegenereerdeToets;
const kaseEG = lees("scripts/eval/inputs/energie-geluid-gt4.json");

describe("eval-rubriek (vaste baseline 8079c92, energie+geluid 4GT)", () => {
  const kaart = scoorToets(baseline, kaseEG.input);

  it("heeft 13 criteria en de harde criteria", () => {
    assert.equal(kaart.criteria.length, 13);
    assert.deepEqual(kaart.criteria.map((c) => c.punt), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    for (const id of ["H-g", "H-mc", "H-dekking", "H-figuur", "H-nakijk", "H-lengte", "H-school", "H-onbruikbaar"]) assert.ok(kaart.hard.some((h) => h.id === id), id);
  });

  it("ziet dat H11 (11.1, 11.3) niet getoetst is → harde dekking faalt", () => {
    const dek = kaart.hard.find((h) => h.id === "H-dekking")!;
    assert.equal(dek.ok, false);
    assert.match(dek.detail, /11\.1/);
    assert.match(dek.detail, /11\.3/);
    assert.equal(kaart.hardOk, false);
  });

  it("vindt weggevers, dubbele personen (ook aan zinsbegin) en het RTTI-gat", () => {
    assert.ok(kaart.criteria.find((c) => c.id === "weggevers")!.score < 0.5);
    const ctx = kaart.criteria.find((c) => c.id === "contexten")!;
    assert.match(ctx.detail, /Bram|Daan|Fenna/);
    assert.match(kaart.criteria.find((c) => c.id === "rtti")!.detail, /geen I-vraag/);
  });

  it("is deterministisch", () => {
    assert.deepEqual(scoorToets(baseline, kaseEG.input), kaart);
  });

  it("poort: rood bij harde fout, groen bij ≥ baseline met 100 % hard", () => {
    assert.equal(poort(kaart).ok, false);
    const perfect = { ...kaart, hardOk: true, hard: kaart.hard.map((h) => ({ ...h, ok: true })), cijfer: kaart.cijfer };
    assert.equal(poort(perfect, kaart).ok, true);
    assert.equal(poort({ ...perfect, cijfer: kaart.cijfer - 0.5 }, kaart).ok, false);
  });

  it("rechter-JSON wordt robuust geparsed en gemengd", () => {
    const o = parseRechter('```json\n{"punten":{"2":{"score":2,"toelichting":"ok"}},"cijfer":6,"topProblemen":["x"]}\n```');
    assert.ok(o);
    const k = scoorToets(baseline, kaseEG.input, o);
    assert.equal(k.criteria.find((c) => c.id === "weggevers")!.bron, "code+rechter");
  });
});
