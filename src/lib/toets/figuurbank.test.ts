import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseFiguurSpec } from "./figuren/spec.ts";
import { KEURING_CHECKS } from "./figuren/keuring.ts";
import { figuurIsGeldig } from "./figuren/bevriezing.ts";
import { maakFiguurMetKeuring, type PijplijnDeps } from "./figuren/pijplijn.ts";
import { bankItemIsIntact, bankSleutel, figuurUitBank, type BankItem, type FiguurBank } from "./figuren/bank.ts";
import type { FiguurSpec, Vraag } from "./types.ts";

const alleGo = () => ({ besluit: "go", checks: Object.fromEntries(KEURING_CHECKS.map((k) => [k, true])), redenen: ["ok"] });

function spec(extra: Record<string, unknown> = {}): FiguurSpec {
  const r = parseFiguurSpec({
    soort: "lijngrafiek",
    titel: "Afkoelen van thee",
    doel: "temperatuur aflezen",
    nietTonen: ["45"],
    data: { xLabel: "tijd", xEenheid: "min", yLabel: "temperatuur", yEenheid: "°C", reeksen: [{ punten: [{ x: 0, y: 80 }, { x: 10, y: 50 }, { x: 15, y: 41 }] }] },
    ...extra,
  });
  assert.ok(r.spec, r.fout);
  return r.spec!;
}

const vraag = (nummer: number, stam: string): Vraag => ({ nummer, type: "open", rtti: "T1", domein: "Warmte", leerdoel: "aflezen", punten: 2, stam });

class GeheugenBank implements FiguurBank {
  rijen = new Map<string, BankItem>();
  async zoek(k: string) {
    const r = this.rijen.get(k);
    return r ? (JSON.parse(JSON.stringify(r)) as BankItem) : null;
  }
  async bewaar(i: BankItem) {
    if (!this.rijen.has(i.sleutel)) this.rijen.set(i.sleutel, { ...JSON.parse(JSON.stringify(i)), aangemaakt: "2026-09-30T11:00:00.000Z" });
  }
}

function deps(bank: FiguurBank, over: Partial<PijplijnDeps> = {}) {
  let t = 0;
  let n = 0;
  const d = {
    keurAanroepen: 0,
    tekenPng: async () => new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
    genereerBeeld: async () => ({ bytes: new Uint8Array([255, 216, 255]), mime: "image/jpeg" }),
    verkleinJpeg: (b: Uint8Array) => ({ bytes: b, breedte: 720, hoogte: 540 }),
    keur: async () => {
      d.keurAanroepen++;
      return alleGo();
    },
    vraagJson: async () => ({}),
    nu: () => (t += 10),
    nieuwId: () => `fig-${++n}`,
    bank,
    ...over,
  };
  return d;
}

describe("figuurbank", () => {
  it("sleutel negeert de vrije doel-tekst en witruimte, maar niet data of nietTonen", () => {
    assert.equal(bankSleutel(spec()), bankSleutel(spec({ doel: "iets heel anders" })));
    assert.equal(bankSleutel(spec()), bankSleutel(spec({ titel: "  Afkoelen  van thee " })));
    assert.notEqual(bankSleutel(spec()), bankSleutel(spec({ nietTonen: ["50"] })));
    assert.notEqual(bankSleutel(spec()), bankSleutel(spec({ titel: "Opwarmen" })));
  });

  it("na een go opgeslagen; tweede docent krijgt dezelfde bytes direct, zonder keuring", async () => {
    const bank = new GeheugenBank();
    const a = deps(bank);
    const u1 = await maakFiguurMetKeuring({ vraag: vraag(3, "Lees af na 10 min."), spec: spec(), legacy: false, verwijst: true }, a);
    assert.equal(u1.status, "go");
    assert.equal(a.keurAanroepen, 1);
    assert.equal(bank.rijen.size, 1);
    const item = [...bank.rijen.values()][0]!;
    assert.ok(bankItemIsIntact(item), "hash klopt");
    assert.equal(item.goRapport.keuring.besluit, "go");
    assert.ok(item.aangemaakt);

    const b = deps(bank, { nieuwId: () => "fig-b", genereerBeeld: async () => assert.fail("geen generatie"), tekenPng: async () => assert.fail("niet tekenen") });
    const u2 = await maakFiguurMetKeuring({ vraag: vraag(7, "Andere docent, andere toets."), spec: spec({ doel: "anders" }), legacy: false, verwijst: true }, b);
    assert.equal(u2.status, "go");
    assert.equal(b.keurAanroepen, 0);
    if (u1.status === "go" && u2.status === "go") {
      assert.equal(u2.uitBank, true);
      assert.equal(u2.pogingen, 0);
      assert.equal(u2.figuur.data, u1.figuur.data, "exact dezelfde bytes");
      assert.notEqual(u2.figuur.id, u1.figuur.id, "eigen id per vraag");
      assert.ok(figuurIsGeldig(u2.figuur));
      assert.ok(Object.isFrozen(u2.figuur));
      assert.equal(u2.figuur.keuring.bank?.figuurHash, u1.figuur.hash);
    }
  });

  it("bestaand item wordt nooit overschreven", async () => {
    const bank = new GeheugenBank();
    await maakFiguurMetKeuring({ vraag: vraag(1, "x"), spec: spec(), legacy: false, verwijst: false }, deps(bank));
    const voor = JSON.stringify([...bank.rijen.values()]);
    await bank.bewaar({ ...[...bank.rijen.values()][0]!, data: "AAAA" });
    assert.equal(JSON.stringify([...bank.rijen.values()]), voor);
  });

  it("gemanipuleerd bankitem wordt genegeerd → gewoon maken en keuren", async () => {
    const bank = new GeheugenBank();
    await maakFiguurMetKeuring({ vraag: vraag(1, "x"), spec: spec(), legacy: false, verwijst: false }, deps(bank));
    const k = bankSleutel(spec());
    bank.rijen.set(k, { ...bank.rijen.get(k)!, data: "AAAA" });
    assert.equal(figuurUitBank(bank.rijen.get(k)!, k, "x"), null);
    const d = deps(bank);
    const u = await maakFiguurMetKeuring({ vraag: vraag(2, "y"), spec: spec(), legacy: false, verwijst: false }, d);
    assert.equal(u.status, "go");
    assert.equal(d.keurAanroepen, 1);
    if (u.status === "go") assert.notEqual(u.uitBank, true);
  });

  it("bank die hangt of faalt blokkeert de figuur niet", async () => {
    const kapot: FiguurBank = { zoek: () => new Promise(() => {}), bewaar: async () => { throw new Error("db weg"); } };
    const d = deps(kapot, { nu: (() => { let t = 0; return () => (t += 10); })() });
    const u = await maakFiguurMetKeuring({ vraag: vraag(1, "x"), spec: spec(), legacy: false, verwijst: false }, d, { budgetMs: 20_000 });
    assert.equal(u.status, "go");
  });

  it("migratie: tabel is onveranderlijk (UPDATE/DELETE geweigerd, dubbele insert genegeerd)", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite();
    await db.exec(readFileSync(new URL("../../../migrations/0002_figuur_bank.sql", import.meta.url), "utf8"));
    const ins = `insert into figuur_bank (sleutel, figuur_hash, figuur_id, soort, bron, mime, data, breedte, hoogte, alt, spec, pogingen, go_rapport)
      values ($1,'h','id','lijngrafiek','code','image/png',$2,1,1,'a','{}'::jsonb,1,'{"keuring":{"besluit":"go"}}'::jsonb) on conflict (sleutel) do nothing`;
    await db.query(ins, ["k1", "AAA"]);
    await db.query(ins, ["k1", "BBB"]);
    const r = await db.query<{ data: string }>("select data from figuur_bank where sleutel='k1'");
    assert.equal(r.rows[0]!.data, "AAA");
    await assert.rejects(db.query("update figuur_bank set data='X'"), /onveranderlijk/);
    await assert.rejects(db.query("delete from figuur_bank"), /onveranderlijk/);
    await db.close();
  });
});
