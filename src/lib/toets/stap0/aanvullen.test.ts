/**
 * Reproductie van de pilotrun van 3 okt (geluid-gt4): eerste versie 143 %, na schrappen/herstel 82 % en daarna
 * ±9 mislukte aanvulrondes. Offline met echte vraagstukken uit eerdere rondes (testdata/aanvullen-geluid-gt4.json).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { aanvulPrompt, foutHandtekening, inkorten, keurGeneratie, normaliseer, paragraafTelling, puntenVerdeling, schrapAfgekeurd, type Generatie, type SpecInvoer } from "./grok-spec.ts";
import { nieuweStaat, voerStapUit, type Stap0Staat, type StapChat } from "./stappen.ts";
import type { VraagstukSpec } from "./spec.ts";

const D = JSON.parse(readFileSync(fileURLToPath(new URL("./testdata/aanvullen-geluid-gt4.json", import.meta.url)), "utf8")) as {
  inv: SpecInvoer;
  kal: { items: number; punten: number };
  ruw: Generatie;
  hersteld: VraagstukSpec[];
  extra: VraagstukSpec;
  aanvullingen: VraagstukSpec[];
  goedeAanvulling: VraagstukSpec;
};
const inv: SpecInvoer = { ...D.inv, rttiDoel: { R: 20, T1: 45, T2: 25, I: 10 } };
const kal = D.kal;
const kopie = <T>(x: T): T => structuredClone(x);
/** Eerste versie van 143 % (40 van 28 punten), zoals in de pilotrun. */
const start: Generatie = { titel: D.ruw.titel, vraagstukken: [...D.ruw.vraagstukken.filter((v) => v.id !== "gitaarles"), D.extra] };
const hersteld = new Map(D.hersteld.map((v) => [v.id, v]));

function nepModel(o: { koppig?: string; aanvulling?: (n: number) => VraagstukSpec; uitbreiden?: (v: VraagstukSpec) => VraagstukSpec }) {
  const prompts: string[] = [];
  let n = 0;
  const chat: StapChat = async (m, schema) => {
    if (schema.naam === "toets_spec") return { tekst: JSON.stringify(start), usd: 0.06 };
    const p = m.at(-1)!.content;
    prompts.push(p);
    const id = /zelfde id \("([^"]+)"\)/.exec(p)?.[1];
    if (/BREID dit/.test(p)) {
      const v = JSON.parse(p.split(/zelfde id \("[^"]+"\):\n/)[1]!.split("\n")[0]!) as VraagstukSpec;
      return { tekst: JSON.stringify({ vraagstuk: o.uitbreiden ? o.uitbreiden(v) : v }), usd: 0.02 };
    }
    if (id) {
      const v = id === o.koppig ? start.vraagstukken.find((x) => x.id === id) : (hersteld.get(id) ?? start.vraagstukken.find((x) => x.id === id));
      return { tekst: JSON.stringify({ vraagstuk: kopie(v) }), usd: 0.02 };
    }
    const v = o.aanvulling ? o.aanvulling(n++) : D.aanvullingen[n++ % D.aanvullingen.length]!;
    return { tekst: JSON.stringify({ vraagstuk: kopie(v) }), usd: 0.02 };
  };
  return { chat, prompts };
}

async function draai(chat: StapChat, vangnetUsd = 1, na?: (s: Stap0Staat) => void): Promise<Stap0Staat> {
  let s = nieuweStaat(inv, kal, "repro");
  for (let i = 0; i < 80 && s.fase !== "klaar" && s.fase !== "mislukt"; i++) {
    s = await voerStapUit(s, chat, { budget: { vangnetUsd } });
    na?.(s);
  }
  return s;
}
const lengte = (g: Generatie) => keurGeneratie(g, inv, kal).feiten.lengtePct;

describe("aanvullen na 143 % → 82 % (pilotrun 3 okt, offline)", () => {
  it("de eerste versie is 143 %; schrappen vóór herstel blijft ≥ 90 % en schrapt liever één deelvraag", () => {
    assert.equal(lengte(normaliseer(start)), 143);
    const r = schrapAfgekeurd(normaliseer(start), inv, kal);
    assert.ok(lengte(r.gen) >= 90 && lengte(r.gen) <= 110, String(lengte(r.gen)));
    assert.ok(r.stappen.some((s) => /^deelvraag bouwplaats-d geschrapt/.test(s.wat)), "fout zit alleen in bouwplaats-d → alleen die deelvraag weg");
  });

  it("oorzaak 1: een koppig vraagstuk viel na 4 pogingen weg zonder lengtecontrole (→ 82 %); nu wordt het vervangen door een nieuw vraagstuk met dezelfde punten en paragrafen", async () => {
    const { chat } = nepModel({ koppig: "onweer", aanvulling: () => D.goedeAanvulling });
    let laagsteZonderVervang = 999;
    const s = await draai(chat, 1, (x) => {
      if (x.fase !== "herstel" || !x.gen) return;
      if (!x.aanvulling.open.some((t) => t.id.startsWith("vervang-"))) laagsteZonderVervang = Math.min(laagsteZonderVervang, lengte(x.gen));
      // Vervangen vóór weghalen: zolang de vervangtaak open staat, staat het oude vraagstuk er nog.
      for (const t of x.aanvulling.open) if (t.vervangt) assert.ok(x.gen.vraagstukken.some((v) => v.id === t.vervangt), `${t.vervangt} al weg vóór de vervanger`);
    });
    const vervang = s.stappen.find((x) => /^wordt vervangen door nieuw vraagstuk vervang-1 \([56] p\)/.test(x.wat));
    assert.ok(vervang, s.stappen.map((x) => x.wat).join("\n"));
    // Sinds de figuurbescherming kan eerst-schrappen een ander (figuurloos) vraagstuk kiezen; het koppige vraagstuk
    // dat overblijft wordt vervangen, nooit zomaar geschrapt.
    assert.ok(["onweer", "metro"].includes(vervang.id), vervang.id);
    assert.ok(!s.stappen.some((x) => /^geschrapt na \d+ pogingen/.test(x.wat) && x.id === "onweer"), "niet zomaar geschrapt");
    assert.ok(s.stappen.some((x) => /^aanvulling \d+\/[56] p/.test(x.wat) && x.id === "vervang-1" && x.ok), "vervanger geplaatst");
    assert.ok(laagsteZonderVervang >= 90, `lengte zakte onder 90 % zonder vervanger (${laagsteZonderVervang} %)`);
    // Nooit onder de spec leveren: klaar = precies de punten; haalt het (nep)model ze niet, dan "niet gelukt".
    if (s.fase === "klaar") {
      assert.deepEqual(s.restFouten, []);
      assert.equal(keurGeneratie(s.gen!, inv, kal).feiten.punten, kal.punten);
    } else {
      assert.equal(s.fase, "mislukt");
      assert.match(s.nietGelukt!, /^Niet gelukt: je vroeg 28 punten; er waren \d+ punten goedgekeurd/);
    }
  });

  it("oorzaak 2: aanvullingen sneuvelden op begrip-herhaling/dubbel begrip; de prompt noemt nu exacte punten, paragrafen, begrippen die op zijn en waarom de vorige poging is afgekeurd", async () => {
    const { chat, prompts } = nepModel({ koppig: "onweer" });
    await draai(chat, 0.4);
    const aan = prompts.filter((p) => /NIEUW VRAAGSTUK/.test(p));
    assert.ok(aan.length >= 2);
    const p = aan[0]!;
    assert.match(p, /precies 5 punten in 3 deelvragen, met in deze volgorde 1 p, 2 p, 2 p|precies 6 punten in 4 deelvragen, met in deze volgorde 1 p, 1 p, 2 p, 2 p/);
    assert.match(p, /Paragrafen \(uit dezelfde lesstof; nu het minst getoetst\): 13\.\d/);
    assert.match(p, /BEGRIPPEN DIE OP ZIJN[^\n]*veilige blootstellingstijd bij dB/);
    assert.match(p, /1-punts weetvragen \(R\): nog hoogstens \d+/);
    const herkansing = aan.find((x) => /IS DOOR DE SOFTWARE AFGEKEURD/.test(x));
    assert.ok(herkansing, "herkansing met reden");
    assert.match(herkansing, /Waarom:\n- (begrip-herhaling|dubbel-begrip|weggever)/);
  });

  it("stopregel: na 2 gelijke mislukte aanvullingen een andere strategie (uitbreiden), en vastgelopen = stoppen ruim onder het vangnet", async () => {
    const { chat } = nepModel({ koppig: "onweer" });
    const s = await draai(chat, 1);
    assert.ok(s.stappen.some((x) => /^andere strategie: uitbreiden/.test(x.wat)));
    assert.ok(s.stappen.some((x) => /^uitgebreid /.test(x.wat)));
    assert.equal(s.stopReden, "vastgelopen");
    assert.ok(s.kosten.usd < 0.6, String(s.kosten.usd));
    // elke afwijzing staat met reden in het log
    for (const x of s.stappen.filter((y) => /^(aanvulling|uitgebreid)/.test(y.wat) && !y.ok)) assert.match(x.wat, /afgewezen: [a-z-+]+/);
  });

  it("andere strategie werkt: uitbreiden van een goedgekeurd vraagstuk vult de lengte aan", async () => {
    const extraDeel = (v: VraagstukSpec): VraagstukSpec => {
      if (v.deelvragen.length >= 4) return v;
      const d = kopie(v.deelvragen.at(-1)!);
      Object.assign(d, { id: `${v.id}-x`, stam: `Noem een voorbeeld uit je eigen omgeving waarbij ${v.titel.toLowerCase()} een rol speelt en leg uit waarom.`, begrip: `eigen voorbeeld ${v.id}`, rtti: "I", punten: 2, antwoordmodel: { regels: [`Een passend eigen voorbeeld bij ${v.id} met uitleg.`] }, scorestappen: [{ omschrijving: "voorbeeld", punten: 1 }, { omschrijving: "uitleg", punten: 1 }] });
      delete d.berekeningen;
      delete d.opties;
      delete d.figuur;
      return { ...v, deelvragen: [...v.deelvragen, d] };
    };
    const { chat } = nepModel({ koppig: "onweer", uitbreiden: extraDeel });
    const s = await draai(chat, 1);
    assert.ok(s.stappen.some((x) => /^uitgebreid \d → \d p/.test(x.wat) && x.ok), s.stappen.map((x) => `${x.wat} ${x.id} ${x.fouten?.[0] ?? ""}`).join("\n"));
  });

  it("89 %: wordt niet meer geaccepteerd; lukt aanvullen niet, dan niet gelukt (geen toets onder de spec)", async () => {
    const fin: Generatie = { titel: "H13", vraagstukken: kopie(D.hersteld) };
    const zw = fin.vraagstukken.find((v) => v.id === "zwembad")!;
    zw.deelvragen = zw.deelvragen.slice(0, -1);
    assert.equal(lengte(fin), 89);
    const steeds = D.aanvullingen.find((v) => v.id === "festival")!;
    const chat: StapChat = async () => ({ tekst: JSON.stringify({ vraagstuk: kopie(steeds) }), usd: 0.02 });
    let s: Stap0Staat = { ...nieuweStaat(inv, kal, "w"), fase: "herstel", gen: fin };
    for (let i = 0; i < 60 && s.fase !== "klaar" && s.fase !== "mislukt"; i++) s = await voerStapUit(s, chat);
    assert.equal(s.fase, "mislukt");
    assert.match(s.nietGelukt!, /^Niet gelukt: je vroeg \d+ punten/);
    assert.ok(!s.waarschuwingen?.some((w) => /geaccepteerd/.test(w)));
  });
});

describe("lengtebewust inkorten", () => {
  const fin = (): Generatie => ({ titel: "H13", vraagstukken: kopie(D.hersteld) });
  it("net boven 110 %: één deelvraag (laagste waarde) weg, niet een heel vraagstuk", () => {
    const k = { items: 15, punten: 25 };
    assert.equal(keurGeneratie(fin(), inv, k).feiten.lengtePct, 112);
    const r = inkorten(fin(), inv, k);
    assert.equal(r.stappen.length, 1);
    assert.match(r.stappen[0]!.wat, /^deelvraag .* geschrapt/);
    const pct = keurGeneratie(r.gen, inv, k).feiten.lengtePct;
    assert.ok(pct <= 110 && pct >= 100, String(pct));
  });
  it("ver boven 110 %: eindigt net onder 110 % en nooit onder 90 %", () => {
    for (const punten of [18, 20, 22, 24]) {
      const k = { items: 12, punten };
      const r = inkorten(fin(), inv, k);
      const pct = keurGeneratie(r.gen, inv, k).feiten.lengtePct;
      assert.ok(pct >= 90 && pct <= 110, `${punten}: ${pct}`);
      assert.ok(pct >= 95, `zo dicht mogelijk onder 110 % (${punten}: ${pct})`);
    }
  });
  it("143 %-versie: schrappen + inkorten blijft in 90–110 %", () => {
    const g = schrapAfgekeurd(normaliseer(start), inv, kal).gen;
    const r = inkorten(g, inv, kal);
    const pct = lengte(r.gen);
    assert.ok(pct >= 90 && pct <= 110, String(pct));
  });
});

describe("hulpjes voor aanvullen", () => {
  it("puntverdeling is exact en 3–4 deelvragen", () => {
    for (let p = 3; p <= 9; p++) {
      const v = puntenVerdeling(p);
      assert.equal(v.reduce((a, b) => a + b, 0), p);
      assert.ok(v.length >= 3 && v.length <= 4);
      assert.ok(v.every((x) => x >= 1 && x <= 3));
    }
  });
  it("paragraaftelling: minst getoetste paragraaf eerst", () => {
    const t = paragraafTelling(D.hersteld.filter((v) => v.id !== "oorarts"), inv);
    assert.equal(t[0]!.code, "13.6");
    assert.equal(t[0]!.n, 0);
  });
  it("handtekening: zelfde soorten = zelfde mislukking (ids en getallen tellen niet)", () => {
    assert.equal(foutHandtekening(['begrip: a-b toetst opnieuw "x"', "dubbel begrip: a-c toetst hetzelfde"]), foutHandtekening(["dubbel begrip: q-a toetst hetzelfde", 'begrip: q-d toetst opnieuw "y"']));
    assert.notEqual(foutHandtekening(["weggever: x"]), foutHandtekening(["begrip: x toetst opnieuw"]));
  });
  it("aanvulprompt zonder herkansing noemt geen afkeuring", () => {
    const p = aanvulPrompt({ id: "a1", punten: 6, paragrafen: ["13.6 Het oor"], gen: { titel: "", vraagstukken: D.hersteld }, inv });
    assert.match(p, /precies 6 punten in 4 deelvragen/);
    assert.doesNotMatch(p, /AFGEKEURD/);
  });
});
