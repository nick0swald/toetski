/**
 * CI-wacht tegen Grok.com-exports die modellen/timeouts terugzetten (eerder gebeurd met callGrok).
 * Faalt deze test na een export: zet de waarden terug in config.ts, niet de test aanpassen zonder reden.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { LIMIETEN, MODELLEN, PLAN, RTTI_EXAMEN, TIJD, UX_TIJD, isHandmatigRtti, metRttiDoel, rttiDoelVoor, tokensVoorAantalVragen } from "./config.ts";
import { afwerkBudget } from "./voortgang.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const SRC = join(ROOT, "src");

function bestanden(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "node_modules" ? [] : bestanden(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) && !n.endsWith("assets.generated.ts") ? [p] : [];
  });
}

describe("config: modellen (Nick, 1 okt 2026)", () => {
  it("schrijven, repareren en controleren op grok-4.5", () => {
    assert.equal(MODELLEN.schrijven, "grok-4.5");
    assert.equal(MODELLEN.repareren, "grok-4.5");
    assert.equal(MODELLEN.controle, "grok-4.5");
    assert.equal(MODELLEN.visie, "grok-4.5");
    assert.equal(MODELLEN.plannen, "grok-4.5");
  });

  it("plan-first: bouwplan past ruim binnen de schrijfdeadline", () => {
    assert.ok(PLAN.timeoutMs <= TIJD.vragenDeadlineMs - 60_000, "na het plan moet er ≥ 60 s over zijn om te schrijven");
    assert.ok(PLAN.stukGrootte >= 3 && PLAN.stukGrootte <= 8);
  });

  it("geen hardgecodeerde modelnamen buiten config.ts", () => {
    const fout: string[] = [];
    for (const f of bestanden(SRC)) {
      if (f.endsWith(join("toets", "config.ts"))) continue;
      const s = readFileSync(f, "utf8");
      for (const m of s.matchAll(/["'`](grok-(?:\d|imagine)[\w.-]*)["'`]/g)) fout.push(`${f.replace(ROOT, "")}: ${m[1]}`);
    }
    assert.deepEqual(fout, []);
  });

  it("alleen llm.ts en de beeldclient praten met de xAI-API", () => {
    const toegestaan = [join("toets", "llm.ts"), join("figuren", "xai.server.ts"), join("toets", "config.ts")];
    const fout = bestanden(SRC).filter((f) => /chat\/completions|api\.x\.ai/.test(readFileSync(f, "utf8")) && !toegestaan.some((t) => f.endsWith(t)));
    assert.deepEqual(fout.map((f) => f.replace(ROOT, "")), []);
  });

  it("generate.ts heeft geen eigen callGrok/timeout meer (overschrijfrisico)", () => {
    const s = readFileSync(join(SRC, "lib", "toets", "generate.ts"), "utf8");
    assert.doesNotMatch(s, /async function callGrok|async function callControle|max_tokens|reasoning_effort/);
    assert.doesNotMatch(s, /export const generateToets\b/);
  });
});

describe("config: tijdmodel (server-side)", () => {
  it("Vercel maxDuration in vite.config.ts is gelijk aan TIJD.vercelMaxMs", () => {
    const vite = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
    const m = vite.match(/maxDuration:\s*(\d+)/);
    assert.ok(m, "maxDuration ontbreekt in vite.config.ts");
    assert.equal(Number(m![1]) * 1000, TIJD.vercelMaxMs);
  });

  it("afwerken garandeert controle + minstens één reparatieronde binnen de Vercel-limiet", () => {
    assert.ok(TIJD.afwerkBudgetMs - TIJD.controleTimeoutMs >= TIJD.reparatieMinRestMs, "na de langste controle moet ronde 1 nog starten");
    assert.ok(TIJD.afwerkBudgetMs + 6_000 + 20_000 <= TIJD.vercelMaxMs, "budget + uitloop + marge past in maxDuration");
    assert.ok(TIJD.vragenDeadlineMs + 20_000 <= TIJD.vercelMaxMs);
    assert.ok(TIJD.controleTimeoutMs >= 45_000, "controle (grok-4.5) duurt gemeten 22–77 s per toets; per stukje ≥ 45 s");
  });

  it("afwerkbudget krimpt niet meer na trage vragen (r236-oorzaak)", () => {
    assert.equal(afwerkBudget(0), TIJD.afwerkBudgetMs);
    assert.equal(afwerkBudget(64_000), TIJD.afwerkBudgetMs);
    assert.equal(afwerkBudget(120_000), TIJD.afwerkBudgetMs);
  });

  it("UX-maximum laat ruimte voor beide stappen", () => {
    assert.ok(UX_TIJD.maxTotaalMs >= TIJD.vragenDeadlineMs + TIJD.afwerkBudgetMs);
  });

  it("tokens voor grok-4.5 bevatten redeneermarge", () => {
    assert.equal(tokensVoorAantalVragen(24), 3000 + 24 * 450 + LIMIETEN.redeneerMarge);
    assert.equal(tokensVoorAantalVragen(80), LIMIETEN.tokensMax + LIMIETEN.redeneerMarge);
  });
});

describe("config: RTTI-doel uit één bron", () => {
  it("klas 1–2 / 3 / 4", () => {
    assert.deepEqual(rttiDoelVoor(1), { R: 35, T1: 40, T2: 20, I: 5 });
    assert.deepEqual(rttiDoelVoor(2), { R: 35, T1: 40, T2: 20, I: 5 });
    assert.deepEqual(rttiDoelVoor(3), { R: 25, T1: 40, T2: 27, I: 8 });
    assert.deepEqual(rttiDoelVoor(4), { R: 15, T1: 45, T2: 34, I: 6 });
    for (const j of [1, 2, 3, 4]) {
      const d = rttiDoelVoor(j);
      assert.equal(d.R + d.T1 + d.T2 + d.I, 100);
    }
  });

  it("leerlijn: R daalt en T2 stijgt richting het GT-examen", () => {
    const [k12, k3, k4, cse] = [rttiDoelVoor(2), rttiDoelVoor(3), rttiDoelVoor(4), RTTI_EXAMEN.GT];
    assert.ok(k12.R > k3.R && k3.R > k4.R && k4.R > cse.R);
    assert.ok(k12.T2 < k3.T2 && k3.T2 < k4.T2 && k4.T2 < cse.T2);
  });

  it("server negeert een meegestuurd doel tenzij de docent zelf schoof", () => {
    const oud = { rttiDoel: { R: 10, T1: 50, T2: 30, I: 10 }, leerjaar: 3, moeilijkheid: "normaal" };
    assert.deepEqual(metRttiDoel(oud).rttiDoel, { R: 25, T1: 40, T2: 27, I: 8 });
    assert.deepEqual(metRttiDoel({ ...oud, rttiHandmatig: true }).rttiDoel, oud.rttiDoel);
    assert.equal(isHandmatigRtti({ R: 25, T1: 40, T2: 27, I: 8 }, 3), false);
    assert.equal(isHandmatigRtti({ R: 10, T1: 50, T2: 30, I: 10 }, 3), true);
  });

  it("geen losse RTTI-percentages buiten config.ts", () => {
    const fout = bestanden(SRC).filter((f) => !f.endsWith(join("toets", "config.ts")) && /R:\s*(35|25|15),\s*T1:\s*(40|45)/.test(readFileSync(f, "utf8")));
    assert.deepEqual(fout.map((f) => f.replace(ROOT, "")), []);
  });
});
