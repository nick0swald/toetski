/**
 * Word–PDF-pariteit van de stap-0-export: leerling- en docentdeel bevatten in PDF en Word dezelfde vragen, figuren en
 * antwoordfiguren, onderwerplabels, toetsmatrijs en cijferberekening (met grafiek). Offline (pdfjs + jszip).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { maakDocxs } from "./export-docx.ts";
import { maakPdfs } from "./export-pdf.ts";
import { opmaakVoor, type Generatie, type SpecInvoer } from "./grok-spec.ts";
import { laadFixtures, laadVoorbeeldtoets } from "./laad.ts";
import { pngRender, stap0Fonts } from "./node.server.ts";
import { verwerkToets, type Pijplijnresultaat } from "./pijplijn.ts";
import type { ToetsSpec, VraagstukSpec } from "./spec.ts";

async function pdfInfo(b: Uint8Array) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(b), useSystemFonts: false }).promise;
  let tekst = "";
  let beelden = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const tc = await p.getTextContent();
    tekst += tc.items.map((x) => ("str" in x ? x.str + (x.hasEOL ? "\n" : "") : "")).join("") + "\n";
    beelden += (await p.getOperatorList()).fnArray.filter((f) => f === pdfjs.OPS.paintImageXObject).length;
  }
  return { tekst, beelden };
}
async function docxInfo(b: Uint8Array) {
  const xml = await (await JSZip.loadAsync(b)).file("word/document.xml")!.async("string");
  const tekst = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  return { tekst, beelden: (xml.match(/<w:drawing>/g) ?? []).length };
}
/** Alleen letters en cijfers (opmaak, sub/sup, regelafbreking en symboolfont tellen niet). */
const plat = (s: string) => s.replace(/<[^>]+>/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const tel = (s: string, re: RegExp) => (s.match(re) ?? []).length;

async function vergelijk(toets: ToetsSpec, res: Pijplijnresultaat) {
  const pdf = await maakPdfs(toets, res, stap0Fonts(), pngRender);
  const docx = await maakDocxs(toets, res, pngRender);
  const L = { pdf: await pdfInfo(pdf.leerling), docx: await docxInfo(docx.leerling) };
  const D = { pdf: await pdfInfo(pdf.docent), docx: await docxInfo(docx.docent) };
  // Figuren (leerlingdeel) en figuren + antwoordfiguren + cijfergrafiek (docentdeel): even veel beelden.
  assert.equal(L.docx.beelden, L.pdf.beelden, "leerlingdeel: aantal figuren PDF ≠ Word");
  assert.equal(D.docx.beelden, D.pdf.beelden, "docentdeel: aantal figuren PDF ≠ Word");
  assert.ok(D.pdf.beelden > L.pdf.beelden, "docentdeel heeft ook antwoordfiguren en de cijfergrafiek");
  // Voorbladen.
  assert.equal(tel(L.docx.tekst, /Behaalde punten/g), tel(L.pdf.tekst, /Behaalde punten/g), "aantal voorbladen");
  // Elke vraag (begin van de stam) in beide delen, in beide formaten; antwoordmodel in het docentdeel.
  const lp = plat(L.pdf.tekst), ld = plat(L.docx.tekst), dp = plat(D.pdf.tekst), dd = plat(D.docx.tekst);
  for (const q of res.vragen) {
    const s = plat(q.stam).slice(0, 30);
    assert.ok(lp.includes(s) && ld.includes(s), `vraag ${q.nr} niet in beide leerlingdelen: ${s}`);
    assert.ok(dp.includes(s) && dd.includes(s), `vraag ${q.nr} niet in beide docentdelen: ${s}`);
    const a = plat(q.antwoordmodel.regels[0] ?? "").slice(0, 20);
    if (a) assert.ok(dp.includes(a) && dd.includes(a), `antwoordmodel ${q.nr} niet in beide: ${a}`);
  }
  // Onderwerplabels, matrijs, cijferberekening.
  assert.equal(tel(D.docx.tekst, /Onderwerp:/g), tel(D.pdf.tekst, /Onderwerp:/g), "onderwerplabels");
  assert.equal(tel(D.pdf.tekst, /Onderwerp:/g), res.vragen.length);
  for (const kop of ["Toetsmatrijs", "Totaal per RTTI-categorie", "Totaal per examenniveau", "Cijferberekening", "Register"]) {
    assert.ok(D.pdf.tekst.includes(kop) && D.docx.tekst.includes(kop), `kop "${kop}" niet in beide`);
  }
  const ces = /Cesuur \(laagste voldoende\):\s*(\d+) punten/;
  assert.equal(ces.exec(D.docx.tekst)?.[1], ces.exec(D.pdf.tekst)?.[1], "cesuur");
  assert.ok(ces.exec(D.pdf.tekst)?.[1]);
}

test("pariteit Word–PDF: voorbeeldtoets (één leerlingdeel) en gesplitst (deel A/B)", async () => {
  const fixtures = laadFixtures();
  const toets = laadVoorbeeldtoets();
  await vergelijk(toets, verwerkToets(toets, fixtures));
  const ids = toets.vragen;
  const ab = { ...toets, delen: [{ naam: "Deel A", vragen: ids.slice(0, 6) }, { naam: "Deel B", vragen: ids.slice(6) }] };
  await vergelijk(ab, verwerkToets(ab, fixtures));
});

test("pariteit Word–PDF: stap-0-generatie via opmaakVoor (standaard één voorblad, op verzoek A/B)", async () => {
  const vs = laadFixtures().filter((f): f is VraagstukSpec & { soort: "vraagstuk" } => f.soort === "vraagstuk");
  // Minstens drie vraagstukken (kopieën met eigen ids) zodat splitsen in A/B kan.
  const kopie = (v: VraagstukSpec, n: number): VraagstukSpec => ({ ...structuredClone(v), id: `${v.id}-${n}`, deelvragen: v.deelvragen.map((d) => ({ ...structuredClone(d), id: `${d.id}-${n}` })) });
  const gen: Generatie = { titel: "Pariteit", vraagstukken: [0, 1, 2].flatMap((n) => vs.map((v) => kopie(v, n))) };
  const inv: SpecInvoer = { titel: "Pariteit", leerweg: "GT", leerjaar: 4, duurMinuten: 45, bronmateriaal: "Hoofdstuk 3 Krachten\n3.1 x", rttiDoel: { R: 15, T1: 45, T2: 34, I: 6 } };
  const een = opmaakVoor(gen, inv);
  assert.equal(een.res.delen.length, 1);
  await vergelijk(een.toets, een.res);
  const twee = opmaakVoor(gen, inv, { splitsen: true });
  assert.deepEqual(twee.res.delen.map((d) => d.naam), ["Deel A", "Deel B"]);
  assert.equal(twee.res.delen.flatMap((d) => d.nrs).length, twee.res.vragen.length);
  await vergelijk(twee.toets, twee.res);
});
