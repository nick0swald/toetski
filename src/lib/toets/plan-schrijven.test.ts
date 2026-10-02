import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Bouwplan, PlanItem, PlanQuota } from "./bouwplan.ts";
import { ontdubbelNamen, planStukken, schrijfOpdracht, voegStukkenSamen } from "./plan-schrijven.ts";

const it_ = (n: number, o: Partial<PlanItem> = {}): PlanItem => ({ n, par: "1.1", vorm: "kort", rtti: "T1", punten: 2, begrip: `b${n}`, context: `situatie ${n}`, kern: `k${n}`, antwoord: `a${n}`, ...o });
const q: PlanQuota = { aantal: 12, punten: 20, paragrafen: [{ code: "1.1", titel: "Krachten", aantal: 12 }], rttiPunten: { R: 4, T1: 8, T2: 6, I: 2 }, vorm: { jn: 0, mc: 4, kort: 8, invul: 0, uitleg: 0, reken: 0, teken: 0 }, reserve: 0 };

describe("plan-schrijven", () => {
  it("stukken ~gelijk, aaneengesloten, groep blijft heel", () => {
    const items = Array.from({ length: 12 }, (_, i) => it_(i + 1, i >= 4 && i <= 6 ? { groep: "Bakfiets" } : {}));
    const st = planStukken(items, 5);
    assert.equal(st.length, 3);
    assert.deepEqual(st.flat().map((x) => x.n), items.map((x) => x.n));
    const metGroep = st.filter((s) => s.some((x) => x.groep === "Bakfiets"));
    assert.equal(metGroep.length, 1, "groep in één stuk");
    assert.ok(st.every((s) => s.length >= 3 && s.length <= 6), st.map((s) => s.length).join(","));
  });

  it("opdracht bevat het hele plan en alleen de eigen vragen als opdracht", () => {
    const plan: Bouwplan = { versie: 1, items: Array.from({ length: 6 }, (_, i) => it_(i + 1)), reserve: [] };
    const o = schrijfOpdracht(plan, plan.items.slice(3), q);
    for (let n = 1; n <= 6; n++) assert.match(o, new RegExp(`^${n}\\. \\[1\\.1\\]`, "m"));
    assert.match(o, /ALLEEN de vragen 4 t\/m 6/);
    assert.match(o, /vraag 4: type "open", rtti "T1", punten 2, domein "1\.1 Krachten"/);
    assert.match(o, /geen weggevers/);
  });

  it("samenvoegen: planvolgorde, doornummeren, domein/groep uit het plan, mislukt stuk overgeslagen", () => {
    const st = [[it_(1), it_(2)], [it_(3, { groep: "G" }), it_(4, { groep: "G" })], [it_(5)]];
    const p = (nrs: number[]) => ({ meta: {}, vragen: nrs.map((n) => ({ nummer: n, domein: "x" } as { nummer: number; domein: string; contextTitel?: string })), nakijkmodel: nrs.map((n) => ({ nummer: n, modelantwoord: `m${n}` })) });
    const uit = voegStukkenSamen([p([1, 2]), null, p([5])], st, q);
    assert.deepEqual(uit.vragen.map((v) => v.nummer), [1, 2, 3]);
    assert.equal(uit.vragen[0]!.domein, "1.1 Krachten");
    assert.deepEqual(uit.nakijkmodel.map((n) => (n as { modelantwoord: string }).modelantwoord), ["m1", "m2", "m5"]);
    const uit2 = voegStukkenSamen([p([1, 2]), p([3, 4]), p([5])], st, q);
    assert.equal(uit2.vragen[2]!.contextTitel, "G");
  });
});

describe("plan-schrijven: namen ontdubbelen", () => {
  it("tweede Lotte in een andere vraag → nieuwe naam (ook in nakijkmodel); zelfde contextTitel mag", () => {
    const vragen = [
      { nummer: 1, stam: "Lotte fietst. Welke kracht?", context: "" },
      { nummer: 2, contextTitel: "Kermis", context: "Lotte is op de kermis.", stam: "Wat voelt Lotte?" },
      { nummer: 3, contextTitel: "Kermis", stam: "Waarom gilt Lotte?" },
      { nummer: 4, stam: "Daan en Bram duwen een kast." },
    ];
    const nk = [{ nummer: 2, modelantwoord: "Lotte voelt traagheid", puntenverdeling: [{ punt: 1, criterium: "Lotte: traagheid" }] }];
    const r = ontdubbelNamen(vragen, nk);
    assert.match(r.vragen[0]!.stam, /Lotte/);
    assert.doesNotMatch(r.vragen[1]!.context!, /Lotte/);
    const nieuw = r.vragen[1]!.context!.split(" ")[0]!;
    assert.match(r.vragen[1]!.stam, new RegExp(nieuw));
    assert.doesNotMatch(r.nakijkmodel[0]!.modelantwoord, /Lotte/);
    assert.equal(new Set(r.vervangen.map((v) => v.split("→ ")[1])).size, 1, r.vervangen.join(";"));
    assert.equal(r.vragen[2]!.stam, `Waarom gilt ${nieuw}?`);
  });
});
