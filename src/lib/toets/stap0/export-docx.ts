/**
 * Leerling- en docentdeel als Word-bestand (docx), zelfde indeling als de PDF. Hergebruikt de pagina-instellingen en
 * paginanummering van de bestaande Word-export (docx-export.ts).
 */
import { AlignmentType, BorderStyle, Document, ImageRun, Packer, PageBreak, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } from "docx";
import type { FiguurSpec, OpmaakVraag, SeCode, ToetsSpec } from "./spec.ts";
import type { Pijplijnresultaat } from "./pijplijn.ts";
import type { PngRender } from "./export-pdf.ts";
import { figuurSvg } from "./figuren/index.ts";
import { cijferGrafiekSvg, cijferTabel, cesuur, formule } from "./cijfer-n.ts";
import { nlCijfer } from "../cijfer.ts";
import { PAGE_A4, PAGE_MARGINS, pageNumberChrome } from "../docx-pagina.ts";
import { antwoordKop, bandTekst, contextTitel, indelingKop, INSTRUCTIE_CSE, INVULVELDEN, jaarVan, matrijsTotalen, voorbladTekst, rttiRegel, SE_INFO, SE_ORDE, seLabel, seOmschrijving, UITLEG_DOCENT, uitlegIndeling, vraagstukBereik } from "./opmaak.ts";

type Kind = Paragraph | Table;
const FONT = "Arial";
const TW = 9070; // twips tekstbreedte (A4, marges 2,5 cm)
const IND = 1020; // 1,8 cm
const hex = (c: string) => c.replace("#", "");
const GEEN = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const geenRand = { top: GEEN, bottom: GEEN, left: GEEN, right: GEEN };

/** Markup (<b>, <i>, <sub>, <sup>, <br/>, <small>, <font color>) → TextRuns. */
function runs(markup: string, basis: { size?: number; bold?: boolean; kleur?: string } = {}): TextRun[] {
  const out: TextRun[] = [];
  let bold = !!basis.bold, italic = false, sub = false, sup = false, small = false;
  const kleuren = [basis.kleur ?? "000000"];
  const re = /<(\/?)(b|i|sub|sup|small|font|br)\b([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    if (m[4] !== undefined) {
      out.push(new TextRun({ text: m[4], font: FONT, bold, italics: italic, subScript: sub, superScript: sup, size: Math.round((basis.size ?? 21) * (small ? 0.85 : 1)), color: kleuren[kleuren.length - 1] }));
      continue;
    }
    const open = !m[1];
    switch (m[2]) {
      case "b": bold = open || !!basis.bold; break;
      case "i": italic = open; break;
      case "sub": sub = open; break;
      case "sup": sup = open; break;
      case "small": small = open; break;
      case "br": out.push(new TextRun({ break: 1 })); break;
      case "font":
        if (open) kleuren.push(hex(/color="([^"]+)"/.exec(m[3])?.[1] ?? "#000000"));
        else if (kleuren.length > 1) kleuren.pop();
    }
  }
  return out;
}

const para = (markup: string, o: { size?: number; bold?: boolean; kleur?: string; na?: number; voor?: number; links?: number; midden?: boolean; rechts?: boolean; lijnOnder?: boolean; bijVolgende?: boolean } = {}) =>
  new Paragraph({
    keepNext: o.bijVolgende || undefined,
    children: runs(markup, o),
    spacing: { after: o.na ?? 60, before: o.voor ?? 0 },
    indent: o.links ? { left: o.links } : undefined,
    alignment: o.midden ? AlignmentType.CENTER : o.rechts ? AlignmentType.RIGHT : undefined,
    border: o.lijnOnder ? { bottom: { style: BorderStyle.SINGLE, size: 32, color: "BFBFBF", space: 2 } } : undefined,
  });

function cel(kinderen: Kind[], o: { w: number; bg?: string; rand?: boolean; va?: boolean } = { w: 1000 }) {
  return new TableCell({
    children: kinderen.length ? kinderen : [new Paragraph({})],
    width: { size: o.w, type: WidthType.DXA },
    shading: o.bg ? { type: ShadingType.CLEAR, color: "auto", fill: hex(o.bg) } : undefined,
    borders: o.rand ? undefined : geenRand,
    verticalAlign: o.va ? VerticalAlign.CENTER : VerticalAlign.TOP,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
  });
}

function tabel(rijen: TableCell[][], kolommen: number[], rand?: { kleur: string; size: number }): Table {
  const b = rand ? { style: BorderStyle.SINGLE, size: rand.size, color: hex(rand.kleur) } : GEEN;
  return new Table({
    width: { size: kolommen.reduce((a, c) => a + c, 0), type: WidthType.DXA },
    columnWidths: kolommen,
    borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: rand ? b : GEEN, insideVertical: rand ? b : GEEN },
    rows: rijen.map((r) => new TableRow({ children: r, cantSplit: true })),
  });
}

/** Ingesprongen blok = tabel met een lege kantlijnkolom. */
const ingesprongen = (kinderen: Kind[]) => tabel([[cel([], { w: IND }), cel(kinderen, { w: TW - IND })]], [IND, TW - IND]);

async function beeld(f: FiguurSpec, png: PngRender, maxCm = 14.2): Promise<Paragraph> {
  const svg = figuurSvg(f);
  const w = Number(/width="([\d.]+)cm"/.exec(svg)![1]);
  const h = Number(/height="([\d.]+)cm"/.exec(svg)![1]);
  const data = await png(svg, Math.round((w / 2.54) * 200));
  const exact = f.type === "krachten";
  const wCm = exact ? w : Math.min(w, maxCm);
  const px = (cm: number) => Math.round((cm / 2.54) * 96);
  return new Paragraph({
    alignment: exact ? AlignmentType.LEFT : AlignmentType.CENTER,
    spacing: { before: 60, after: 100 },
    children: [new ImageRun({ type: "png", data, transformation: { width: px(wCm), height: px((wCm * h) / w) }, altText: { title: "Figuur", description: f.type, name: f.type } })],
  });
}

function band(q: OpmaakVraag): Table {
  const se = SE_INFO[q.se];
  const t = bandTekst(q);
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [1304, TW - 1304],
    borders: { top: GEEN, left: GEEN, right: GEEN, insideHorizontal: GEEN, insideVertical: GEEN, bottom: { style: BorderStyle.SINGLE, size: 10, color: hex(se.kleur) } },
    rows: [new TableRow({ children: [cel([para(t.links, { bold: true, kleur: "FFFFFF", size: 20, midden: true, na: 0 })], { w: 1304, bg: se.kleur, va: true }), cel([para(t.rechts, { bold: true, size: 20, na: 0 })], { w: TW - 1304, bg: se.tint, va: true })] })],
  });
}

async function vraag(q: OpmaakVraag, docent: boolean, png: PngRender, alle: OpmaakVraag[]): Promise<Kind[]> {
  const se = SE_INFO[q.se];
  const out: Kind[] = [];
  if (q.vraagstuk?.eerste)
    out.push(tabel([[cel([para(`<b>Vraagstuk · ${q.vraagstuk.titel}</b> — de informatie hieronder hoort bij vraag ${vraagstukBereik(alle, q.vraagstuk.id)}.`, { size: 19, na: 0 })], { w: TW, bg: se.tint })]], [TW], { kleur: se.kleur, size: 6 }), para("", { na: 80 }));
  out.push(band(q), para("", { na: 60 }));
  const blok: Kind[] = q.context.map((c) => para(c, { na: 80 }));
  if (q.tabel) blok.push(tabel(q.tabel.map((r, ri) => r.map((c) => cel([para(c, { size: 19, bold: ri === 0, na: 0 })], { w: Math.floor((TW - IND) / r.length), bg: ri === 0 ? "#ebebeb" : undefined, rand: true }))), q.tabel[0].map(() => Math.floor((TW - IND) / q.tabel![0].length)), { kleur: "#000000", size: 4 }));
  if (q.figuur && !(docent && q.antwoordmodel.verbergLeerlingFiguur)) blok.push(await beeld(q.figuur, png));
  if (blok.length) out.push(ingesprongen(blok));
  out.push(tabel([[cel([para(`<b>${q.punten}p</b>`, { na: 0 })], { w: 510 }), cel([para(`<b>${q.nr}</b>`, { na: 0 })], { w: IND - 510 }), cel([para(q.stam, { na: 0 })], { w: TW - IND })]], [510, IND - 510, TW - IND]));
  if (q.opties) out.push(ingesprongen([tabel(q.opties.map((o, i) => [cel([para(`<b>${String.fromCharCode(65 + i)}</b>`, { na: 0 })], { w: 400 }), cel([para(o, { na: 0 })], { w: TW - IND - 400 })]), [400, TW - IND - 400])]));
  if (!docent && q.antwoordregels)
    out.push(ingesprongen(Array.from({ length: q.antwoordregels }, () => new Paragraph({ spacing: { before: 280 }, border: { bottom: { style: BorderStyle.DOTTED, size: 6, color: "595959", space: 1 } }, children: [] }))));
  if (docent) {
    const b: Kind[] = [para(antwoordKop(q), { size: 19, na: 40 })];
    if (!q.opties) for (const r of q.antwoordmodel.regels) b.push(para(r, { size: 19, na: 40 }));
    if (q.antwoordmodel.figuur) b.push(await beeld(q.antwoordmodel.figuur, png, 9));
    if (!q.opties)
      b.push(tabel(q.scorestappen.map((s) => [cel([para(`• ${s.omschrijving}`, { size: 19, na: 0 })], { w: TW - IND - 900 }), cel([new Paragraph({ alignment: AlignmentType.RIGHT, children: runs(String(s.punten), { size: 19 }) })], { w: 500 })]), [TW - IND - 900, 500]));
    if (q.antwoordmodel.opmerking) b.push(para(`<b>Opmerking</b><br/>${q.antwoordmodel.opmerking}`, { size: 19, na: 40 }));
    b.push(para(rttiRegel(q), { size: 19, na: 0 }));
    out.push(para("", { na: 60 }), ingesprongen([tabel([[cel(b, { w: TW - IND - 200, bg: "#fbfbfb" })]], [TW - IND - 200], { kleur: se.kleur, size: 8 })]));
  }
  out.push(para("", { na: 240 }));
  return out;
}

async function vragen(qs: OpmaakVraag[], docent: boolean, png: PngRender, alle: OpmaakVraag[]): Promise<Kind[]> {
  const out: Kind[] = [];
  let vorige: SeCode | null = null;
  for (const q of qs) {
    if (q.se !== vorige) {
      out.push(new Paragraph({ children: [new PageBreak()] }));
      const l = seLabel(q.se, q.jaar);
      const o = seOmschrijving(q.se, q.jaar);
      out.push(tabel([[cel([para(l === o ? l : `${l} · ${o}`, { bold: true, kleur: "FFFFFF", size: 26, midden: true, na: 0 })], { w: TW, bg: SE_INFO[q.se].kleur })]], [TW]), para("", { na: 120 }));
      vorige = q.se;
    }
    out.push(...(await vraag(q, docent, png, alle)));
  }
  return out;
}

function legenda(qs: OpmaakVraag[]): Table {
  const jaar = jaarVan(qs);
  return tabel(
    SE_ORDE.filter((k) => qs.some((q) => q.se === k)).map((k) => {
      const n = qs.filter((q) => q.se === k);
      return [
        cel([para(seLabel(k, jaar), { bold: true, kleur: "FFFFFF", size: 20, midden: true, na: 0 })], { w: 1304, bg: SE_INFO[k].kleur, va: true }),
        cel([para(seOmschrijving(k, jaar), { size: 19, na: 0 })], { w: TW - 3004, bg: SE_INFO[k].tint, va: true }),
        cel([para(`${n.length} ${n.length === 1 ? "vraag" : "vragen"} · ${n.reduce((s, q) => s + q.punten, 0)} p`, { size: 19, na: 0 })], { w: 1700, bg: SE_INFO[k].tint, va: true }),
      ];
    }),
    [1304, TW - 3004, 1700],
  );
}

function rasterTabel(kop: string[], rijen: string[][], kolommen: number[], codeKol = -1, seVan?: (r: number) => SeCode): Table {
  return tabel(
    [
      kop.map((h, i) => cel([para(`<b>${h}</b>`, { size: 16, na: 0 })], { w: kolommen[i], bg: "#e0e0e0", rand: true })),
      ...rijen.map((r, ri) => r.map((c, i) => cel([para(i === codeKol ? `<b>${c}</b>` : c, { size: 16, na: 0, kleur: i === codeKol ? "FFFFFF" : undefined })], { w: kolommen[i], rand: true, bg: i === codeKol && seVan ? SE_INFO[seVan(ri)].kleur : undefined }))),
    ],
    kolommen,
    { kleur: "#999999", size: 4 },
  );
}

const kop = (toets: ToetsSpec, sub: string, qs: OpmaakVraag[]): Kind[] => [
  para(toets.titel, { bold: true, size: 36, na: 160 }),
  para(sub, { bold: true, size: 26, na: 120 }),
  para(`${toets.minuten ? `Tijd: ${toets.minuten} minuten · ` : ""}${qs.length} vragen · ${qs.reduce((s, q) => s + q.punten, 0)} punten`, { na: 120 }),
];

// ── Leerlingdeel: zelfde voorblad en CSE-opbouw als de PDF (Arial 12 pt) ──
const LB = 24; // 12 pt
function voorbladDocx(toets: ToetsSpec, qs: OpmaakVraag[], deel: { naam: string; nrs: number[] } | null, delen: { naam: string; nrs: number[] }[], res: Pijplijnresultaat): Kind[] {
  const max = res.vragen.reduce((s, q) => s + q.punten, 0);
  const v = voorbladTekst(toets, qs, deel, delen, `5,5 bij ${cesuur(max, toets.nTerm ?? 1)} van de ${max} punten${delen.length > 1 ? " (hele toets)" : ""}`);
  const lijn = () => new Paragraph({ spacing: { before: 320, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "7F7F7F", space: 1 } }, children: [] });
  const invul = (label: string, waarde?: string) => cel(waarde ? [para(`<b>${label}</b>`, { size: 20, na: 20 }), para(waarde, { size: LB, na: 60 })] : [para(`<b>${label}</b>`, { size: 20, na: 0 }), lijn()], { w: TW / 2 });
  const rijen = INVULVELDEN.map(([a, b]) => [invul(a), invul(b)]);
  if (v.cesuur) rijen.push([invul("Cesuur", v.cesuur), cel([], { w: TW / 2 })]);
  const out: Kind[] = [];
  if (v.schoolveld) out.push(para(v.schoolveld, { size: 18, na: 80 }));
  out.push(para(`<b>${v.kop}</b>`, { size: LB, rechts: true, na: 120 }), ...(v.schooljaar ? [para(`<b>${v.schooljaar}</b>`, { size: 56, rechts: true, na: 160 })] : []));
  for (const r of v.rechts) out.push(para(r, { size: 22, rechts: true, na: 0 }));
  out.push(para("", { na: 160 }));
  if (v.balk) out.push(tabel([[cel([para(`<b>${v.balk}</b>`, { size: 22, kleur: "FFFFFF", rechts: true, na: 0 })], { w: TW, bg: "#000000" })]], [TW]));
  out.push(para("", { na: 360 }), tabel(rijen, [TW / 2, TW / 2]), para("", { na: 360 }));
  for (const h of v.hulpmiddelen) out.push(para(h, { size: LB, na: 60 }));
  if (v.delenZin) out.push(para(v.delenZin, { size: LB, voor: 160 }));
  out.push(para("", { na: 1400 }));
  for (const r of v.onder) out.push(para(r, { size: LB, na: 0 }));
  if (v.voetcode) out.push(para(v.voetcode, { size: 16, voor: 200 }));
  out.push(new Paragraph({ children: [new PageBreak()] }));
  for (const b of INSTRUCTIE_CSE) {
    out.push(para(`<b>${b.kop}</b>`, { size: LB, na: 20 }));
    for (const r of b.regels) out.push(para(b.regels.length > 1 ? `–  ${r}` : r, { size: LB, na: 20 }));
    out.push(para("", { na: 120 }));
  }
  return out;
}

async function leerlingVragenDocx(qs: OpmaakVraag[], png: PngRender): Promise<Kind[]> {
  const out: Kind[] = [];
  for (const [i, q] of qs.entries()) {
    // Word kan niet meten: na de instructiepagina een paginagrens, daarna geen vaste grens per vraagstuk
    // (korte vraagstukken delen een pagina); de titel blijft bij de context (keepNext).
    if (i === 0) out.push(new Paragraph({ children: [new PageBreak()] }));
    const titel = contextTitel(q);
    if (titel) out.push(para(`<b>${titel}</b>`, { size: 26, lijnOnder: true, links: 540, voor: i === 0 ? 120 : 360, na: 200, bijVolgende: true }));
    const blok: Kind[] = (q.gedeeldeContext ?? []).map((c) => para(c, { size: LB, na: 100 }));
    if (q.tabel) blok.push(tabel(q.tabel.map((r, ri) => r.map((c, j) => cel([para(c, { size: 20, bold: ri === 0 || j === 0, na: 0 })], { w: Math.floor((TW - IND) / r.length), rand: true }))), q.tabel[0].map(() => Math.floor((TW - IND) / q.tabel![0].length)), { kleur: "#000000", size: 4 }));
    const aanloop = q.aanloop ?? [];
    if (q.figuur && !aanloop.length) blok.push(await beeld(q.figuur, png));
    if (blok.length) out.push(ingesprongen(blok));
    const tekst: Kind[] = aanloop.map((a) => para(a, { size: LB, na: 60 }));
    if (q.figuur && aanloop.length) tekst.push(await beeld(q.figuur, png, 14.2));
    tekst.push(aanloop.length ? tabel([[cel([para("<b>→</b>", { size: LB, na: 0 })], { w: 320 }), cel([para(q.stam, { size: LB, na: 0 })], { w: TW - IND - 320 })]], [320, TW - IND - 320]) : para(q.stam, { size: LB, na: 0 }));
    if (q.opties) tekst.push(tabel(q.opties.map((o, k) => [cel([para(`<b>${String.fromCharCode(65 + k)}</b>`, { size: LB, na: 0 })], { w: 400 }), cel([para(o, { size: LB, na: 0 })], { w: TW - IND - 400 })]), [400, TW - IND - 400]));
    out.push(tabel([[cel([para(`${q.punten}p`, { size: 18, na: 0 })], { w: 540 }), cel([para(`<b>${q.nr}</b>`, { size: LB, na: 0 })], { w: IND - 540 }), cel(tekst, { w: TW - IND })]], [540, IND - 540, TW - IND]));
    if (q.antwoordregels) out.push(ingesprongen(Array.from({ length: q.antwoordregels }, () => new Paragraph({ spacing: { before: 280 }, border: { bottom: { style: BorderStyle.DOTTED, size: 6, color: "595959", space: 1 } }, children: [] }))));
    out.push(para("", { na: 240 }));
  }
  out.push(para("einde", { size: LB, rechts: true }));
  return out;
}

const doc = (kinderen: Kind[]) =>
  new Document({ styles: { default: { document: { run: { font: FONT, size: 21 } } } }, sections: [{ properties: { page: { size: PAGE_A4, margin: { ...PAGE_MARGINS, bottom: PAGE_MARGINS.top } } }, ...pageNumberChrome(), children: kinderen }] });

export async function maakDocxs(toets: ToetsSpec, res: Pijplijnresultaat, png: PngRender): Promise<{ leerling: Uint8Array; docent: Uint8Array }> {
  const L: Kind[] = [];
  const delen = res.delen.filter((d) => d.nrs.length);
  for (const [i, d] of delen.entries()) {
    const qs = res.vragen.filter((q) => d.nrs.includes(q.nr));
    if (i > 0) L.push(new Paragraph({ children: [new PageBreak()] }));
    L.push(...voorbladDocx(toets, qs, d.naam ? d : null, delen, res));
    L.push(...(await leerlingVragenDocx(qs, png)));
  }
  const max = res.vragen.reduce((s, q) => s + q.punten, 0);
  const n = toets.nTerm ?? 1;
  const t = matrijsTotalen(res.vragen);
  const ct = cijferTabel(max, n);
  const rijenN = Math.ceil(ct.length / 4);
  const gsvg = cijferGrafiekSvg(max, n, 12);
  const gh = Number(/height="([\d.]+)cm"/.exec(gsvg)![1]);
  const px = (cm: number) => Math.round((cm / 2.54) * 96);
  const D: Kind[] = [
    ...kop(toets, "Docentdeel: antwoordsleutel, toetsmatrijs en cijferberekening", res.vragen),
    para(uitlegIndeling(toets.klas), { na: 120 }),
    legenda(res.vragen),
    para(UITLEG_DOCENT, { voor: 160 }),
    new Paragraph({ children: [new PageBreak()] }),
    para("Toetsmatrijs", { bold: true, size: 26, na: 120 }),
    rasterTabel(
      ["Nr", "Code", "Hoofdstuk / onderwerp", "Leerdoel", "Vraagtype", "RTTI", "Niveau", "p"],
      [...res.vragen.map((q) => [String(q.nr), q.code, q.hoofdstuk, q.leerdoel ?? "–", q.vraagtype.code, q.rtti, q.niveau, String(q.punten)]), ["", "", "Totaal", "", "", "", "", String(t.punten)]],
      [454, 1077, 1928, 2608, 907, 567, 964, 565],
      1,
      (r) => res.vragen[r]?.se ?? "ALG",
    ),
    ...[[`Totaal per ${jaarVan(res.vragen) !== undefined && jaarVan(res.vragen)! < 4 ? "onderwerp" : "SE-toets"}`, t.perSe.map((r) => ({ ...r, sleutel: seLabel(r.sleutel as SeCode, jaarVan(res.vragen)) }))], ["Totaal per RTTI-categorie", t.perRtti], ["Totaal per examenniveau", t.perNiveau], ["Totaal per hoofdstuk / onderwerp", t.perHoofdstuk]].flatMap(([titel, rijen]) => [
      para(`<b>${titel as string}</b>`, { voor: 200, na: 60 }),
      rasterTabel(["", "vragen", "punten", "%"], [...(rijen as typeof t.perSe).map((r) => [r.sleutel, String(r.vragen), String(r.punten), r.pct.toFixed(1).replace(".", ",")]), ["Totaal", String(t.vragen), String(t.punten), "100,0"]], [2950, 900, 900, 800]),
    ]),
    new Paragraph({ children: [new PageBreak()] }),
    para("Cijferberekening", { bold: true, size: 26, na: 120 }),
    para(`Maximumscore: <b>${max} punten</b>. Normeringsterm N = ${nlCijfer(n)}. ${formule(max, n)}. Cesuur (laagste voldoende): <b>${cesuur(max, n)} punten</b>.`, { na: 120 }),
    rasterTabel(
      Array(4).fill(["Score", "Cijfer"]).flat(),
      Array.from({ length: rijenN }, (_, r) => Array.from({ length: 4 }, (_, g) => { const it = ct[g * rijenN + r]; return it ? [String(it.score), nlCijfer(it.cijfer)] : ["", ""]; }).flat()),
      Array(8).fill(Math.floor(TW / 8)),
    ),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new ImageRun({ type: "png", data: await png(gsvg, Math.round((12 / 2.54) * 200)), transformation: { width: px(12), height: px(gh) }, altText: { title: "Cijfergrafiek", description: "cijfer tegen score", name: "cijfergrafiek" } })] }),
    new Paragraph({ children: [new PageBreak()] }),
    para(`Register: vraagtype → ${indelingKop(jaarVan(res.vragen))} → hoofdstuk`, { bold: true, size: 26, na: 120 }),
    (() => {
      const qs = [...res.vragen].sort((a, b) => a.vraagtype.nr - b.vraagtype.nr || a.nr - b.nr);
      return rasterTabel(["Nr", "Vraagtype", indelingKop(jaarVan(res.vragen)), "Ook in", "Hoofdstuk / onderwerp", "Vraag"], qs.map((q) => [String(q.vraagtype.nr), `${q.vraagtype.naam} (${q.vraagtype.code})`, q.code, q.ookIn ?? "–", q.hoofdstuk, String(q.nr)]), [454, 3685, 1077, 964, 2155, 735], 2, (r) => qs[r].se);
    })(),
    ...(await vragen(res.vragen, true, png, res.vragen)),
  ];
  const [leerling, docent] = await Promise.all([Packer.toBuffer(doc(L)), Packer.toBuffer(doc(D))]);
  return { leerling: new Uint8Array(leerling), docent: new Uint8Array(docent) };
}
