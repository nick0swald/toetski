import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maakBouwplan, type Bouwplan } from "./bouwplan.ts";
import { PLAN } from "./config.ts";
import type { PlanQuota } from "./bouwplan.ts";

// Geschaalde klok: 1 "seconde" = 10 ms. Planbudget = rest − schrijfReserve.
const S = 10;
const quota = { aantal: 10, punten: 20, paragrafen: [], vorm: {}, rttiPunten: { R: 5, T1: 5, T2: 5, I: 5 }, reserve: 3 } as unknown as PlanQuota;
const plan = (n: number): Bouwplan => ({ versie: 1, items: Array.from({ length: n }, (_, i) => ({ n: i + 1 }) as never), reserve: [] });
const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tijden = { tweedePogingNaMs: 40 * S, snelNaMs: 60 * S, minGrokMs: 20 * S, minSnelMs: 10 * S };

function opzet(budgetS: number, gedrag: Record<string, Array<{ naS: number; ok: boolean; n?: number }>>) {
  const t0 = Date.now();
  const rest = () => PLAN.schrijfReserveMs + budgetS * S - (Date.now() - t0);
  const aanroepen: string[] = [];
  const teller: Record<string, number> = {};
  const roep = async (rol: "plannen" | "snel", timeout: () => number) => {
    const i = (teller[rol] = (teller[rol] ?? 0) + 1) - 1;
    aanroepen.push(rol);
    const g = gedrag[rol]![i] ?? { naS: 999, ok: false };
    const max = timeout();
    if (g.naS * S > max) {
      await wacht(Math.max(0, max));
      throw new Error("The operation was aborted due to timeout");
    }
    await wacht(g.naS * S);
    if (!g.ok) throw new Error("kapotte JSON");
    return plan(g.n ?? 5);
  };
  return { run: () => maakBouwplan({ system: "", voorvoegsel: "", quota, rest, roep, tijden }), aanroepen, t0 };
}

describe("bouwplan: robuust tegen trage plan-aanroep", () => {
  it("snel antwoord: één grok-4.5-aanroep, geen extra", async () => {
    const o = opzet(90, { plannen: [{ naS: 25, ok: true }], snel: [] });
    const p = await o.run();
    assert.equal(p.route, "plan-model");
    assert.deepEqual(o.aanroepen, ["plannen"]);
  });

  it("trage eerste (70 s): mag doorlopen voorbij de oude 55 s; snel-reserve start maar telt niet", async () => {
    const o = opzet(90, { plannen: [{ naS: 70, ok: true }, { naS: 80, ok: false }], snel: [{ naS: 5, ok: true, n: 4 }] });
    const p = await o.run();
    assert.equal(p.route, "plan-model");
    assert.equal(p.items.length, 5);
    assert.deepEqual(o.aanroepen, ["plannen", "plannen", "snel"]);
  });

  it("eerste hangt, tweede poging (zelfde model) wint", async () => {
    const o = opzet(90, { plannen: [{ naS: 200, ok: true }, { naS: 20, ok: true, n: 6 }], snel: [] });
    const p = await o.run();
    assert.equal(p.route, "plan-model (2e poging)");
    assert.equal(p.items.length, 6);
  });

  it("eerste faalt snel (JSON): meteen tweede grok-4.5-poging, niet het snelle model", async () => {
    const o = opzet(90, { plannen: [{ naS: 3, ok: false }, { naS: 25, ok: true }], snel: [] });
    const p = await o.run();
    assert.equal(p.route, "plan-model (2e poging)");
    assert.deepEqual(o.aanroepen, ["plannen", "plannen"]);
  });

  it("beide grok-4.5 time-out: plan van het snelle model (geen oude route)", async () => {
    const o = opzet(90, { plannen: [{ naS: 200, ok: true }, { naS: 200, ok: true }], snel: [{ naS: 10, ok: true, n: 4 }] });
    const p = await o.run();
    assert.equal(p.route, "snel model");
    assert.ok(Date.now() - o.t0 <= 95 * S, "binnen het planbudget");
  });

  it("alles faalt: gooit (dan pas oude route), binnen het planbudget", async () => {
    const o = opzet(90, { plannen: [{ naS: 200, ok: true }, { naS: 200, ok: true }], snel: [{ naS: 200, ok: true }] });
    await assert.rejects(o.run(), /timeout/);
    assert.ok(Date.now() - o.t0 <= 100 * S);
  });

  it("geen tijd meer: geen aanroep", async () => {
    const o = opzet(5, { plannen: [], snel: [] });
    await assert.rejects(o.run());
    assert.deepEqual(o.aanroepen, []);
  });
});
