import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generatedPayloadSchema } from "./schema.ts";
import { novaStroomkring, parseFiguurSpec } from "./figuren/spec.ts";
import { controleerStroomkringSymbolen } from "./figuren/schakelsymbolen.ts";
import { tekenCodeFiguur } from "./figuren/svg.ts";
import { bevriesGoedgekeurd, figuurIsGeldig } from "./figuren/bevriezing.ts";
import { koppelVroegeFiguren, vraagSleutel, zonderPlaatjes } from "./figuren/vroeg.ts";
import { verwerkFiguren, type VerwerkDeps } from "./figuren/verwerk.ts";
import { berekenVoortgang } from "./voortgang.ts";
import type { FiguurSpec, GegenereerdeToets, Vraag } from "./types.ts";

const kring = (data: Record<string, unknown>): FiguurSpec => parseFiguurSpec({ soort: "stroomkring", data }).spec!;

describe("Nova: spanningsmeter nooit over de bron", () => {
  it("verplaatst een meter over de bron naar een lampje (serie)", () => {
    const r = parseFiguurSpec({ soort: "stroomkring", data: { componenten: [{ soort: "schakelaar-dicht" }, { soort: "lampje" }], voltmeters: [{ over: "bron" }] } });
    assert.deepEqual((r.spec!.data as { voltmeters: unknown[] }).voltmeters, [{ over: 1 }]);
    assert.ok(r.aanpassingen?.some((a) => /verplaatst/.test(a)));
  });
  it("schrapt de meter als er niets meetbaars is", () => {
    const r = parseFiguurSpec({ soort: "stroomkring", data: { componenten: [{ soort: "schakelaar-dicht" }], voltmeters: [{ over: "bron" }] } });
    assert.deepEqual((r.spec!.data as { voltmeters: unknown[] }).voltmeters, []);
  });
  it("parallel: meter over de bron → over een lampje in een tak, en dat wordt ook getekend", () => {
    const spec = kring({ schakeling: "parallel", componenten: [{ soort: "schakelaar-dicht" }], takken: [[{ soort: "lampje", label: "L1" }], [{ soort: "weerstand" }]], voltmeters: [{ over: "bron" }] });
    assert.deepEqual((spec.data as { voltmeters: unknown[] }).voltmeters, [{ over: { tak: 0, index: 0 } }]);
    assert.deepEqual(controleerStroomkringSymbolen(spec, tekenCodeFiguur(spec).svg), []);
  });
  it("meter over een onderdeel in een parallelle tak wordt getekend", () => {
    const spec = kring({ schakeling: "parallel", componenten: [{ soort: "ampèremeter" }], takken: [[{ soort: "lampje" }], [{ soort: "lampje" }, { soort: "weerstand" }]], voltmeters: [{ over: { tak: 1, index: 1 }, label: "V2" }] });
    const svg = tekenCodeFiguur(spec).svg;
    assert.deepEqual(controleerStroomkringSymbolen(spec, svg), []);
    assert.equal((svg.match(/data-symbool="voltmeter"/g) ?? []).length, 1);
  });
  it("code-check weigert een spec met een meter over de bron (als hij de normalisatie zou omzeilen)", () => {
    const spec = kring({ componenten: [{ soort: "lampje" }] });
    const rauw = { ...spec, data: { ...spec.data, voltmeters: [{ over: "bron" }] } } as FiguurSpec;
    assert.ok(controleerStroomkringSymbolen(rauw, tekenCodeFiguur(spec).svg).some((f) => /bron/.test(f)));
  });
  it("novaStroomkring houdt geldige meters", () => {
    const d = kring({ componenten: [{ soort: "lampje" }, { soort: "weerstand" }], voltmeters: [{ over: 1 }] }).data;
    assert.equal(novaStroomkring(d as never).aanpassingen.length, 0);
  });
});

describe("payload opnieuw valideren (afwerkstap)", () => {
  it("parse(parse(x)) = parse(x)", () => {
    const x = {
      meta: { titel: "T", vak: "NaSk" },
      vragen: [1, 2, 3].map((n) => ({ nummer: n, type: "Meerkeuze", rtti: "R", domein: "d", leerdoel: "l", punten: 1, stam: `Vraag ${n}?`, opties: [{ letter: "A", tekst: "a" }, { letter: "B", tekst: "b" }] })),
      nakijkmodel: [1, 2, 3].map((n) => ({ nummer: n, modelantwoord: "A. a", puntenverdeling: [{ punt: 1, criterium: "A" }] })),
      cesuur: { cesuurPunten: 2, toelichting: "t" },
      kwaliteit: { samenvatting: "s", punten: [] },
    };
    const een = generatedPayloadSchema.parse(x);
    assert.deepEqual(generatedPayloadSchema.parse(JSON.parse(JSON.stringify(een))), een);
  });
});

const vraag = (nummer: number, stam: string, extra: Partial<Vraag> = {}): Vraag => ({ nummer, type: "open", rtti: "T1", domein: "d", leerdoel: "l", punten: 2, stam, ...extra });
const toets = (vragen: Vraag[]): GegenereerdeToets => ({
  id: "t",
  createdAt: "2026-09-30T10:00:00.000Z",
  bronmateriaal: "Nova NaSk",
  extraEisen: "",
  ronde: 1,
  meta: { vak: "NaSk", titel: "x" } as never,
  cijferNorm: {} as never,
  vragen,
  nakijkmodel: vragen.map((q) => ({ nummer: q.nummer, modelantwoord: "x", puntenverdeling: [{ punt: q.punten, criterium: "x" }] })),
  cesuur: {} as never,
  matrijs: {} as never,
  kwaliteit: { samenvatting: "", punten: [] },
});
const figuur = () =>
  bevriesGoedgekeurd({
    id: "f1",
    soort: "stroomkring",
    bron: "code",
    mime: "image/png",
    data: "iVBORw0KGgo=",
    breedte: 560,
    hoogte: 340,
    alt: "Schakelschema",
    spec: kring({ componenten: [{ soort: "lampje" }] }),
    pogingen: 1,
    keuring: { besluit: "go", redenen: [], model: "t", tijdstip: "2026-09-30T10:00:00.000Z" },
  });
const nooitDeps: VerwerkDeps = {
  plan: async () => ({ ok: true, figuren: [] }),
  maak: async () => ({ status: "gedropt", pogingen: 0, redenen: ["nee"], log: [] }),
};

describe("vroege figuren koppelen na het afwerken", () => {
  it("zelfde vraag (hernummerd, MC eerst) krijgt de goedgekeurde figuur ongewijzigd", async () => {
    const ruw = [vraag(1, "Leg uit wat er gebeurt in de schakeling."), vraag(2, "Welke stof geleidt?", { type: "meerkeuze" })];
    const f = figuur();
    const prov = { ...toets(ruw), vragen: [{ ...ruw[0]!, figuur: f }, ruw[1]!], figuurRapport: { versie: 1 as const, items: [{ nummer: 1, soort: "stroomkring" as const, bron: "code" as const, status: "go" as const, pogingen: 1, redenen: [] }], meldingen: [] } };
    const finaal = toets([vraag(1, "Welke stof geleidt?", { type: "meerkeuze" }), vraag(2, "Leg uit wat er gebeurt in de  schakeling.")]);
    const uit = await koppelVroegeFiguren(finaal, { ruw, resultaat: prov }, nooitDeps);
    assert.equal(uit.vragen[1]!.figuur, f, "zelfde bevroren object");
    assert.ok(figuurIsGeldig(uit.vragen[1]!.figuur));
    assert.equal(uit.vragen[0]!.figuur, undefined);
    assert.equal(uit.figuurRapport!.items[0]!.nummer, 2, "rapport volgt het nieuwe nummer");
  });
  it("vraag die tijdens het afwerken is vervangen verliest de figuur", async () => {
    const ruw = [vraag(1, "Leg uit wat er gebeurt in de schakeling.")];
    const prov = { ...toets(ruw), vragen: [{ ...ruw[0]!, figuur: figuur() }], figuurRapport: { versie: 1 as const, items: [{ nummer: 1, soort: "stroomkring" as const, bron: "code" as const, status: "go" as const, pogingen: 1, redenen: [] }], meldingen: [] } };
    const uit = await koppelVroegeFiguren(toets([vraag(1, "Bereken de stroomsterkte door lampje 2.")]), { ruw, resultaat: prov }, nooitDeps);
    assert.equal(uit.vragen[0]!.figuur, undefined);
    assert.ok(uit.figuurRapport!.meldingen.some((m) => /vervallen/.test(m)));
  });
  it("figuurvelden die pas bij het afwerken verschijnen: na de deadline deterministische terugval, nooit ongekeurd", async () => {
    const g = { soort: "lijn", titel: "t", xLabel: "t (s)", yLabel: "v (m/s)", punten: [{ x: 0, y: 0 }, { x: 2, y: 4 }] } as never;
    const uit = await koppelVroegeFiguren(toets([vraag(1, "Lees af in de grafiek.", { grafiek: g })]), null, nooitDeps, { deadline: Date.now() - 1 });
    assert.equal(uit.vragen[0]!.grafiek, undefined);
    assert.ok(uit.vragen[0]!.tabel, "grafiek → tabel");
    assert.equal(uit.figuurRapport!.items[0]!.status, "gedropt");
  });
  it("sleutel negeert witruimte en leestekens, niet het type", () => {
    assert.equal(vraagSleutel({ stam: "Wat is  dit?", type: "open" }), vraagSleutel({ stam: "wat is dit", type: "open" }));
    assert.notEqual(vraagSleutel({ stam: "x", type: "open" }), vraagSleutel({ stam: "x", type: "meerkeuze" }));
  });
});

describe("tijdsbudget", () => {
  it("geen tijd meer → figuur direct gedropt, planner overgeslagen", async () => {
    let gepland = 0;
    let gemaakt = 0;
    const g = { soort: "lijn", titel: "t", xLabel: "t", yLabel: "v", punten: [{ x: 0, y: 0 }, { x: 2, y: 4 }] } as never;
    const uit = await verwerkFiguren(toets([vraag(1, "Lees af.", { grafiek: g }), vraag(2, "Nog een vraag.")]), {
      plan: async () => {
        gepland++;
        return { ok: true, figuren: [] };
      },
      maak: async () => {
        gemaakt++;
        return { status: "gedropt", pogingen: 1, redenen: [], log: [] };
      },
    }, { deadline: Date.now() + 2_000 });
    assert.equal(gepland, 0);
    assert.equal(gemaakt, 0);
    assert.ok(uit.figuurRapport!.items[0]!.redenen.some((r) => /tijdslimiet/.test(r)));
  });
});

describe("zonder plaatjes", () => {
  it("geen figuren, grafiek → tabel, kwaliteit 'voldoet'", () => {
    const g = { soort: "lijn", titel: "t", xLabel: "t (s)", yLabel: "v (m/s)", punten: [{ x: 0, y: 0 }, { x: 2, y: 4 }] } as never;
    const uit = zonderPlaatjes(toets([vraag(1, "Lees af in de grafiek hoe snel het gaat.", { grafiek: g }), vraag(2, "Wat is geleiding?", { pictogram: "giftig" })]));
    assert.equal(uit.metPlaatjes, false);
    assert.ok(uit.vragen.every((q) => !q.grafiek && !q.pictogram && !q.figuur));
    assert.ok(uit.vragen[0]!.tabel);
    assert.doesNotMatch(uit.vragen[0]!.stam, /grafiek/);
    const f = uit.kwaliteit.punten.find((p) => p.criterium === "Figuren");
    assert.equal(f?.oordeel, "voldoet");
  });
});

describe("voortgangsbalk", () => {
  const t = { start: 0, faseStart: 0, verwachtVragenMs: 20_000 };
  it("loopt door binnen een fase en blijft onder het einde van die fase", () => {
    const a = berekenVoortgang({ fase: "vragen", metPlaatjes: true }, t, 5_000).pct;
    const b = berekenVoortgang({ fase: "vragen", metPlaatjes: true }, t, 15_000).pct;
    const c = berekenVoortgang({ fase: "vragen", metPlaatjes: true }, t, 120_000).pct;
    assert.ok(a < b && b < c && c < 55);
  });
  it("wachten op plaatjes haalt de deadline en blijft niet op 99 % hangen", () => {
    const v = { fase: "plaatjes" as const, metPlaatjes: true, figuurDeadline: 20_000, figuren: { klaar: 1, totaal: 3, gepland: true } };
    const w = berekenVoortgang(v, t, 10_000);
    assert.match(w.label, /1 van 3/);
    assert.ok(w.wachtOpPlaatjes);
    assert.ok(berekenVoortgang(v, t, 19_000).pct <= 96);
    assert.equal(berekenVoortgang(v, t, 19_000).restS, 5);
  });
});
