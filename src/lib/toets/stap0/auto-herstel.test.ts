import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { andereWaarde, autoHerstel, autoHerstelVraagstuk, leidJuistAf, pasKrachtenKader, rondSig } from "./auto-herstel.ts";
import { genereerSpec, hoofdstukNaam, isServerfout, keurGeneratie, specPrompt, type ChatFn, type SpecInvoer } from "./grok-spec.ts";
import { afrondFouten, bloklijstRegel, paragraafKern, zoekGegevenWeggevers, raaktKern, zoekBegripHerhaling, zoekGetalWeggevers } from "./inhoud-keuring.ts";
import { controleerBerekeningen, leesNl } from "./reken.ts";
import { laadFixtures } from "./laad.ts";
import { verwerkToets } from "./pijplijn.ts";
import type { FiguurSpec, KrachtenFiguur, VraagstukSpec } from "./spec.ts";

const toon = (): VraagstukSpec => structuredClone(laadFixtures().find((f) => f.id === "se42-toongenerator") as VraagstukSpec);
const fouten = (v: VraagstukSpec) => verwerkToets({ titel: "x", vragen: [v.id] }, [v as never]).keuringen.flatMap((k) => k.fouten);
const geluidBron = `Hoofdstuk 13 Geluid\n\n13.1 Geluid maken en horen\nGeluid ontstaat als een voorwerp trilt.\n\n13.2 Hoge en lage tonen\nDe frequentie is het aantal trillingen per seconde.\n\n13.3 Hard en zacht geluid\nDe geluidssterkte meet je met een decibelmeter in dB.\n\n13.4 Geluidssnelheid\nGeluid heeft tijd nodig om zich te verplaatsen. In lucht is de geluidssnelheid 343 m/s. Echo: afstand = v × t / 2.\n\n13.5 Geluidshinder\nOngewenst geluid heet lawaai. Maatregelen bij de bron, de tussenstof of de ontvanger.\n\n13.6 Het oor\nHet oor bestaat uit oorschelp, trommelvlies en slakkenhuis.`;

/** Krachtenvraagstuk met een tekenvraag (a), een rekenvraag (b) en een uitlegvraag (c). */
function krat(): VraagstukSpec {
  const fig: KrachtenFiguur = { type: "krachten", breedteCm: 6, hoogteCm: 7, schaalN: 10, voorwerp: "krat", punt: [3, 5], puntLabel: "Z", pijlen: [], controle: [{ meting: "Fz.N", verwacht: 40 }] };
  const d = (id: string, extra: object) => ({ id, vraagtype: { nr: 1, code: "T", naam: "t" }, niveau: "BB/KB/GT", punten: 2, scorestappen: [{ omschrijving: "a", punten: 1 }, { omschrijving: "b", punten: 1 }], rtti: "T1", leerdoel: "3.2 tekenen", begrip: { "krat-a": "zwaartekracht tekenen", "krat-b": "massa uit zwaartekracht", "krat-c": "normaalkracht herkennen" }[id], ...extra });
  return {
    id: "krat", soort: "vraagstuk", titel: "Krat", se: "SE4.1", hoofdstuk: "3", context: ["Ali tilt een krat. De zwaartekracht op de krat is 40 N."],
    deelvragen: [
      d("krat-a", { stam: "Teken de zwaartekracht op de krat in Z. Gebruik 1 cm ≙ 10 N.", figuur: fig, antwoordmodel: { regels: ["pijl van 4,0 cm recht omlaag vanuit Z"] } }),
      d("krat-b", { stam: "Bereken de massa van de krat.", antwoordmodel: { regels: ["m = 40 / 9,8 = 4,08 ≈ 4,1 kg"] }, parameters: [{ naam: "Fz", waarde: 40, bron: "tekst", eenheid: "N", weergave: "40" }, { naam: "g", waarde: 9.8, bron: "binas", eenheid: "N/kg" }], berekeningen: [{ naam: "m", formule: "Fz / g", waarde: 40 / 9.8, eenheid: "kg", afgerond: "4,1", tolerantie: 0.001 }] }),
      d("krat-c", { stam: "Welke kracht oefent de grond uit?", opties: ["normaalkracht", "spankracht", "veerkracht"], antwoordmodel: { regels: ["normaalkracht"] }, scorestappen: [{ omschrijving: "juiste letter", punten: 2 }] }),
    ],
  } as unknown as VraagstukSpec;
}

describe("stap 0: first-time-right (offline)", () => {
  it("1. juiste letter afleiden uit het antwoordmodel (letter of de tekst van precies één optie)", () => {
    assert.equal(leidJuistAf({ opties: ["beeld A", "beeld B", "beeld C", "beeld D"], antwoordmodel: { regels: ["B: hoger en harder"] } }), "B");
    assert.equal(leidJuistAf({ opties: ["normaalkracht", "spankracht", "veerkracht"], antwoordmodel: { regels: ["normaalkracht"] } }), "A");
    assert.equal(leidJuistAf({ opties: ["juist", "onjuist"], antwoordmodel: { regels: ["onjuist, want geluid heeft een tussenstof nodig"] } }), "B");
    assert.equal(leidJuistAf({ opties: ["meer", "minder"], antwoordmodel: { regels: ["Het wordt meer of minder"] } }), undefined); // dubbelzinnig
    assert.equal(leidJuistAf({ opties: ["a", "b"], antwoordmodel: { regels: ["A"], juist: "A" } }), undefined); // al goed
    const v = krat();
    assert.ok(fouten(v).some((f) => /meerkeuze zonder juiste letter/.test(f)));
    const { v: w, stappen } = autoHerstelVraagstuk(v);
    assert.equal(w.deelvragen[2]!.antwoordmodel.juist, "A");
    assert.ok(stappen.some((s) => /juiste letter A/.test(s.wat)));
  });

  it("2. figuurcontrole met onbekende parameter → waarde uit de figuur", () => {
    const v = toon();
    (v.deelvragen[2]!.figuur as { controle: { meting: string; parameter?: string }[] }).controle[0]!.parameter = "T_B_hok";
    assert.ok(fouten(v).some((f) => /parameter T_B_hok onbekend/.test(f)));
    const { v: w } = autoHerstelVraagstuk(v);
    assert.deepEqual(fouten(w), []);
    assert.deepEqual((w.deelvragen[2]!.figuur as { controle: object[] }).controle[0], { meting: "B.T", verwacht: 2.5 });
  });

  it("3. tekenvraag: controle uit de leerlingfiguur, antwoordfiguur met rode pijl uit grootte + richting", () => {
    const v = krat();
    v.deelvragen[2]!.antwoordmodel.juist = "A";
    assert.ok(fouten(v).some((f) => /tekenvraag zonder antwoordfiguur/.test(f)));
    const { v: w, stappen } = autoHerstelVraagstuk(v);
    const a = w.deelvragen[0]!;
    assert.equal(a.tekenvraag, true);
    assert.deepEqual((a.figuur as KrachtenFiguur).pijlen, []);
    assert.deepEqual((a.figuur as KrachtenFiguur).controle, [{ meting: "pijlen", verwacht: 0 }]);
    const af = a.antwoordmodel.figuur as KrachtenFiguur;
    assert.deepEqual(af.pijlen, [{ naam: "Fz", grootteN: 40, hoek: 270, rood: true }]);
    assert.deepEqual(fouten(w), []);
    assert.ok(stappen.some((s) => /antwoordfiguur gemaakt: rode pijl Fz = 40 N, 270°/.test(s.wat)));
    // zonder richting of grootte: niets verzinnen
    const x = krat();
    x.deelvragen[0]!.stam = "Teken de spankracht in Z.";
    x.context = ["Ali tilt een krat."];
    x.deelvragen[0]!.antwoordmodel.regels = ["pijl in de goede richting"];
    assert.equal(autoHerstelVraagstuk(x).v.deelvragen[0]!.antwoordmodel.figuur, undefined);
  });

  it("3b. tekenvraag met een al getekende grafiek: die wordt de rode antwoordreeks, leerling krijgt een leeg assenstelsel", () => {
    const v = krat();
    const g: FiguurSpec = { type: "grafiek", x: { label: "t (s)", min: 0, max: 4, stap: 1 }, y: { label: "v (m/s)", min: 0, max: 8, stap: 2 }, reeksen: [{ punten: [[0, 0], [4, 8]], vorm: "lijn" }], breedteCm: 8, controle: [{ meting: "y@4", verwacht: 8 }] };
    v.deelvragen[0] = { ...v.deelvragen[0]!, stam: "Teken het (v,t)-diagram.", figuur: g };
    const { v: w } = autoHerstelVraagstuk(v);
    const a = w.deelvragen[0]!;
    assert.deepEqual((a.figuur as { reeksen: unknown[] }).reeksen, []);
    assert.deepEqual((a.antwoordmodel.figuur as { reeksen: { rood?: boolean }[] }).reeksen[0]!.rood, true);
  });

  it("4. 'Ga uit van' met de uitkomst van een eerdere deelvraag → andere waarde en opnieuw doorgerekend; overbodige zin weg", () => {
    assert.equal(andereWaarde("4,1"), "4,9");
    assert.equal(andereWaarde("250"), "300");
    const v = krat();
    v.deelvragen[2] = {
      ...v.deelvragen[2]!, opties: undefined, stam: "Ga uit van een massa van 4,1 kg. Bereken de zwaartekracht op de maan (1,6 N/kg).", antwoordmodel: { regels: ["Fz = 4,1 × 1,6 = 6,56 ≈ 6,6 N"] }, scorestappen: [{ omschrijving: "6,6 N", punten: 2 }],
      parameters: [{ naam: "m2", waarde: 4.1, bron: "tekst", eenheid: "kg", weergave: "4,1" }, { naam: "gm", waarde: 1.6, bron: "tekst", eenheid: "N/kg", weergave: "1,6" }],
      berekeningen: [{ naam: "Fm", formule: "m2 * gm", waarde: 6.56, eenheid: "N", afgerond: "6,6" }],
    };
    assert.ok(zoekGetalWeggevers([v]).some((x) => /krat-c verklapt krat-b \(4,1 kg\)/.test(x)));
    const { v: w, stappen } = autoHerstelVraagstuk(v);
    const c = w.deelvragen[2]!;
    assert.match(c.stam, /4,9 kg/);
    assert.doesNotMatch(c.stam, /4,1/);
    assert.equal(c.berekeningen![0]!.afgerond, "7,8");
    assert.match(c.antwoordmodel.regels[0]!, /7,8 N/);
    assert.deepEqual(controleerBerekeningen(c, w.parameters).fouten, []);
    assert.deepEqual(zoekGetalWeggevers([w]), []);
    assert.ok(stappen.some((s) => /Ga uit van 4,9 kg/.test(s.wat)));
    // B rekent er niet mee → informatiezin weg
    const x = krat();
    x.deelvragen[2]!.context = ["De krat heeft een massa van 4,1 kg."];
    const y = autoHerstelVraagstuk(x).v;
    assert.equal(y.deelvragen[2]!.context, undefined);
    assert.deepEqual(zoekGetalWeggevers([y]), []);
  });

  it("4b. 'Ga uit van' (ronde 5, notenkraker): ook de gegeven waarde in het antwoordmodel verandert mee", () => {
    const v = krat();
    v.deelvragen[1] = {
      ...v.deelvragen[1]!, stam: "Bereken het moment.", antwoordmodel: { regels: ["M = 40 × 12 = 480 N·cm"] },
      parameters: [{ naam: "F", waarde: 40, bron: "tekst", eenheid: "N", weergave: "40" }, { naam: "r", waarde: 12, bron: "tekst", eenheid: "cm", weergave: "12" }],
      berekeningen: [{ naam: "M", formule: "F * r", waarde: 480, eenheid: "N·cm", afgerond: "480" }],
    };
    v.deelvragen[2] = {
      ...v.deelvragen[2]!, opties: undefined, stam: "Bereken de kracht op de noot. Ga uit van M = 480 N·cm en arm 3,0 cm.", antwoordmodel: { regels: ["F = M / r = 480 / 3,0 = 160 N"] }, scorestappen: [{ omschrijving: "F = 480 / 3,0", punten: 1 }, { omschrijving: "160 N", punten: 1 }],
      parameters: [{ naam: "M2", waarde: 480, bron: "tekst", eenheid: "N·cm", weergave: "480" }, { naam: "rn", waarde: 3, bron: "tekst", eenheid: "cm", weergave: "3,0" }],
      berekeningen: [{ naam: "Fn", formule: "M2 / rn", waarde: 160, eenheid: "N", afgerond: "160" }],
    };
    const c = autoHerstelVraagstuk(v).v.deelvragen[2]!;
    assert.match(c.stam, /M = 580 N·cm/);
    assert.deepEqual(c.antwoordmodel.regels, ["F = M / r = 580 / 3,0 = 190 N"]);
    assert.deepEqual(c.scorestappen.map((x) => x.omschrijving), ["F = 580 / 3,0", "190 N"]);
    assert.deepEqual(fouten(autoHerstelVraagstuk(v).v).filter((f) => /krat-c/.test(f) && !/juiste letter/.test(f)), []);
  });

  it("4d. gegeven-weggever tussen vraagstukken, W ↔ kW: '1400 W' bij een uitkomst 1,4 kW → andere waarde, opnieuw doorgerekend", () => {
    const dv = (id: string, extra: object) => ({ id, vraagtype: { nr: 63, code: "OVERIG", naam: "Overig" }, niveau: "BB/KB/GT", punten: 2, scorestappen: [{ omschrijving: "a", punten: 1 }, { omschrijving: "b", punten: 1 }], rtti: "T1", ...extra });
    const strijk = { id: "strijk", soort: "vraagstuk", titel: "Strijken", se: "SE4.2", hoofdstuk: "E", context: ["Een strijkijzer gebruikt 0,70 kWh in 0,50 h."], parameters: [{ naam: "E", waarde: 0.7, bron: "tekst", eenheid: "kWh", weergave: "0,70" }, { naam: "t", waarde: 0.5, bron: "tekst", eenheid: "h", weergave: "0,50" }],
      deelvragen: [dv("strijk-a", { stam: "Bereken het vermogen in kW.", antwoordmodel: { regels: ["P = 0,70 / 0,50 = 1,4 kW"] }, berekeningen: [{ naam: "P", formule: "E / t", waarde: 1.4, eenheid: "kW", afgerond: "1,4", tolerantie: 0.001 }] }), dv("strijk-b", { stam: "Noem een energiebron.", antwoordmodel: { regels: ["zon"] } })] };
    const fohn = { id: "fohn", soort: "vraagstuk", titel: "Föhn", se: "SE4.2", hoofdstuk: "E", context: ["Een föhn van 1400 W staat 0,25 h aan."], parameters: [{ naam: "P", waarde: 1400, bron: "tekst", eenheid: "W", weergave: "1400" }, { naam: "t", waarde: 0.25, bron: "tekst", eenheid: "h", weergave: "0,25" }],
      deelvragen: [dv("fohn-a", { stam: "Bereken de energie in kWh.", antwoordmodel: { regels: ["E = 1400 × 0,25 / 1000 = 0,35 kWh"] }, berekeningen: [{ naam: "E", formule: "P * t / 1000", waarde: 0.35, eenheid: "kWh", afgerond: "0,35", tolerantie: 0.001 }] }), dv("fohn-b", { stam: "Noem een apparaat.", antwoordmodel: { regels: ["lamp"] } })] };
    const vs = [strijk, fohn] as unknown as VraagstukSpec[];
    assert.ok(zoekGegevenWeggevers(vs).some((b) => b.gegeven === "1400 W"));
    const { gen, stappen } = autoHerstel({ vraagstukken: vs });
    const f = gen.vraagstukken[1]!;
    assert.equal(zoekGegevenWeggevers(gen.vraagstukken).length, 0);
    assert.match(f.context[0]!, /föhn van 1700 W/);
    assert.equal(f.parameters![0]!.waarde, 1700);
    assert.equal(f.deelvragen[0]!.berekeningen![0]!.afgerond, "0,43");
    assert.match(f.deelvragen[0]!.antwoordmodel.regels[0]!, /1700 × 0,25 \/ 1000 = 0,43 kWh/);
    assert.ok(stappen.some((s) => /gegeven-weggever/.test(s.wat)));
  });

  it("4c. lege tekenfiguur op vraagstukniveau, tekenvraag later (ronde 5, krat-duwen) → figuur naar de tekenvraag", () => {
    const v = krat();
    const leeg = v.deelvragen[0]!.figuur as KrachtenFiguur;
    v.figuur = { ...leeg, controle: [{ meting: "pijlen", verwacht: 0 }] };
    const [a, b, c] = v.deelvragen;
    v.deelvragen = [
      { ...b!, id: "krat-a" },
      { ...c!, id: "krat-b", antwoordmodel: { ...c!.antwoordmodel, juist: "A" } },
      { ...a!, id: "krat-c", figuur: undefined, tekenvraag: true, antwoordmodel: { regels: ["pijl van 4,0 cm omlaag"], figuur: { ...leeg, pijlen: [{ naam: "Fz", grootteN: 40, hoek: 270, rood: true }], controle: [{ meting: "Fz.N", verwacht: 40 }] } } },
    ];
    assert.ok(fouten(v).some((f) => /krat-a: tekenvraag zonder antwoordfiguur/.test(f)));
    const { v: w, stappen } = autoHerstelVraagstuk(v);
    assert.equal(w.figuur, undefined);
    assert.equal(w.deelvragen[2]!.figuur?.type, "krachten");
    assert.ok(stappen.some((s) => /verplaatst naar tekenvraag krat-c/.test(s.wat)));
    assert.deepEqual(fouten(w).filter((f) => /tekenvraag/.test(f)), []);
  });

  it("5. krachtenfiguur: kader past om voorwerp en pijlen (bloempot niet afgesneden, geen lege ruimte)", () => {
    const pot: KrachtenFiguur = { type: "krachten", breedteCm: 6, hoogteCm: 7, schaalN: 10, voorwerp: "bloempot", punt: [3, 5], puntLabel: "Z", pijlen: [] };
    const antw: KrachtenFiguur = { ...pot, pijlen: [{ naam: "Fz", grootteN: 20, hoek: 270, rood: true }] };
    const [l, a] = pasKrachtenKader([pot, antw])!;
    assert.equal(l!.punt[1] + 3.7 <= l!.hoogteCm, true); // plankje boven de pot valt binnen het kader
    assert.equal(l!.punt[1] - 2 >= 0, true); // pijl van 2 cm omlaag past
    assert.ok(l!.hoogteCm <= 7 && l!.breedteCm <= 6, `kader ${l!.breedteCm} × ${l!.hoogteCm}`);
    assert.deepEqual([l!.breedteCm, l!.hoogteCm, l!.punt], [a!.breedteCm, a!.hoogteCm, a!.punt]);
    assert.equal(pasKrachtenKader([l, a]), null); // idempotent
  });

  it("7. validatie: losse juiste letter bij open vraag weg, vraagtype/niveau aangevuld, afronding op significante cijfers", () => {
    const v = krat();
    const b = v.deelvragen[1]! as unknown as Record<string, unknown> & (typeof v.deelvragen)[number];
    b.antwoordmodel.juist = "B";
    delete (b as { vraagtype?: unknown }).vraagtype;
    v.deelvragen[0]!.niveau = "vooral GT";
    delete (b as { niveau?: unknown }).niveau;
    b.parameters = [{ naam: "Fz", waarde: 42, bron: "tekst", eenheid: "N", weergave: "42" }, { naam: "g", waarde: 9.8, bron: "binas", eenheid: "N/kg" }];
    b.berekeningen = [{ naam: "m", formule: "Fz / g", waarde: 42 / 9.8, eenheid: "kg", afgerond: "4,2857", tolerantie: 0.001 }];
    b.antwoordmodel.regels = ["m = 42 / 9,8 = 4,2857 kg"];
    assert.equal(afrondFouten([v]).length, 1);
    const { v: w, stappen } = autoHerstelVraagstuk(v);
    const wb = w.deelvragen[1]!;
    assert.equal(wb.antwoordmodel.juist, undefined);
    assert.equal(wb.vraagtype.code, "OVERIG");
    assert.equal(wb.niveau, "vooral GT");
    assert.equal(wb.berekeningen![0]!.afgerond, "4,3");
    assert.deepEqual(wb.antwoordmodel.regels, ["m = 42 / 9,8 = 4,3 kg"]);
    assert.equal(afrondFouten([w]).length, 0);
    assert.ok(!fouten(w).some((f) => /open vraag met een juiste letter/.test(f)));
    assert.ok(stappen.some((s) => /losse juiste letter/.test(s.wat)));
    assert.equal(rondSig(6.04, 2), "6,0");
    assert.equal(rondSig(1372, 2), null); // "1400": dubbelzinnig
    assert.equal(rondSig(0.01234, 2), "0,012");
  });

  it("6. reken: '1400' bij 1372 (2 sig. cijfers) en '1,4×10³' zijn goed afgerond", () => {
    assert.equal(leesNl("1,4×10³"), 1400);
    assert.equal(leesNl("2,0·10^2"), 200);
    const q = { stam: "x", antwoordmodel: { regels: ["s = 1372 m ≈ 1400 m (1,4×10³ m)"] }, scorestappen: [], parameters: [{ naam: "v", waarde: 343, bron: "binas" as const }, { naam: "t", waarde: 4, bron: "binas" as const }], berekeningen: [{ naam: "s", formule: "v * t", waarde: 1372, afgerond: "1400" }, { naam: "s2", formule: "v * t", waarde: 1372, afgerond: "1,4×10³" }] };
    assert.deepEqual(controleerBerekeningen(q as never).fouten.filter((f) => /past niet/.test(f)), []);
    q.berekeningen[0]!.afgerond = "1300";
    assert.ok(controleerBerekeningen(q as never).fouten.some((f) => /afgerond 1300 past niet/.test(f)));
  });

  it("7. begrip-bloklijst: hetzelfde begrip in te veel vraagstukken wordt gemeld; binnen één vraagstuk telt het één keer", () => {
    const mk = (id: string, stam: string): VraagstukSpec => {
      const v = toon();
      return { ...v, id, deelvragen: v.deelvragen.map((d, i) => ({ ...d, id: `${id}-${"abcd"[i]}`, stam: i === 0 ? stam : d.stam })) };
    };
    const a = mk("fabriek", "Noem een maatregel tegen geluidshinder bij de ontvanger.");
    const b = mk("feest", "Op welke plaats (bron, tussenstof of ontvanger) beperkt een oordop de geluidshinder?");
    const h = zoekBegripHerhaling([a, b]);
    assert.equal(h.length, 1);
    assert.match(h[0]!.tekst, /feest-a toetst opnieuw "maatregel tegen geluidshinder/);
    a.deelvragen[1]!.stam = "Noem nog een maatregel tegen geluidshinder bij de bron.";
    assert.equal(zoekBegripHerhaling([a]).length, 0); // zelfde vraagstuk
    assert.match(bloklijstRegel(geluidBron), /BEGRIPPEN-BLOKLIJST.*maatregel tegen geluidshinder.*\(1\)/);
    assert.equal(bloklijstRegel("3.1 Krachten\nFz = m × g"), "BEGRIPPEN-BLOKLIJST (worden vaak herhaald): elk hoogstens in zoveel vraagstukken van de HELE toets (ook niet in andere woorden), en binnen een vraagstuk niet twee keer dezelfde redenering: zwaartekracht berekenen (Fz = m × g) (2).");
  });

  it("8. dekking: kernwoorden van 13.4 overleven het filter (samenstelling 'geluidssnelheid' → 'snelheid')", () => {
    const k = paragraafKern(geluidBron);
    assert.ok(k.get("13.4")!.includes("geluidssnelheid") && k.get("13.4")!.includes("snelheid"), JSON.stringify(k.get("13.4")));
    assert.ok(!k.get("13.4")!.some((w) => ["nodig", "zich", "tijd"].includes(w)));
    const d = (stam: string, leerdoel: string) => ({ stam, leerdoel, antwoordmodel: { regels: [] } }) as never;
    assert.equal(raaktKern(d("Hoe lang mag je veilig in 89 dB blijven?", "13.4 geluid heeft tijd nodig"), k.get("13.4")), false);
    assert.equal(raaktKern(d("Bereken de afstand tot het onweer. De geluidssnelheid is 343 m/s.", "13.4 afstand"), k.get("13.4")), true);
  });

  it("9. lengte: de eerste generatie mikt op ~115 % (110–120); twee vraagstukken per paragraaf; bloklijst in de prompt", () => {
    const inv: SpecInvoer = { titel: "H13 Geluid", leerweg: "GT", leerjaar: 4, duurMinuten: 45, bronmateriaal: geluidBron, rttiDoel: { R: 15, T1: 45, T2: 34, I: 6 } };
    const p = specPrompt(inv, { items: 20, punten: 28 });
    assert.match(p, /LENGTE: totaal 32 punten \(minimaal 31, maximaal 33\) verdeeld over ongeveer 23 deelvragen \(minimaal 22\)/);
    assert.match(p, /minstens TWEE verschillende vraagstukken/);
    assert.match(p, /BEGRIPPEN-BLOKLIJST/);
  });

  it("10. onderwerp in het docentdeel: hoofdstuknaam i.p.v. een kaal nummer", () => {
    assert.equal(hoofdstukNaam("3", "Hoofdstuk 3 Krachten (NaSk 1 GT, leerjaar 3)\n3.1 …"), "H3 Krachten");
    assert.equal(hoofdstukNaam("H13", "Hoofdstuk 11 Kracht\nHoofdstuk 13 Geluid\n13.1 …"), "H13 Geluid");
    assert.equal(hoofdstukNaam("13 Geluid", "x"), "13 Geluid");
    assert.equal(hoofdstukNaam("6", "6.1 Geluid maken"), "H6");
    const inv: SpecInvoer = { titel: "H3", leerweg: "GT", leerjaar: 3, duurMinuten: 45, bronmateriaal: "Hoofdstuk 3 Krachten\n3.1 Soorten\nx", rttiDoel: { R: 25, T1: 40, T2: 27, I: 8 } };
    const r = keurGeneratie({ titel: "x", vraagstukken: [autoHerstelVraagstuk(krat()).v] }, inv, { items: 3, punten: 6 });
    assert.ok(r.res.vragen.every((q) => q.hoofdstuk === "H3 Krachten"));
  });

  it("11. xAI-5xx: één keer opnieuw, telt niet als gerichte aanroep; auto-fixes vóór de eerste keuring", async () => {
    assert.equal(isServerfout(new Error('xAI API error 500: {"code":"internal"}')), true);
    assert.equal(isServerfout(new Error("rondekosten: budget")), false);
    const inv: SpecInvoer = { titel: "H3", leerweg: "GT", leerjaar: 3, duurMinuten: 45, bronmateriaal: "Hoofdstuk 3 Krachten\n3.1 Soorten\nx", rttiDoel: { R: 25, T1: 40, T2: 27, I: 8 } };
    let n = 0;
    const chat: ChatFn = async (_m, schema) => {
      n++;
      if (schema.naam === "toets_spec" && n === 1) throw new Error("xAI API error 503: unavailable");
      return JSON.stringify({ titel: "x", vraagstukken: [krat()] });
    };
    const g = await genereerSpec(inv, { items: 3, punten: 6 }, chat);
    assert.equal(n, 2);
    assert.equal(g.gerichteAanroepen, 0);
    assert.ok(g.stappen.some((s) => /xAI-serverfout, opnieuw/.test(s.wat)));
    assert.ok(g.eersteRuw.fouten.some((f) => /meerkeuze zonder juiste letter|tekenvraag zonder antwoordfiguur/.test(f)));
    assert.deepEqual(g.eerste.fouten.filter((f) => /meerkeuze zonder juiste letter|tekenvraag zonder antwoordfiguur/.test(f)), []);
    assert.ok(g.stappen.filter((s) => s.wat.startsWith("auto:")).length >= 2);
    assert.equal(autoHerstel({ vraagstukken: [] }).stappen.length, 0);
  });
});
