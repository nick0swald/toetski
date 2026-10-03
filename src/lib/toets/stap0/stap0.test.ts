/**
 * Stap 0: deterministische pijplijn — schema, rekencontroles, figuurkeuring (go/no-go),
 * PNG-snapshots tegen de Python-referenties, cijferberekening en de twee exportdelen.
 * Volledig offline: geen API-aanroepen.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { cesuur, cijferGrafiekSvg, cijferN, cijferTabel, controleerCijfers, leesCijferGrafiek } from "./cijfer-n.ts";
import { maakDocxs } from "./export-docx.ts";
import { maakPdfs } from "./export-pdf.ts";
import { figuurSvg, keurFiguur, meetFiguur, paramMap } from "./figuren/index.ts";
import { laadFixtures, laadVoorbeeldtoets, STAP0_DIR } from "./laad.ts";
import { pngRender, stap0Fonts } from "./node.server.ts";
import { verwerkToets } from "./pijplijn.ts";
import { decodeerPng, vergelijkInkt } from "./png-vergelijk.ts";
import { controleerBerekeningen } from "./reken.ts";
import { SPEC_SCHEMA } from "./spec-schema.ts";
import type { Fixture, VraagSpec } from "./spec.ts";
import { valideerSpec, valideerToets } from "./valideer.ts";
import { formuleringCSE, voorbladTekst } from "./opmaak.ts";
import { keurAiAfbeelding } from "./figuren/ai-afbeelding.ts";
import { leesSvg, paneelKolommen } from "./figuren/svg.ts";

const kloon = <T>(x: T): T => structuredClone(x);
const fixtures = laadFixtures();
/** Splitsing in leerlingdelen alleen als de toetsspec erom vraagt; de voorbeeldtoets is standaard niet gesplitst. */
const DELEN_AB = [
  { naam: "Deel A", vragen: ["se41-bloempot", "se41-boomstam", "se41-krat", "se41-bakfiets", "se42-sleutelhanger", "se42-toongenerator"] },
  { naam: "Deel B", vragen: ["se43-stoelverwarming", "se43-afzuigkap", "se43-sanne", "se44-tram", "se44-skeeler", "alg-lampje"] },
];
const gesplitst = () => ({ ...laadVoorbeeldtoets(), delen: kloon(DELEN_AB) });
const fx = (id: string) => kloon(fixtures.find((f) => f.id === id)!) as Fixture;

test("10–15 fixtures, elk geldig volgens schema + regels", () => {
  assert.ok(fixtures.length >= 10 && fixtures.length <= 15, `${fixtures.length} fixtures`);
  for (const f of fixtures) assert.deepEqual(valideerSpec(f), [], f.id);
  const types = new Set(fixtures.flatMap((f) => [f.figuur?.type, ...("deelvragen" in f ? f.deelvragen.map((d) => d.figuur?.type) : [])]).filter(Boolean));
  assert.deepEqual([...types].sort(), ["ai-afbeelding", "grafiek", "krachten", "maatcilinder", "oscilloscoop", "schakelschema"]);
});

test("spec.schema.json is gelijk aan SPEC_SCHEMA", () => {
  assert.deepEqual(JSON.parse(readFileSync(join(STAP0_DIR, "spec.schema.json"), "utf8")), SPEC_SCHEMA);
});

test("schema/regels vangen fouten", () => {
  const q = fx("se43-sanne") as VraagSpec & { soort: "vraag" };
  q.punten += 1;
  assert.ok(valideerSpec(q).some((e) => /punten|scorestappen/i.test(e)));
  const r = fx("se43-sanne") as unknown as Record<string, unknown>;
  delete r.stam;
  assert.ok(valideerSpec(r).length > 0);
});

test("toetsspec: elke vraag in precies één leerlingdeel", () => {
  assert.deepEqual(valideerToets(laadVoorbeeldtoets(), fixtures.map((f) => f.id)), []);
  const t = gesplitst();
  assert.deepEqual(valideerToets(t, fixtures.map((f) => f.id)), []);
  const fout = kloon(t);
  fout.delen![1].vragen.push(fout.delen![0].vragen[0]);
  assert.ok(valideerToets(fout, fixtures.map((f) => f.id)).length > 0);
});

test("pijplijn: alle vragen GO, nummering en delen", () => {
  const res = verwerkToets(laadVoorbeeldtoets(), fixtures);
  assert.deepEqual(res.afgekeurd, []);
  assert.deepEqual(res.toetsFouten, []);
  assert.equal(res.vragen.length, 15);
  assert.deepEqual(res.vragen.map((q) => q.nr), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(laadVoorbeeldtoets().delen, undefined, "standaard geen splitsing");
  assert.deepEqual(res.delen.map((d) => [d.naam, d.nrs[0], d.nrs.at(-1)]), [["", 1, 15]]);
  const ab = verwerkToets(gesplitst(), fixtures);
  assert.deepEqual(ab.delen.map((d) => [d.naam, d.nrs[0], d.nrs.at(-1)]), [["Deel A", 1, 9], ["Deel B", 10, 15]]);
  assert.equal(res.vragen.reduce((s, q) => s + q.punten, 0), 31);
});

test("rekencontrole vangt een verkeerde uitkomst en een verkeerd afgerond antwoord", () => {
  const q = fx("se42-sleutelhanger") as VraagSpec & { soort: "vraag" };
  assert.equal(controleerBerekeningen(q).ok, true);
  const a = kloon(q);
  a.berekeningen![1].waarde = 8.1;
  assert.equal(controleerBerekeningen(a).ok, false);
  const b = kloon(q);
  b.berekeningen![1].afgerond = "7,7";
  assert.equal(controleerBerekeningen(b).ok, false);
  const c = kloon(q);
  c.parameters![0].waarde = 64; // staat zo niet in de tekst
  assert.equal(controleerBerekeningen(c).ok, false);
});

test("figuurkeuring: de getekende waarde wordt teruggemeten; een afwijking is no-go", () => {
  const q = fx("se42-sleutelhanger") as VraagSpec & { soort: "vraag" };
  const p = paramMap(q.parameters);
  assert.equal(keurFiguur(q.figuur!, p).go, true);
  const m = meetFiguur(q.figuur!, figuurSvg(q.figuur!));
  assert.equal(m.niveau1, 30);
  assert.equal(m.niveau2, 38);
  const f = kloon(q.figuur!) as Extract<typeof q.figuur, { type: "maatcilinder" }>;
  f!.cilinders[1].niveau = 39;
  assert.equal(keurFiguur(f!, p).go, false);
});

test("4 panelen (meerkeuze A–D) altijd als 2 × 2, even groot", () => {
  const toon = fx("se42-toongenerator");
  assert.ok("deelvragen" in toon);
  for (const f of [toon.deelvragen[2].figuur!, (fx("se44-skeeler") as VraagSpec).figuur!]) {
    const els = leesSvg(figuurSvg(f));
    const vakken = els.filter((e) => e.attrs["data-rol"] === (f.type === "oscilloscoop" ? "scherm" : "assen")).map((e) => ["x", "y", "width", "height"].map((k) => Number(e.attrs[k])));
    assert.equal(vakken.length, 4, f.type);
    const xs = [...new Set(vakken.map((v) => v[0].toFixed(1)))];
    const ys = [...new Set(vakken.map((v) => v[1].toFixed(1)))];
    assert.equal(xs.length, 2, `${f.type}: 2 kolommen`);
    assert.equal(ys.length, 2, `${f.type}: 2 rijen`);
    assert.ok(vakken.every((v) => Math.abs(v[2] - vakken[0][2]) < 0.01 && Math.abs(v[3] - vakken[0][3]) < 0.01), `${f.type}: even groot`);
    // Volgorde A B / C D: A links boven, D rechts onder.
    assert.ok(vakken[0][0] < vakken[1][0] && vakken[0][1] === vakken[1][1] && vakken[2][1] > vakken[0][1] && vakken[3][0] > vakken[2][0]);
  }
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(paneelKolommen), [1, 2, 3, 2, 3, 3]);
  assert.doesNotMatch(JSON.stringify(fixtures), /eerste figuur/);
});

test("figuurkeuring per type: oscilloscoop, schakelschema, grafiek, krachten", () => {
  const toon = fx("se42-toongenerator");
  assert.ok("deelvragen" in toon);
  const pT = paramMap(toon.parameters);
  assert.equal(keurFiguur(toon.figuur!, pT).go, true);
  const mo = meetFiguur(toon.figuur!, figuurSvg(toon.figuur!));
  assert.ok(Math.abs(mo.T - 4) < 0.05, `T = ${mo.T} hokjes`);

  const stoel = fx("se43-stoelverwarming") as VraagSpec;
  const ms = meetFiguur(stoel.figuur!, figuurSvg(stoel.figuur!));
  assert.equal(ms.R1, 40);
  assert.equal(ms.R2, 120);
  assert.equal(ms.stippen, 2);
  assert.equal(keurFiguur(stoel.figuur!, { ...paramMap(stoel.parameters), R1: 50 }).go, false);

  const tram = fx("se44-tram") as VraagSpec;
  assert.equal(keurFiguur(tram.figuur!, paramMap(tram.parameters)).go, true);

  const pot = fx("se41-bloempot") as VraagSpec;
  const af = pot.antwoordmodel.figuur!;
  const mk = meetFiguur(af, figuurSvg(af));
  assert.ok(Math.abs(mk["Fz.lengteCm"] - 3) < 0.02, `pijl ${mk["Fz.lengteCm"]} cm`);
  assert.ok(Math.abs(mk["Fz.N"] - 60) < 0.5);
});

test("PNG-snapshots: TS-render ≈ Python-referentie (inktvergelijking)", async () => {
  const res = verwerkToets(laadVoorbeeldtoets(), fixtures);
  const refDir = join(STAP0_DIR, "__ref__");
  const refs = readdirSync(refDir).filter((f) => f.endsWith(".png"));
  assert.equal(refs.length, 16);
  for (const k of res.keuringen) {
    for (const [i, fig] of k.figuren.entries()) {
      if (fig.type === "ai-afbeelding") continue; // placeholder, geen Python-referentie
      const naam = `${k.id}-${i}-${fig.rol}.png`;
      assert.ok(refs.includes(naam), `referentie ontbreekt: ${naam}`);
      const ref = decodeerPng(readFileSync(join(refDir, naam)));
      const breedtePt = Number(/viewBox="0 0 ([\d.]+)/.exec(fig.svg)?.[1] ?? /width="([\d.]+)/.exec(fig.svg)![1]);
      const ts = decodeerPng(await pngRender(fig.svg, Math.round((breedtePt / 72) * 200)));
      const v = vergelijkInkt(ts, ref);
      assert.ok(v.score >= 0.8, `${naam}: score ${v.score.toFixed(3)}`);
      assert.ok(v.verhouding >= 0.9 && v.verhouding <= 1.1, `${naam}: verhouding ${v.verhouding.toFixed(3)}`);
    }
  }
});

test("cijfer: standaard 1 + 9 · score / max, 1 decimaal", () => {
  assert.equal(cijferN(0, 31), 1.0);
  assert.equal(cijferN(31, 31), 10.0);
  assert.equal(cijferN(17, 31), 5.9); // 5,935…
  assert.equal(cijferN(16, 31), 5.6); // 5,645…
  assert.equal(cijferN(3, 20), 2.4); // 2,35 → half naar boven
  assert.equal(cijferN(10, 20), 5.5);
  assert.equal(cesuur(31), 16);
  const t = cijferTabel(31);
  assert.equal(t.length, 32);
  for (const { score, cijfer } of t) assert.equal(cijfer, Math.round((1 + (9 * score) / 31) * 10 + 1e-9) / 10, `score ${score}`);
});

test("cijfer: N-term met CvTE-grenzen", () => {
  assert.equal(cijferN(0, 31, 2), 1.0); // ≤ 1 + 2·9S/L
  assert.equal(cijferN(31, 31, 2), 10.0);
  assert.equal(cijferN(15, 31, 1.5), Math.round(((9 * 15) / 31 + 1.5) * 10) / 10);
  assert.equal(cijferN(31, 31, 0.5), 10.0);
  assert.equal(cijferN(0, 31, 0.5), 1.0);
  assert.equal(cijferN(2, 40, 0.2), Math.round(Math.max((9 * 2) / 40 + 0.2, 1 + 2 * (9 / 40) * 0.5) * 10) / 10);
  for (const n of [0.3, 1, 1.4, 2.5]) assert.deepEqual(controleerCijfers(31, n), [], `N = ${n}`);
});

test("cijfergrafiek: deterministisch en de punten liggen op de tabel", () => {
  const svg = cijferGrafiekSvg(31, 1);
  assert.equal(svg, cijferGrafiekSvg(31, 1));
  const g = leesCijferGrafiek(svg);
  assert.equal(g.length, 32);
  assert.deepEqual(g[0], [0, 1]);
  assert.deepEqual(g[17], [17, 5.9]);
  assert.deepEqual(g[31], [31, 10]);
  assert.deepEqual(leesCijferGrafiek(cijferGrafiekSvg(20, 1.5))[10], [10, cijferN(10, 20, 1.5)]);
});

test("export: leerlingdeel zonder antwoorden, docentdeel met sleutel, matrijs en cijfers; < 2 s", async () => {
  const toets = laadVoorbeeldtoets();
  await maakPdfs(toets, verwerkToets(toets, fixtures), stap0Fonts(), pngRender); // opwarmen (wasm + fonts), zoals een warme server
  const t0 = performance.now();
  const res = verwerkToets(toets, fixtures);
  const pdf = await maakPdfs(toets, res, stap0Fonts(), pngRender);
  const ms = performance.now() - t0;
  const tekst = (b: Uint8Array) => Buffer.from(b).toString("latin1");
  assert.match(tekst(pdf.leerling.slice(0, 8)), /^%PDF-1\./);
  assert.equal(pdf.leerlingDelen.length, 0, "standaard geen losse delen");
  // pdfkit zet tekst als hex-glyphs; daarom de structuur via de documentinfo + paginatelling controleren
  const paginas = (b: Uint8Array) => (tekst(b).match(/\/Type \/Page\b/g) ?? []).length;
  assert.ok(paginas(pdf.docent) > paginas(pdf.leerling));
  assert.ok(ms < 2000, `export duurde ${ms.toFixed(0)} ms`);
  // Inhoud: alleen als poppler (pdftotext) aanwezig is
  if (spawnSync("pdftotext", ["-v"]).status === 0) {
    const dir = mkdtempSync(join(tmpdir(), "stap0-"));
    const lees = (b: Uint8Array, n: string) => {
      writeFileSync(join(dir, n), b);
      return spawnSync("pdftotext", ["-layout", join(dir, n), "-"], { encoding: "utf8" }).stdout;
    };
    const l = lees(pdf.leerling, "l.pdf");
    const d = lees(pdf.docent, "d.pdf");
    for (const x of ["Naam", "Klas", "Datum", "Extra tijd 20%", "Behaalde punten", "Cijfer", "Gebruik het BINAS informatieboek.", "Deze toets bestaat uit 15 vragen.", "Voor deze toets zijn maximaal 31 punten te behalen.", "Meerkeuzevragen", "Open vragen", "Toongenerator", "einde", "→"]) assert.ok(l.includes(x), `leerling mist "${x}"`);
    // Standaard één leerlingdeel met één voorblad.
    assert.equal(l.split("Behaalde punten").length - 1, 1, "precies één voorblad");
    assert.doesNotMatch(l, /Deel A|Deel B|Dit deel/);
    // Gesplitst alleen op verzoek van de toetsspec: twee voorbladen.
    const tAB = gesplitst();
    const pAB = await maakPdfs(tAB, verwerkToets(tAB, fixtures), stap0Fonts(), pngRender);
    assert.equal(pAB.leerlingDelen.length, 2);
    const lab = lees(pAB.leerling, "lab.pdf");
    assert.equal(lab.split("Behaalde punten").length - 1, 2, "twee voorbladen");
    for (const x of ["Deel A · vraag 1–9", "Deel B · vraag 10–15", "Dit deel bestaat uit 9 vragen.", "Dit deel bestaat uit 6 vragen.", "Deze toets bestaat uit twee delen"]) assert.ok(lab.includes(x), `gesplitst mist "${x}"`);
    assert.doesNotMatch(l, /Antwoordmodel|Toetsmatrijs|Cijferberekening|maximumscore|Type \d+ ·/);
    for (const kop of ["Antwoordmodel", "Toetsmatrijs", "Totaal per SE-toets", "Totaal per RTTI-categorie", "Cijferberekening", "cijfer tegen score"]) assert.match(d, new RegExp(kop));
  }
  const docx = await maakDocxs(toets, res, pngRender);
  assert.ok(docx.leerling.byteLength > 1000 && docx.docent.byteLength > docx.leerling.byteLength);
});

test("CSE-formulering: elke vraag in alle fixtures", () => {
  for (const f of fixtures) {
    const qs = "deelvragen" in f ? f.deelvragen.map((d) => ({ ...d, context: [...f.context, ...(d.context ?? [])] })) : [f];
    for (const q of qs) assert.deepEqual(formuleringCSE(q), [], `${f.id}/${q.id}`);
  }
  assert.ok(formuleringCSE({ stam: "Hoeveel hokjes is het? Leg je antwoord uit." }).length > 0);
  assert.ok(formuleringCSE({ stam: "Bereken de druk.", context: ["Sanne bouwt de schakeling hieronder."] }).length > 0);
  assert.ok(formuleringCSE({ stam: "Wat gebeurt er?", opties: ["L1 gaat uit.", "L1 blijft branden"] }).length > 0);
});

test("ai-afbeelding: schema, alleen als situatieplaatje, placeholder zonder beeld-API", () => {
  const bak = fx("se41-bakfiets") as VraagSpec;
  assert.equal(bak.figuur?.type, "ai-afbeelding");
  const svg = figuurSvg(bak.figuur!);
  assert.match(svg, /data-ai-afbeelding="foto"/);
  assert.match(svg, /stroke-dasharray/);
  // Een meetvraag of meetwaarden in de beschrijving: no-go.
  const f = bak.figuur as Extract<typeof bak.figuur, { type: "ai-afbeelding" }>;
  assert.deepEqual(keurAiAfbeelding(f!, bak), []);
  assert.ok(keurAiAfbeelding(f!, { stam: "Lees af hoe lang de bakfiets is.", parameters: [] }).length > 0);
  assert.ok(keurAiAfbeelding({ ...f!, beschrijving: "Een bakfiets van 2,4 m lang op een weg met 12 cm² contact." }, bak).length > 0);
  assert.ok(keurAiAfbeelding(f!, { stam: "Bereken de druk.", parameters: [{ naam: "A", waarde: 12, bron: "figuur" }] }).length > 0);
  // Schema: geen `controle` toegestaan; antwoordfiguur mag geen AI-afbeelding zijn.
  const metControle = kloon(bak) as unknown as { figuur: Record<string, unknown> };
  metControle.figuur.controle = [{ meting: "x", verwacht: 1 }];
  assert.ok(valideerSpec(metControle).length > 0);
  const alsAntwoord = kloon(bak);
  alsAntwoord.antwoordmodel.figuur = bak.figuur;
  assert.ok(valideerSpec(alsAntwoord).some((e) => /AI-afbeelding/.test(e)));
  // In de pijplijn: GO als placeholder.
  const res = verwerkToets(laadVoorbeeldtoets(), fixtures);
  const k = res.keuringen.find((x) => x.id === "se41-bakfiets")!;
  assert.equal(k.ok, true);
  assert.equal(k.figuren[0].type, "ai-afbeelding");
});

test("voorblad: velden van de schooltoetsen + leerlingblad, geen schoolnaam, schoolveld standaard leeg", () => {
  const t = gesplitst();
  const res = verwerkToets(t, fixtures);
  const deelA = res.delen[0];
  const qs = res.vragen.filter((q) => deelA.nrs.includes(q.nr));
  const v = voorbladTekst(t, qs, deelA, res.delen, "5,5 bij 16 van de 31 punten");
  assert.equal(v.schoolveld, "");
  assert.match(v.kop, /^Toets .* VMBO-GL en TL$/);
  assert.equal(v.schooljaar, "2026-2027");
  assert.deepEqual(v.rechts, ["SE4", "Deel A · vraag 1–9", "voorbeeld stap 0", "90 minuten"]);
  assert.match(v.balk, /^natuur- en scheikunde 1/);
  assert.deepEqual(v.onder, ["Dit deel bestaat uit 9 vragen.", "Voor dit deel zijn maximaal 19 punten te behalen.", "Voor elk vraagnummer staat hoeveel punten met een goed antwoord behaald kunnen worden."]);
  const metSchool = voorbladTekst({ ...t, voorblad: { ...t.voorblad, schoolveld: "Sectie NaSk — mevr. Jansen" } }, qs, null, [res.delen[0]], "");
  assert.equal(metSchool.schoolveld, "Sectie NaSk — mevr. Jansen");
  assert.equal(metSchool.onder[0], "Deze toets bestaat uit 9 vragen.");
  const std = verwerkToets(laadVoorbeeldtoets(), fixtures);
  const v1 = voorbladTekst(laadVoorbeeldtoets(), std.vragen, null, std.delen, "");
  assert.deepEqual(v1.rechts, ["SE4", "voorbeeld stap 0", "90 minuten"]);
  assert.equal(v1.delenZin, "");
  assert.equal(v1.onder[0], "Deze toets bestaat uit 15 vragen.");
});
