import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  afrondFouten,
  buitenLesstof,
  eenPuntsReproductie,
  normaliseerTekenfiguur,
  onderwerpUitInhoud,
  significant,
  zoekFiguurVerwijzingen,
  zoekGetalWeggevers,
  zoekIncoherentie,
} from "./inhoud-keuring.ts";
import { keurGeneratie, normaliseer, ontbrekendeParagrafen, type SpecInvoer } from "./grok-spec.ts";
import { laadFixtures } from "./laad.ts";
import { verwerkToets } from "./pijplijn.ts";
import { valideerSpec } from "./valideer.ts";
import { seLabel } from "./opmaak.ts";
import type { FiguurSpec, VraagstukSpec } from "./spec.ts";

const toon = (): VraagstukSpec => structuredClone(laadFixtures().find((f) => f.id === "se42-toongenerator") as VraagstukSpec);
const krachtenBron = JSON.parse(readFileSync(new URL("../../../../scripts/eval/inputs/krachten-gt3.json", import.meta.url), "utf8")).input.bronmateriaal as string;
const inv: SpecInvoer = { titel: "Krachten", leerweg: "GT", leerjaar: 3, duurMinuten: 45, bronmateriaal: krachtenBron, rttiDoel: { R: 25, T1: 40, T2: 27, I: 8 } };

/** Klein krachten-vraagstuk: deelvraag a = tekenvraag (Fz tekenen), b = rekenvraag. */
function krat(opts: { leerlingControle?: boolean; antwoordFiguur?: boolean; tekenvraag?: boolean } = {}): VraagstukSpec {
  const basis = { type: "krachten" as const, breedteCm: 6, hoogteCm: 7, schaalN: 10, voorwerp: "krat", punt: [3, 5] as [number, number], puntLabel: "Z" };
  const leerling: FiguurSpec = { ...basis, pijlen: [], controle: opts.leerlingControle ? [{ meting: "Fz.N", verwacht: 40 }] : undefined } as FiguurSpec;
  const antwoord: FiguurSpec = { ...basis, pijlen: [{ naam: "Fz", grootteN: 40, hoek: 270, rood: true }], controle: [{ meting: "Fz.N", verwacht: 40 }, { meting: "Fz.hoek", verwacht: 270 }] } as FiguurSpec;
  return {
    id: "krat-ali",
    soort: "vraagstuk",
    titel: "Krat van Ali",
    se: "SE4.1",
    hoofdstuk: "3",
    context: ["Ali tilt een krat met flessen op. De zwaartekracht op de krat is 40 N."],
    deelvragen: [
      {
        id: "krat-ali-a",
        vraagtype: { nr: 1, code: "T", naam: "tekenen" },
        niveau: "BB/KB/GT",
        punten: 2,
        stam: "Teken de zwaartekracht op de krat als pijl in Z. Gebruik de krachtenschaal 1 cm ≙ 10 N.",
        figuur: leerling,
        ...(opts.tekenvraag === false ? {} : { tekenvraag: true }),
        antwoordmodel: { regels: ["pijl van 4,0 cm recht omlaag vanuit Z"], ...(opts.antwoordFiguur === false ? {} : { figuur: antwoord }) },
        scorestappen: [
          { omschrijving: "lengte 4,0 cm", punten: 1 },
          { omschrijving: "richting omlaag vanuit Z", punten: 1 },
        ],
        rtti: "T1",
        leerdoel: "3.2 kracht als pijl tekenen",
        begrip: "kracht als pijl tekenen",
      },
      {
        id: "krat-ali-b",
        vraagtype: { nr: 2, code: "B", naam: "berekenen" },
        niveau: "BB/KB/GT",
        punten: 2,
        stam: "Bereken de massa van de krat.",
        antwoordmodel: { regels: ["m = Fz / g = 40 / 9,8 = 4,08 ≈ 4,1 kg"] },
        scorestappen: [
          { omschrijving: "formule", punten: 1 },
          { omschrijving: "antwoord", punten: 1 },
        ],
        rtti: "T1",
        leerdoel: "3.1 massa uit zwaartekracht",
        begrip: "massa uit zwaartekracht",
        parameters: [
          { naam: "Fz", waarde: 40, bron: "tekst", eenheid: "N", weergave: "40" },
          { naam: "g", waarde: 9.8, bron: "binas", eenheid: "N/kg" },
        ],
        berekeningen: [{ naam: "m", formule: "Fz / g", waarde: 40 / 9.8, eenheid: "kg", afgerond: "4,1", tolerantie: 0.001 }],
      },
      {
        id: "krat-ali-c",
        vraagtype: { nr: 3, code: "U", naam: "uitleggen" },
        niveau: "BB/KB/GT",
        punten: 2,
        context: ["Ali zet de krat op de grond."],
        stam: "Leg uit welke kracht de grond op de krat uitoefent.",
        antwoordmodel: { regels: ["de normaalkracht, omhoog, even groot als de zwaartekracht"] },
        scorestappen: [
          { omschrijving: "normaalkracht", punten: 1 },
          { omschrijving: "omhoog en even groot", punten: 1 },
        ],
        rtti: "T2",
        leerdoel: "3.3 evenwicht van krachten",
        begrip: "normaalkracht bij evenwicht",
      },
    ],
  } as VraagstukSpec;
}
const fouten = (v: VraagstukSpec) => {
  const r = verwerkToets({ titel: "x", vragen: [v.id] }, [v as never]);
  return r.keuringen.flatMap((k) => k.fouten);
};

describe("stap 0: inhoudelijke keuringen (offline)", () => {
  it("1. tekenvraag: controle van de te tekenen pijl hoort in de antwoordfiguur, niet in de leerlingfiguur", () => {
    assert.deepEqual(fouten(krat()), []); // lege leerlingfiguur zonder controle + antwoordfiguur met controle = goed
    const f = fouten(krat({ leerlingControle: true }));
    assert.ok(f.some((x) => /tekenvraag: "Fz\.N" tekent de leerling zelf.*antwoordmodel\.figuur/.test(x)), f.join("\n"));
    assert.ok(fouten(krat({ antwoordFiguur: false })).some((x) => /tekenvraag: true vereist antwoordmodel\.figuur/.test(x)));
    // ook zonder tekenvraag-vlag: "Teken …" bij een lege figuur is een tekenvraag
    assert.ok(fouten(krat({ antwoordFiguur: false, tekenvraag: false })).some((x) => /tekenvraag zonder antwoordfiguur/.test(x)));
    // schema: tekenvraag true zonder antwoordmodel.figuur
    const sch = valideerSpec({ ...krat({ antwoordFiguur: false }) });
    assert.match(sch[0] ?? "", /deelvragen\/0\/antwoordmodel tekenvraag: true vereist antwoordmodel\.figuur/);
    assert.ok(!sch.some((x) => /"then"/.test(x)), sch.join("\n"));
    assert.deepEqual(valideerSpec(krat()), []);
  });

  it("2. getal-weggever alleen met eenheid binnen hetzelfde vraagstuk; hetzelfde getal elders telt niet", () => {
    const a = krat();
    const b = toon();
    b.deelvragen[0]!.stam = "Een tas weegt 4,1 kg. Bepaal de trillingstijd van de toon in ms.";
    assert.deepEqual(zoekGetalWeggevers([a, b]), []); // ander vraagstuk: toeval
    const c = krat();
    c.deelvragen[0]!.context = ["De krat heeft een massa van 4,1 kg."];
    assert.deepEqual(zoekGetalWeggevers([c]), ["krat-ali-a verklapt krat-ali-b (4,1 kg)"]);
    const d = krat();
    d.deelvragen[0]!.context = ["Er staan 4,1 flessen per rij."];
    assert.deepEqual(zoekGetalWeggevers([d]), []); // zonder eenheid geen weggever
  });

  it("3. samenhang: een deelvraag over de situatie van een ander vraagstuk wordt gevonden", () => {
    const echo = toon();
    echo.id = "echo";
    echo.titel = "Echo bij Kevin";
    const auto = krat();
    auto.id = "auto-noor";
    auto.titel = "Auto van Noor";
    auto.context = ["Noor rijdt in haar auto naar school."];
    echo.deelvragen[3]!.stam = "Welk diagram past bij een auto die eerst constant rijdt en daarna afremt?";
    echo.deelvragen[3]!.context = undefined;
    const b = zoekIncoherentie([echo, auto], krachtenBron);
    assert.ok(b.some((x) => x.id === echo.deelvragen[3]!.id && /Auto van Noor/.test(x.tekst)), JSON.stringify(b));
    assert.deepEqual(zoekIncoherentie([toon(), krat()], krachtenBron), []);
    const naam = krat();
    naam.deelvragen[1]!.stam = "Ook Fatima tilt een krat. Bereken de massa.";
    assert.ok(zoekIncoherentie([naam], krachtenBron).some((x) => /andere persoon.*Fatima/.test(x.tekst)));
  });

  it("4. elke verwezen figuur bestaat: beeld A–D zonder panelen en 'de tabel' zonder tabel", () => {
    assert.deepEqual(zoekFiguurVerwijzingen([toon()]), []); // fixture: alle figuren aanwezig
    const v = toon();
    v.deelvragen[2]!.figuur = undefined;
    assert.ok(zoekFiguurVerwijzingen([v]).some((x) => /A, B, C, D.*bestaan niet/.test(x.tekst)));
    const k = krat();
    k.deelvragen[1]!.stam = "Gebruik de tabel. Bereken de massa.";
    assert.ok(zoekFiguurVerwijzingen([k]).some((x) => /tabel/.test(x.tekst)));
    const zonder = krat();
    zonder.deelvragen[0]!.figuur = undefined;
    zonder.deelvragen[1]!.stam = "Je ziet hieronder de krat. Bereken de massa.";
    assert.ok(zoekFiguurVerwijzingen([zonder]).some((x) => x.id === "krat-ali-b"));
  });

  it("5a. 1-punts reproductievragen: hoogstens 30 % van de punten bij GT", () => {
    const v = toon();
    v.deelvragen.forEach((d) => ((d.punten = 1), (d.rtti = "R"), (d.scorestappen = [{ omschrijving: "x", punten: 1 }])));
    const r = eenPuntsReproductie([v, krat()], "GT");
    assert.equal(r.max, 0.3);
    assert.ok(r.pct > 0.3 && r.bevindingen.length === 1 && r.bevindingen[0]!.vraagstuk === v.id, JSON.stringify(r));
    assert.equal(eenPuntsReproductie([toon(), krat()], "GT").bevindingen.length, 0);
    assert.equal(eenPuntsReproductie([v, krat()], "BB").max, 0.45);
  });

  it("5b. stof buiten de lesstof (vaktermen die de lesstof niet noemt)", () => {
    const v = krat();
    v.deelvragen[1]!.begrip = "versnelling uit nettokracht";
    const b = buitenLesstof([v], krachtenBron);
    // "versnellen" staat in 3.1 → versnelling mag; "nettokracht" niet (de lesstof zegt "resulterende kracht")
    assert.ok(b.some((x) => /nettokracht/.test(x.tekst) && !/versnelling/.test(x.tekst)), JSON.stringify(b));
    assert.deepEqual(buitenLesstof([krat()], krachtenBron), []);
    const st = krat();
    st.deelvragen[1]!.begrip = "zwaartepunt en stabiliteit";
    assert.ok(buitenLesstof([st], krachtenBron).some((x) => /stabiliteit/.test(x.tekst) && !/zwaartepunt/.test(x.tekst)));
  });

  it("5c. afronding: significante cijfers zoals de gegevens (min. 2, max één meer)", () => {
    assert.deepEqual([significant("39,2"), significant("0,040"), significant("600"), significant("8"), significant("1250")], [3, 2, null, 1, null]);
    assert.deepEqual(afrondFouten([krat()]), []); // 40 / 9,8 → "4,1"
    const v = krat();
    v.deelvragen[1]!.parameters![0] = { naam: "Fz", waarde: 45, bron: "tekst", eenheid: "N", weergave: "45" };
    v.deelvragen[1]!.berekeningen![0] = { naam: "m", formule: "Fz / g", waarde: 45 / 9.8, eenheid: "kg", afgerond: "4,592", tolerantie: 0.001 };
    assert.ok(afrondFouten([v]).some((x) => /4 significante cijfers; rond af op 2/.test(x.tekst)));
    assert.deepEqual(afrondFouten([toon()]), []); // "0,8" uit gegevens met 1 significant cijfer mag
    v.deelvragen[1]!.stam = "Bereken de massa. Rond af op drie decimalen.";
    assert.deepEqual(afrondFouten([v]), []);
  });

  it("5d. dekking op inhoud: een fout paragraaflabel telt niet (3.2 op een stabiliteitsvraag)", () => {
    const v = krat();
    v.deelvragen[0]!.stam = "Wanneer staat een krat stabieler?";
    v.deelvragen[0]!.antwoordmodel = { regels: ["als het zwaartepunt lager ligt"] };
    v.deelvragen[0]!.figuur = undefined;
    v.deelvragen[0]!.tekenvraag = undefined;
    v.deelvragen[0]!.leerdoel = "3.2 zwaartepunt en stabiliteit";
    v.deelvragen[0]!.begrip = "stabiliteit";
    assert.ok(ontbrekendeParagrafen([v], inv).some((p) => p.code === "3.2"));
    assert.ok(!ontbrekendeParagrafen([krat()], inv).some((p) => p.code === "3.2")); // echte tekenvraag telt wel
    // "betekent" raakt het kernwoord "tekenen" niet (woordbegin), en een leerdoel zonder code valt niet terug op het
    // losse titelwoord "krachten"
    const w = structuredClone(v);
    w.deelvragen[1]!.leerdoel = "3.3 Fres ≠ 0 betekent versnellen";
    w.deelvragen[2]!.leerdoel = "krachten in evenwicht";
    assert.ok(ontbrekendeParagrafen([w], inv).some((p) => p.code === "3.2"));
  });

  it("6. lege tekengrafiek: geen los punt in de oorsprong; onderwerplabel uit de inhoud", () => {
    const f: FiguurSpec = { type: "grafiek", x: { label: "t (min)", min: 0, max: 4, stap: 1 }, y: { label: "L (dB)", min: 0, max: 100, stap: 20 }, reeksen: [{ punten: [[0, 0]], vorm: "punten" }], breedteCm: 9, controle: [{ meting: "y@0", verwacht: 0 }] };
    const n = normaliseerTekenfiguur(f, true) as Extract<FiguurSpec, { type: "grafiek" }>;
    assert.deepEqual([n.reeksen, n.controle], [[], undefined]);
    assert.equal(normaliseerTekenfiguur(f, false), f);
    // via normaliseer (zoals na de generatie)
    const v = toon();
    v.deelvragen[0]!.stam = "Teken de punten in het diagram.";
    v.deelvragen[0]!.figuur = f;
    const g = normaliseer({ titel: "x", vraagstukken: [v] });
    assert.deepEqual((g.vraagstukken[0]!.deelvragen[0]!.figuur as { reeksen: unknown[] }).reeksen, []);
    assert.equal(onderwerpUitInhoud("SE4.2", "De toon heeft een hoge frequentie; het geluid is hard (90 dB)."), "Geluid");
    assert.equal(onderwerpUitInhoud("SE4.2", "geluid trilling frequentie energie rendement joule"), "Geluid en energie");
    // pijplijn: klas 2 → label "Geluid" op de vragen
    const t = verwerkToets({ titel: "x", vragen: ["se42-toongenerator"], klas: { leerjaar: 2, leerweg: "KB" } }, laadFixtures());
    assert.ok(t.vragen.every((q) => q.onderwerp === "Geluid"));
    assert.equal(seLabel("SE4.2", 2, t.vragen[0]!.onderwerp), "Geluid");
    assert.equal(seLabel("SE4.2", 4, "Geluid"), "SE4.2"); // klas 4 blijft SE
  });

  it("keurGeneratie meldt de nieuwe bevindingen per vraagstuk (voor het gerichte herstel)", () => {
    const v = krat({ leerlingControle: true });
    v.deelvragen[1]!.begrip = "nettokracht";
    const r = keurGeneratie({ titel: "x", vraagstukken: [v] }, inv, { items: 2, punten: 4 });
    assert.ok(r.perId["krat-ali"]!.some((x) => /tekenvraag/.test(x)));
    assert.ok(r.perId["krat-ali"]!.some((x) => /^lesstof:/.test(x)));
    assert.ok(Array.isArray(r.feiten.samenhang) && typeof r.feiten.eenPuntsR.pct === "number");
  });
});
