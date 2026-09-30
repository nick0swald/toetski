import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EINDTERMEN, KERNDOELEN, NOVA_LEERDOEL_KOPPELING, ONDERWERP_KOPPELING } from "./leerdoelen-data.ts";
import { annoteerLeerdoelen, herstelLeerdoelen, leerdoelDekking, leerdoelenPool, leerdoelenPrompt, maakLeerdoelPlan, normaliseerLeerdoelId, verdeelPunten } from "./leerdoelen-plan.ts";
import { VRAAGTYPEN } from "./kalibratie-data.ts";
import type { Vraag } from "./types.ts";

const q = (nummer: number, extra: Partial<Vraag> = {}): Vraag => ({ nummer, type: "open", rtti: "T1", domein: "x", leerdoel: "", punten: 2, stam: "Leg uit.", ...extra });

describe("leerdoelen-data", () => {
  it("bevat de CE-eindtermen per leerweg uit de syllabus (BB 39, KB 53, GT 61) plus SE-eenheden", () => {
    const ce = (lw: "BB" | "KB" | "GT") => leerdoelenPool(3, lw).filter((d) => d.deel === "CE").length;
    assert.equal(ce("BB"), 39);
    assert.equal(ce("KB"), 53);
    assert.equal(ce("GT"), 61);
    assert.deepEqual(leerdoelenPool(3, "BB").filter((d) => d.deel === "SE").map((d) => d.id), ["K/6", "K/7", "K/10"]);
    assert.deepEqual(leerdoelenPool(4, "GT").filter((d) => d.deel === "SE").map((d) => d.id), ["K/7", "K/10", "K/11", "K/12"]);
    assert.equal(KERNDOELEN.length, 11);
  });
  it("ids zijn uniek binnen een leerweg", () => {
    for (const lw of ["BB", "KB", "GT"] as const) {
      const ids = leerdoelenPool(3, lw).map((d) => d.id);
      assert.equal(new Set(ids).size, ids.length, lw);
    }
  });
  it("alle 62 examentypen zijn aan minstens één eindterm gekoppeld; alle typen bestaan", () => {
    const bekend = new Set([...VRAAGTYPEN.map((t) => t.id), "OVERIG"]);
    const gebruikt = new Set(EINDTERMEN.flatMap((d) => d.typen));
    for (const t of [...EINDTERMEN, ...KERNDOELEN].flatMap((d) => d.typen)) assert.ok(bekend.has(t), t);
    const cse = VRAAGTYPEN.filter((t) => !t.onderbouw && t.id !== "OVERIG");
    assert.equal(cse.length, 62);
    assert.deepEqual(cse.filter((t) => !gebruikt.has(t.id)).map((t) => t.id), []);
  });
  it("koppelingen verwijzen alleen naar bestaande doelen", () => {
    const alle = new Set([...EINDTERMEN, ...KERNDOELEN].map((d) => d.id));
    for (const [k, pars] of Object.entries(NOVA_LEERDOEL_KOPPELING)) for (const ids of Object.values(pars)) for (const id of ids) assert.ok(alle.has(id), `${k} ${id}`);
    for (const o of ONDERWERP_KOPPELING) for (const [lw, ids] of Object.entries(o.doelen)) for (const id of ids!) assert.ok(leerdoelenPool(3, lw as "BB").some((d) => d.id === id), `${o.naam} ${lw} ${id}`);
  });
});

describe("maakLeerdoelPlan", () => {
  const geluid = { titel: "H13 Geluid", bron: "13.1 Geluidsbronnen\n...\n13.2 Toonhoogte\n...\n13.3 Geluidssterkte\n...\n13.4 Geluidshinder\n...", leerjaar: 4, leerweg: "GT" as const, doelPunten: 28, aantalVragen: 17 };
  it("zelfde hoofdstuk + niveau → zelfde doelen en puntverdeling", () => {
    const a = maakLeerdoelPlan(geluid)!;
    const b = maakLeerdoelPlan({ ...geluid, bron: `${geluid.bron}\nandere lesstoftekst over decibel` })!;
    assert.deepEqual(a.doelen, b.doelen);
    assert.match(a.herkomst, /Nova H13 Geluid/);
    assert.ok(a.doelen.some((d) => d.id === "K/8.4"));
    assert.equal(a.doelen.reduce((s, d) => s + d.doelPunten, 0), 28);
    assert.ok(a.doelen.every((d) => d.doelPunten >= 1));
  });
  it("alleen de paragrafen uit de lesstof", () => {
    const p = maakLeerdoelPlan({ ...geluid, bron: "13.3 Geluidssterkte\nx\n13.4 Geluidshinder\ny" })!;
    assert.deepEqual(p.doelen.map((d) => d.id), ["K/8.5", "K/8.6"]);
  });
  it("KB krijgt geen GT-only doelen (V/…)", () => {
    const p = maakLeerdoelPlan({ titel: "H14 Werktuigen", bron: "14.1 Werken met hefbomen\n14.2 Hefbomen en zwaartekracht\n14.3 Katrollen en takels\n14.4 Druk", leerjaar: 4, leerweg: "KB", doelPunten: 30, aantalVragen: 20 })!;
    assert.ok(p.doelen.length >= 3);
    assert.ok(p.doelen.every((d) => d.id.startsWith("K/")));
  });
  it("BB klas 3: onderwerp uit de titel (geen Nova-data)", () => {
    const p = maakLeerdoelPlan({ titel: "Hoofdstuk 1 Krachten", bron: "Krachten en hefbomen.", leerjaar: 3, leerweg: "BB", doelPunten: 25, aantalVragen: 22 })!;
    assert.equal(p.herkomst, "onderwerp Krachten en werktuigen");
    assert.deepEqual(p.doelen.map((d) => d.id), ["K/9.1", "K/9.2", "K/9.3", "K/9.9"]);
  });
  it("klas 2: SLO-kerndoelen", () => {
    const p = maakLeerdoelPlan({ titel: "H8 Geluid", bron: "8.1 Geluid maken en horen\n8.2 Toonhoogte en frequentie\n8.3 Geluidssterkte\n8.4 Geluidsoverlast verminderen", leerjaar: 2, leerweg: "KB", doelPunten: 31, aantalVragen: 26 })!;
    assert.equal(p.bron, "kerndoelen");
    assert.ok(p.doelen.every((d) => d.id.startsWith("SLO-")));
    assert.match(leerdoelenPrompt(p), /leerdoelId/);
  });
  it("verdeelPunten is stabiel en telt op", () => {
    assert.deepEqual(verdeelPunten([1, 1, 1], 10), verdeelPunten([1, 1, 1], 10));
    assert.equal(verdeelPunten([1, 0.6, 1.6, 1], 23).reduce((s, x) => s + x, 0), 23);
  });
});

describe("leerdoelId controle", () => {
  it("normaliseert varianten", () => {
    assert.equal(normaliseerLeerdoelId("NASK1/K/8.4"), "K/8.4");
    assert.equal(normaliseerLeerdoelId("k8.4"), "K/8.4");
    assert.equal(normaliseerLeerdoelId("K/9/10"), "K/9.10");
    assert.equal(normaliseerLeerdoelId("V/2.3"), "V/2.3");
    assert.equal(normaliseerLeerdoelId("K/7"), "K/7");
    assert.equal(normaliseerLeerdoelId("SLO 30C"), "SLO-30C");
    assert.equal(normaliseerLeerdoelId("kd30c"), "SLO-30C");
  });
  it("herstelt onbekende/ontbrekende ids via het vraagtype, zonder modelaanroep", () => {
    const plan = maakLeerdoelPlan({ titel: "H13 Geluid", bron: "", leerjaar: 4, leerweg: "GT", doelPunten: 28, aantalVragen: 17 })!;
    const vragen = [
      q(1, { leerdoelId: "NASK1/K/8.4", vraagtype: "G-FREQ" }),
      q(2, { leerdoelId: "K/5.6", vraagtype: "G-GEHOOR", stam: "Hoe lang mag Sanne bij 94 dB zonder oordoppen werken?" }),
      q(3, { vraagtype: "G-ECHO", stam: "Bereken de afstand tot de rotswand met de echo." }),
    ];
    const r = herstelLeerdoelen(vragen, plan);
    assert.deepEqual(r.vragen.map((v) => v.leerdoelId), ["K/8.4", "K/8.6", "K/8.2"]);
    assert.deepEqual(r.hersteld, [2, 3]);
    const dek = leerdoelDekking(r.vragen, plan);
    assert.ok(dek.ongedekt.some((x) => x.id === "K/8.5"));
    const kw = annoteerLeerdoelen({ samenvatting: "", punten: [] }, r.vragen, { ...plan, hersteld: r.hersteld });
    assert.match(kw.punten.at(-1)!.toelichting, /Niet getoetst: .*K\/8\.5/);
  });
});
