/**
 * Leerling- en docentdeel als PDF in de opmaak van build.py (62-vraagtypen-*.pdf):
 *  - leerlingdeel: alleen het vragenboekje (eventueel opgesplitst in delen A/B), zonder antwoorden;
 *  - docentdeel: antwoordsleutel (CvTE-antwoordbox), toetsmatrijs met totalen, cijferberekening (tabel + grafiek),
 *    legenda en register.
 * Draait in Node (pdfkit + resvg-wasm), zonder Python.
 */
import type { FiguurSpec, OpmaakVraag, SeCode, ToetsSpec } from "./spec.ts";
import type { Pijplijnresultaat } from "./pijplijn.ts";
import { figuurSvg } from "./figuren/index.ts";
import { cijferGrafiekSvg, cijferTabel, cesuur, formule } from "./cijfer-n.ts";
import { nlCijfer } from "../cijfer.ts";
import { antwoordKop, bandTekst, contextTitel, indelingKop, INSTRUCTIE_CSE, INVULVELDEN, jaarVan, matrijsTotalen, ondVan, rttiRegel, SE_INFO, SE_ORDE, seLabel, seOmschrijving, UITLEG_DOCENT, uitlegIndeling, voorbladTekst, vraagstukBereik } from "./opmaak.ts";
import { A4, Beeld, Bijeen, type Blok, CM, type Fonts, GeenNummer, Ingesprongen, Lijn, Lijnen, maakPdf, Onderaan, PaginaEinde, Para, Ruimte, ST, Tabel } from "./pdf-opmaak.ts";

export type PngRender = (svg: string, breedtePx: number) => Promise<Uint8Array>;

const M = 2.5 * CM;
const TW = A4.w - 2 * M;
const IND = 1.8 * CM;
const IW = TW - IND;
const DPI = 200;

interface Fig {
  png: Uint8Array;
  wCm: number;
  hCm: number;
  exact: boolean;
}

async function renderFig(f: FiguurSpec, png: PngRender): Promise<Fig> {
  const svg = figuurSvg(f);
  const w = Number(/width="([\d.]+)cm"/.exec(svg)![1]);
  const h = Number(/height="([\d.]+)cm"/.exec(svg)![1]);
  return { png: await png(svg, Math.round((w / 2.54) * DPI)), wCm: w, hCm: h, exact: f.type === "krachten" };
}

function figBlok(fig: Fig, maxW = IW): Blok {
  const w = fig.exact ? fig.wCm * CM : Math.min(fig.wCm * CM, maxW);
  const h = (w * fig.hCm) / fig.wCm;
  return new Bijeen([new Ruimte(4), new Beeld(fig.png, w, h, fig.exact ? "links" : "midden"), new Ruimte(6)]);
}

const ind = (b: Blok, l = IND) => new Ingesprongen(b, l);

function band(q: OpmaakVraag): Blok {
  const se = SE_INFO[q.se];
  const t = bandTekst(q);
  return new Tabel([[{ inhoud: [new Para(t.links, ST.bandw)], bg: se.kleur }, { inhoud: [new Para(t.rechts, ST.band)], bg: se.tint }]], {
    kolommen: [2.3 * CM, TW - 2.3 * CM],
    pad: { l: 6, r: 6, t: 4, b: 5 },
    va: "midden",
    lijnOnder: { kleur: se.kleur, lw: 1.2 },
  });
}

function stamRij(q: OpmaakVraag): Blok {
  return new Tabel([[[new Para(`${q.punten}p`, ST.pn)], [new Para(String(q.nr), ST.pn)], [new Para(q.stam, ST.body)]]], {
    kolommen: [0.9 * CM, IND - 0.9 * CM, IW],
    pad: { l: 0, r: 0, t: 2, b: 2 },
  });
}

function mcBlok(opties: string[]): Blok {
  return ind(
    new Tabel(opties.map((o, i) => [[new Para(`<b>${String.fromCharCode(65 + i)}</b>`)], [new Para(o)]]), {
      kolommen: [0.7 * CM, IW - 0.7 * CM],
      pad: { l: 0, r: 0, t: 1, b: 1 },
    }),
  );
}

function dataTabel(rijen: string[][]): Blok {
  const n = rijen[0].length;
  const kol = n === 2 ? [IW * 0.4, IW * 0.3] : n === 4 ? [IW * 0.46, IW * 0.18, IW * 0.18, IW * 0.18] : [IW * 0.28, ...Array(n - 1).fill((IW * 0.72) / (n - 1))];
  return ind(
    new Tabel(
      rijen.map((r, ri) => r.map((c, j) => ({ inhoud: [new Para(c, ri === 0 || (j === 0 && n > 4) ? ST.cellb : ST.cell)], bg: ri === 0 ? "#ebebeb" : undefined }))),
      { kolommen: kol, rooster: { kleur: "#000000", lw: 0.6 }, pad: { l: 6, r: 6, t: 3, b: 4 }, va: "midden" },
    ),
  );
}

function antwoordBox(q: OpmaakVraag, antwFig: Fig | null): Blok {
  const se = SE_INFO[q.se];
  const binnen: Blok[] = [new Para(antwoordKop(q), ST.ans)];
  if (!q.opties) for (const r of q.antwoordmodel.regels) binnen.push(new Para(r, ST.ans));
  const zij = antwFig && !antwFig.exact && antwFig.wCm <= 7.5;
  const tekstW = IW - 14 - (zij ? 6.6 * CM + 0.3 * CM : 0);
  if (antwFig && !zij) {
    binnen.push(new Ruimte(3));
    const w = antwFig.exact ? antwFig.wCm * CM : Math.min(antwFig.wCm * CM, 9 * CM);
    binnen.push(new Beeld(antwFig.png, w, (w * antwFig.hCm) / antwFig.wCm, antwFig.exact ? "links" : "midden"));
    if (antwFig.exact) binnen.push(new Para("<i>(antwoordfiguur op schaal 1 : 1)</i>", ST.small));
  }
  if (q.scorestappen.length && !q.opties) {
    binnen.push(new Ruimte(2));
    binnen.push(
      new Tabel(
        q.scorestappen.map((s) => [{ inhoud: [new Para(`• ${s.omschrijving}`, ST.ans)] }, { inhoud: [new Para(String(s.punten), ST.ans)], uitlijning: "rechts" as const }]),
        { kolommen: [tekstW - 0.8 * CM, 0.8 * CM], pad: { l: 0, r: 0, t: 1, b: 1 } },
      ),
    );
  }
  if (q.antwoordmodel.opmerking) binnen.push(new Para(`<b>Opmerking</b><br/>${q.antwoordmodel.opmerking}`, ST.ans));
  binnen.push(new Para(rttiRegel(q), ST.ans));
  let inhoud: Blok[] = binnen;
  if (zij && antwFig) {
    const w = Math.min(antwFig.wCm * CM, 6.6 * CM);
    inhoud = [
      new Tabel([[binnen, [new Beeld(antwFig.png, w, (w * antwFig.hCm) / antwFig.wCm, "midden")]]], {
        kolommen: [tekstW, w + 0.3 * CM],
        pad: { l: 0, r: 0, t: 0, b: 0 },
      }),
    ];
  }
  return ind(new Tabel([[{ inhoud }]], { kolommen: [IW], rand: { kleur: se.kleur, lw: 0.9 }, bg: "#fbfbfb", pad: { l: 7, r: 7, t: 5, b: 6 } }));
}

function sectieKop(se: SeCode, jaar?: number, ond?: string): Blok {
  const l = seLabel(se, jaar, ond);
  const o = seOmschrijving(se, jaar, ond);
  return new Tabel([[{ inhoud: [new Para(l === o ? l : `${l} · ${o}`, ST.sectie)], bg: SE_INFO[se].kleur }]], { kolommen: [TW], pad: { l: 6, r: 6, t: 7, b: 8 } });
}

function vraagstukKop(q: OpmaakVraag, alle: OpmaakVraag[]): Blok {
  const se = SE_INFO[q.se];
  return new Tabel(
    [[{ inhoud: [new Para(`<b>Vraagstuk · ${q.vraagstuk!.titel}</b> — de informatie hieronder hoort bij vraag ${vraagstukBereik(alle, q.vraagstuk!.id)}.`, ST.cell)], bg: se.tint }]],
    { kolommen: [TW], pad: { l: 8, r: 8, t: 5, b: 5 }, rand: { kleur: se.kleur, lw: 0.9 } },
  );
}

function vraagBlok(q: OpmaakVraag, docent: boolean, figs: Map<string, Fig>, alle: OpmaakVraag[], voor: Blok[]): Blok {
  const f: Blok[] = [...voor];
  if (q.vraagstuk?.eerste) f.push(vraagstukKop(q, alle), new Ruimte(6));
  f.push(band(q), new Ruimte(6));
  for (const c of q.context) f.push(ind(new Para(c, ST.body, 4)));
  if (q.tabel) f.push(new Ruimte(2), dataTabel(q.tabel), new Ruimte(6));
  const lf = figs.get(`${q.id}/leerling`);
  if (lf && docent && q.antwoordmodel.verbergLeerlingFiguur) f.push(ind(new Para("<i>(Het lege diagram uit het leerlingdeel is hier weggelaten; zie de antwoordfiguur.)</i>", ST.small)));
  else if (lf) f.push(ind(figBlok(lf)));
  f.push(new Ruimte(2), stamRij(q));
  if (q.opties) f.push(new Ruimte(3), mcBlok(q.opties));
  if (!docent && q.antwoordregels) f.push(new Ruimte(4), ind(new Lijnen(q.antwoordregels)));
  if (docent) f.push(new Ruimte(6), antwoordBox(q, figs.get(`${q.id}/antwoord`) ?? null));
  f.push(new Ruimte(16));
  return new Bijeen(f);
}

function legenda(vragen: OpmaakVraag[]): Blok {
  const jaar = jaarVan(vragen);
  const ses = SE_ORDE.filter((k) => vragen.some((q) => q.se === k));
  return new Tabel(
    ses.map((k) => {
      const n = vragen.filter((q) => q.se === k);
      const p = n.reduce((s, q) => s + q.punten, 0);
      return [
        { inhoud: [new Para(seLabel(k, jaar, ondVan(vragen, k)), ST.bandw)], bg: SE_INFO[k].kleur },
        { inhoud: [new Para(seOmschrijving(k, jaar, ondVan(vragen, k)), ST.cell)], bg: SE_INFO[k].tint },
        { inhoud: [new Para(`${n.length} ${n.length === 1 ? "vraag" : "vragen"} · ${p} p`, ST.cell)], bg: SE_INFO[k].tint },
      ];
    }),
    { kolommen: [2.3 * CM, TW - 5.3 * CM, 3.0 * CM], pad: { l: 6, r: 6, t: 4, b: 5 }, va: "midden", rijLijn: { kleur: "#ffffff", lw: 0.4 } },
  );
}

function register(vragen: OpmaakVraag[]): Blok {
  const kop = ["Nr", "Vraagtype", indelingKop(jaarVan(vragen)), "Ook in", "Hoofdstuk / onderwerp", "Vraag"].map((h) => ({ inhoud: [new Para(h, ST.idxb)], bg: "#e0e0e0" }));
  const rijen = [...vragen]
    .sort((a, b) => a.vraagtype.nr - b.vraagtype.nr || a.nr - b.nr)
    .map((q) => [
      { inhoud: [new Para(String(q.vraagtype.nr), ST.idx)] },
      { inhoud: [new Para(`${q.vraagtype.naam} (${q.vraagtype.code})`, ST.idx)] },
      { inhoud: [new Para(`<font color="#ffffff"><b>${q.code}</b></font>`, ST.idx)], bg: SE_INFO[q.se].kleur },
      { inhoud: [new Para(q.ookIn ?? "–", ST.idx)] },
      { inhoud: [new Para(q.hoofdstuk, ST.idx)] },
      { inhoud: [new Para(String(q.nr), ST.idx)] },
    ]);
  return new Tabel([kop, ...rijen], { kolommen: [0.8, 6.5, 1.9, 1.7, 3.8, 1.3].map((c) => c * CM), rooster: { kleur: "#999999", lw: 0.4 }, pad: { l: 4, r: 4, t: 1.5, b: 2.5 }, va: "midden", kopRij: true });
}

function matrijs(vragen: OpmaakVraag[]): Blok[] {
  const kop = ["Nr", "Code", "Hoofdstuk / onderwerp", "Leerdoel", "Vraagtype", "RTTI", "Niveau", "p"].map((h) => ({ inhoud: [new Para(h, ST.idxb)], bg: "#e0e0e0" }));
  const rijen = vragen.map((q) => [
    { inhoud: [new Para(String(q.nr), ST.idx)] },
    { inhoud: [new Para(`<font color="#ffffff"><b>${q.code}</b></font>`, ST.idx)], bg: SE_INFO[q.se].kleur },
    { inhoud: [new Para(q.hoofdstuk, ST.idx)] },
    { inhoud: [new Para(q.leerdoel ?? "–", ST.idx)] },
    { inhoud: [new Para(q.vraagtype.code, ST.idx)] },
    { inhoud: [new Para(q.rtti, ST.idx)] },
    { inhoud: [new Para(q.niveau, ST.idx)] },
    { inhoud: [new Para(String(q.punten), ST.idx)], uitlijning: "rechts" as const },
  ]);
  const t = matrijsTotalen(vragen);
  rijen.push(
    ["", "", "<b>Totaal</b>", "", "", "", "", `<b>${t.punten}</b>`].map((x, i) => ({ inhoud: [new Para(x, ST.idx)], bg: "#f2f2f2", uitlijning: i === 7 ? ("rechts" as const) : undefined })) as never,
  );
  const opt = { kolommen: [0.8, 1.9, 3.3, 4.4, 1.9, 1.0, 1.7, 1.0].map((c) => c * CM), rooster: { kleur: "#999999", lw: 0.4 }, pad: { l: 4, r: 4, t: 1.5, b: 2.5 }, va: "midden" as const, kopRij: true };
  const klein = (titel: string, rij: { sleutel: string; vragen: number; punten: number; pct: number }[], kleur?: (k: string) => string | undefined) =>
    new Tabel(
      [
        [titel, "vragen", "punten", "%"].map((h) => ({ inhoud: [new Para(h, ST.idxb)], bg: "#e0e0e0" })),
        ...rij.map((r) => [
          { inhoud: [new Para(kleur?.(r.sleutel) ? `<font color="#ffffff"><b>${r.sleutel}</b></font>` : r.sleutel, ST.idx)], bg: kleur?.(r.sleutel) },
          { inhoud: [new Para(String(r.vragen), ST.idx)], uitlijning: "rechts" as const },
          { inhoud: [new Para(String(r.punten), ST.idx)], uitlijning: "rechts" as const },
          { inhoud: [new Para(r.pct.toFixed(1).replace(".", ","), ST.idx)], uitlijning: "rechts" as const },
        ]),
        ["<b>Totaal</b>", String(t.vragen), String(t.punten), "100,0"].map((x, i) => ({ inhoud: [new Para(i === 0 ? x : `<b>${x}</b>`, ST.idx)], bg: "#f2f2f2", uitlijning: i ? ("rechts" as const) : undefined })),
      ],
      { kolommen: [5.2 * CM, 1.6 * CM, 1.6 * CM, 1.4 * CM], rooster: { kleur: "#999999", lw: 0.4 }, pad: { l: 4, r: 4, t: 1.5, b: 2.5 }, va: "midden" },
    );
  return [
    new Para("Toetsmatrijs", ST.h2, 6),
    new Para(`Per vraag: ${indelingKop(jaarVan(vragen))} en hoofdstuk, leerdoel, RTTI-categorie, examenniveau en punten. Daaronder de totalen per categorie.`.replace("Onderwerp en hoofdstuk", "onderwerp en hoofdstuk").replace("SE-toets en", "SE-toets en"), ST.body, 6),
    new Tabel([kop, ...rijen], opt),
    new Ruimte(12),
    (() => {
      const jaar = jaarVan(vragen);
      const naarSe = new Map(SE_ORDE.map((k) => [seLabel(k, jaar, ondVan(vragen, k)), k]));
      return new Bijeen([new Para(`<b>Totaal per ${indelingKop(jaar).toLowerCase() === "se-toets" ? "SE-toets" : "onderwerp"}</b>`, ST.body, 2), klein(indelingKop(jaar), t.perSe.map((r) => ({ ...r, sleutel: seLabel(r.sleutel as SeCode, jaar, ondVan(vragen, r.sleutel as SeCode)) })), (k) => SE_INFO[naarSe.get(k) as SeCode]?.kleur)]);
    })(),
    new Ruimte(8),
    new Bijeen([new Para("<b>Totaal per RTTI-categorie</b>", ST.body, 2), klein("RTTI", t.perRtti)]),
    new Ruimte(8),
    new Bijeen([new Para("<b>Totaal per examenniveau</b>", ST.body, 2), klein("Niveau", t.perNiveau)]),
    new Ruimte(8),
    new Bijeen([new Para("<b>Totaal per hoofdstuk / onderwerp</b>", ST.body, 2), klein("Hoofdstuk / onderwerp", t.perHoofdstuk)]),
  ];
}

async function cijferDeel(max: number, n: number, png: PngRender): Promise<Blok[]> {
  const tabel = cijferTabel(max, n);
  const kolGroepen = 4;
  const rijenN = Math.ceil(tabel.length / kolGroepen);
  const kop = Array.from({ length: kolGroepen }, () => [
    { inhoud: [new Para("Score", ST.idxb)], bg: "#e0e0e0" },
    { inhoud: [new Para("Cijfer", ST.idxb)], bg: "#e0e0e0" },
  ]).flat();
  const rijen = Array.from({ length: rijenN }, (_, r) =>
    Array.from({ length: kolGroepen }, (_, g) => {
      const it = tabel[g * rijenN + r];
      const vold = it && it.cijfer >= 5.5;
      return [
        { inhoud: [new Para(it ? String(it.score) : "", ST.idx)], uitlijning: "rechts" as const, bg: g % 2 ? "#fafafa" : undefined },
        { inhoud: [new Para(it ? (vold ? nlCijfer(it.cijfer) : `<font color="#b03a2e">${nlCijfer(it.cijfer)}</font>`) : "", ST.idx)], uitlijning: "rechts" as const, bg: g % 2 ? "#fafafa" : undefined },
      ];
    }).flat(),
  );
  const svg = cijferGrafiekSvg(max, n, 12);
  const g = await png(svg, Math.round((12 / 2.54) * DPI));
  const hCm = Number(/height="([\d.]+)cm"/.exec(svg)![1]);
  const cs = cesuur(max, n);
  return [
    new Para("Cijferberekening", ST.h2, 6),
    new Para(`Maximumscore: <b>${max} punten</b>. Normeringsterm N = ${nlCijfer(n)}. ${formule(max, n)}. Cesuur (laagste voldoende): <b>${cs} punten</b> → ${nlCijfer(tabel[cs].cijfer)}. Onvoldoendes staan in rood.`, ST.body, 6),
    new Tabel([kop, ...rijen], { kolommen: Array(8).fill(TW / 8), rooster: { kleur: "#999999", lw: 0.4 }, pad: { l: 6, r: 8, t: 1.5, b: 2.5 }, va: "midden" }),
    new Ruimte(10),
    new Bijeen([new Para("<b>Grafiek: cijfer tegen score</b>", ST.body, 4), new Beeld(g, 12 * CM, hCm * CM, "midden")]),
  ];
}

function kopBlokken(toets: ToetsSpec, ondertitel: string, vragen: OpmaakVraag[]): Blok[] {
  const p = vragen.reduce((s, q) => s + q.punten, 0);
  return [
    new Para(toets.titel, ST.h1, 8),
    new Para(ondertitel, ST.h2, 6),
    new Para(`${toets.minuten ? `Tijd: ${toets.minuten} minuten · ` : ""}${vragen.length} vragen · ${p} punten`, ST.body, 6),
  ];
}

export interface PdfUitvoer {
  leerling: Uint8Array;
  leerlingDelen: { naam: string; pdf: Uint8Array }[];
  docent: Uint8Array;
}

async function figurenVoor(vragen: OpmaakVraag[], png: PngRender): Promise<Map<string, Fig>> {
  const m = new Map<string, Fig>();
  await Promise.all(
    vragen.flatMap((q) => [
      q.figuur ? renderFig(q.figuur, png).then((f) => m.set(`${q.id}/leerling`, f)) : null,
      q.antwoordmodel.figuur ? renderFig(q.antwoordmodel.figuur, png).then((f) => m.set(`${q.id}/antwoord`, f)) : null,
    ]),
  );
  return m;
}

function vragenMetSecties(vragen: OpmaakVraag[], docent: boolean, figs: Map<string, Fig>, alle: OpmaakVraag[]): Blok[] {
  const out: Blok[] = [];
  let vorige: SeCode | null = null;
  for (const q of vragen) {
    const voor: Blok[] = [];
    if (q.se !== vorige) {
      out.push(new PaginaEinde());
      voor.push(sectieKop(q.se, q.jaar, q.onderwerp), new Ruimte(12));
      vorige = q.se;
    }
    out.push(vraagBlok(q, docent, figs, alle, voor));
  }
  return out;
}

// ── Leerlingdeel ──────────────────────────────────────────────────────────────────────────────────────────────
// Voorblad: opbouw van de schooltoetsen (kop + schooljaar + SE/toetscode/duur rechtsboven, zwarte vakbalk,
// hulpmiddelen, aantal vragen/punten onderaan) met de invulvelden van het Toetski-leerlingblad. Daarna de
// instructiepagina en de vragen in CSE-opbouw: lijn + contexttitel, context ingesprongen, in de kantlijn punten en
// vraagnummer, eigen informatie van een deelvraag op de nummerregel en de opdracht met →.

/** Kantlijn als in het CSE: punten (klein) | vraagnummer (vet) | tekst. */
const K_P = 0.95 * CM;
const K_NR = IND - K_P;

function invulCel(label: string, waarde?: string): Blok[] {
  return waarde
    ? [new Para(label, ST.vbLabel, 2), new Para(waarde, ST.lbody)]
    : [new Para(label, ST.vbLabel, 0), new Lijn("#7f7f7f", 0.6, 16, 2)];
}

function voorblad(toets: ToetsSpec, vragen: OpmaakVraag[], deel: { naam: string; nrs: number[] } | null, delen: { naam: string; nrs: number[] }[], cesuurTekst: string): Blok[] {
  const v = voorbladTekst(toets, vragen, deel, delen, cesuurTekst);
  const out: Blok[] = [new GeenNummer()];
  if (v.schoolveld) out.push(new Para(v.schoolveld, ST.lklein, 4));
  out.push(new Para(v.kop, ST.vbKop, 6));
  if (v.schooljaar) out.push(new Para(v.schooljaar, ST.vbJaar, 8));
  for (const r of v.rechts) out.push(new Para(r, ST.vbRechts));
  out.push(new Ruimte(10));
  if (v.balk) out.push(new Tabel([[{ inhoud: [new Para(v.balk, ST.vbBalk)], bg: "#000000" }]], { kolommen: [TW], pad: { l: 6, r: 6, t: 3, b: 4 } }));
  out.push(new Ruimte(26));
  const rijen = INVULVELDEN.map(([a, b]) => [invulCel(a), invulCel(b)]);
  if (v.cesuur) rijen.push([invulCel("Cesuur", v.cesuur), []]);
  out.push(new Tabel(rijen, { kolommen: [TW / 2, TW / 2], pad: { l: 0, r: 18, t: 5, b: 9 } }));
  out.push(new Ruimte(26));
  for (const h of v.hulpmiddelen) out.push(new Para(h, ST.lbody, 4));
  if (v.delenZin) out.push(new Ruimte(8), new Para(v.delenZin, ST.lbody, 4));
  out.push(new Onderaan(new Bijeen([...v.onder.map((r) => new Para(r, ST.lbody)), ...(v.voetcode ? [new Ruimte(14), new Para(v.voetcode, ST.lklein)] : [])])));
  // Instructiepagina (CSE pagina 2); de vragen volgen direct.
  out.push(new PaginaEinde());
  for (const blok of INSTRUCTIE_CSE) {
    out.push(ind(new Para(`<b>${blok.kop}</b>`, ST.lbody, 1)));
    if (blok.regels.length === 1) out.push(ind(new Para(blok.regels[0], ST.lbody, 8)));
    else {
      out.push(ind(new Tabel(blok.regels.map((r) => [[new Para("–", ST.lbody)], [new Para(r, ST.lbody)]]), { kolommen: [0.45 * CM, IW - 0.45 * CM], pad: { l: 0, r: 0, t: 0, b: 1 } })));
      out.push(new Ruimte(8));
    }
  }
  out.push(new Ruimte(10));
  return out;
}

/** CSE-contexttitel: vet, iets ingesprongen (op de nummerkolom), daaronder een dikke grijze balk over de volle breedte. */
function titelBlok(titel: string, se: SeCode, jaar?: number, ond?: string): Blok {
  return new Bijeen([
    new Tabel([[[], [new Para(titel, ST.ltitel)], { inhoud: [new Para(`<font color="#808080">${seLabel(se, jaar, ond)}</font>`, ST.lklein)], uitlijning: "rechts" as const }]], {
      kolommen: [K_P, TW - K_P - 2 * CM, 2 * CM],
      pad: { l: 0, r: 0, t: 0, b: 1 },
      va: "midden",
    }),
    new Lijn("#bfbfbf", 4, 0, 12),
  ]);
}

function lDataTabel(rijen: string[][]): Blok {
  const n = rijen[0].length;
  const kol = Array(n).fill(Math.min(2.6 * CM, IW / n));
  kol[0] = Math.min(4.2 * CM, IW - (n - 1) * kol[1]);
  return ind(new Tabel(rijen.map((r, ri) => r.map((c, j) => ({ inhoud: [new Para(c, ri === 0 || j === 0 ? ST.cellb : ST.cell)] }))), { kolommen: kol, rooster: { kleur: "#000000", lw: 0.6 }, pad: { l: 5, r: 5, t: 3, b: 4 }, va: "midden" }));
}

function leerlingVraag(q: OpmaakVraag, figs: Map<string, Fig>): Blok[] {
  const blokken: Blok[] = [];
  const titel = contextTitel(q);
  if (titel) blokken.push(titelBlok(titel, q.se, q.jaar, q.onderwerp));
  for (const c of q.gedeeldeContext ?? []) blokken.push(ind(new Para(c, ST.lbody, 6)));
  if (q.tabel) blokken.push(lDataTabel(q.tabel), new Ruimte(8));
  const fig = figs.get(`${q.id}/leerling`);
  const aanloop = q.aanloop ?? [];
  if (fig && !aanloop.length) blokken.push(ind(figBlok(fig)), new Ruimte(4));
  // Nummerregel: eigen informatie van de deelvraag → (figuur) → opdracht (met → als er informatie vóór staat).
  const tekst: Blok[] = [];
  for (const a of aanloop) tekst.push(new Para(a, ST.lbody, 4));
  if (fig && aanloop.length) tekst.push(figBlok(fig, IW), new Ruimte(2));
  tekst.push(
    aanloop.length
      ? new Tabel([[[new Para("<b>→</b>", ST.lbody)], [new Para(q.stam, ST.lbody)]]], { kolommen: [0.55 * CM, IW - 0.55 * CM], pad: { l: 0, r: 0, t: 0, b: 0 } })
      : new Para(q.stam, ST.lbody),
  );
  if (q.opties) {
    tekst.push(new Ruimte(3));
    tekst.push(new Tabel(q.opties.map((o, i) => [[new Para(`<b>${String.fromCharCode(65 + i)}</b>`, ST.lbody)], [new Para(o, ST.lbody)]]), { kolommen: [0.6 * CM, IW - 0.6 * CM], pad: { l: 0, r: 0, t: 0, b: 1 } }));
  }
  blokken.push(
    new Tabel([[[new Para(`${q.punten}p`, ST.lpunt)], [new Para(String(q.nr), ST.lnr)], tekst]], { kolommen: [K_P, K_NR, IW], pad: { l: 0, r: 0, t: 0, b: 0 } }),
  );
  if (q.antwoordregels) blokken.push(new Ruimte(2), ind(new Lijnen(q.antwoordregels)));
  blokken.push(new Ruimte(18));
  return blokken;
}

/**
 * Paginering leerlingdeel: na de instructiepagina begint het eerste vraagstuk op een nieuwe pagina. Daarna staat elk
 * vraagstuk (titel t/m de laatste deelvraag) als één geheel: past het nog op de pagina, dan volgt het direct (korte
 * vraagstukken delen een pagina); anders begint het bovenaan een nieuwe pagina. Een vraagstuk dat langer is dan een
 * pagina begint bovenaan en breekt alleen tussen deelvragen.
 */
export function leerlingGroepen(vragen: OpmaakVraag[]): OpmaakVraag[][] {
  const groepen: OpmaakVraag[][] = [];
  for (const q of vragen) {
    const vorige = groepen.at(-1);
    if (vorige && q.vraagstuk && vorige[0].vraagstuk?.id === q.vraagstuk.id) vorige.push(q);
    else groepen.push([q]);
  }
  return groepen;
}

function leerlingVragen(vragen: OpmaakVraag[], figs: Map<string, Fig>): Blok[] {
  const out: Blok[] = [new PaginaEinde()];
  for (const g of leerlingGroepen(vragen)) {
    const groep = new Bijeen(g.map((q) => new Bijeen(leerlingVraag(q, figs))));
    groep.bovenaanAlsTeLang = true;
    out.push(groep);
  }
  out.push(new Tabel([[{ inhoud: [new Para("einde", ST.lbody)], uitlijning: "rechts" as const }]], { kolommen: [TW], pad: { l: 0, r: 0, t: 4, b: 0 } }));
  return out;
}

function leerlingBlokken(toets: ToetsSpec, res: Pijplijnresultaat, figs: Map<string, Fig>, deelIdx: number | null): Blok[] {
  const delen = res.delen.filter((d) => d.nrs.length);
  const kiezen = deelIdx === null ? delen : [delen[deelIdx]];
  const max = res.vragen.reduce((s, q) => s + q.punten, 0);
  const cs = cesuur(max, toets.nTerm ?? 1);
  const cesuurTekst = `5,5 bij ${cs} van de ${max} punten${delen.length > 1 ? " (hele toets)" : ""}`;
  const out: Blok[] = [];
  kiezen.forEach((d, i) => {
    const vragen = res.vragen.filter((q) => d.nrs.includes(q.nr));
    if (i > 0) out.push(new PaginaEinde());
    out.push(...voorblad(toets, vragen, d.naam ? d : null, delen, cesuurTekst));
    out.push(...leerlingVragen(vragen, figs));
  });
  return out;
}

export async function maakPdfs(toets: ToetsSpec, res: Pijplijnresultaat, fonts: Fonts, png: PngRender): Promise<PdfUitvoer> {
  const figs = await figurenVoor(res.vragen, png);
  const max = res.vragen.reduce((s, q) => s + q.punten, 0);
  const n = toets.nTerm ?? 1;
  const docentBlokken: Blok[] = [
    ...kopBlokken(toets, "Docentdeel: antwoordsleutel, toetsmatrijs en cijferberekening", res.vragen),
    new Para(uitlegIndeling(toets.klas), ST.body, 6),
    legenda(res.vragen),
    new Ruimte(8),
    new Para(UITLEG_DOCENT, ST.body, 6),
    ...(res.delen.length > 1 ? [new Para(`Leerlingdelen: ${res.delen.map((d) => `${d.naam} (vraag ${d.nrs[0]}–${d.nrs[d.nrs.length - 1]})`).join(", ")}.`, ST.body)] : []),
    new PaginaEinde(),
    ...matrijs(res.vragen),
    new PaginaEinde(),
    ...(await cijferDeel(max, n, png)),
    new PaginaEinde(),
    new Para(`Register: vraagtype → ${indelingKop(jaarVan(res.vragen))} → hoofdstuk`, ST.h2, 6),
    register(res.vragen),
    ...vragenMetSecties(res.vragen, true, figs, res.vragen),
  ];
  const [leerling, docent, ...delen] = await Promise.all([
    maakPdf(leerlingBlokken(toets, res, figs, null), fonts, { titel: `${toets.titel} — leerlingdeel` }),
    maakPdf(docentBlokken, fonts, { titel: `${toets.titel} — docentdeel` }),
    ...(res.delen.length > 1 ? res.delen.map((d, i) => maakPdf(leerlingBlokken(toets, res, figs, i), fonts, { titel: `${toets.titel} — leerlingdeel ${d.naam}` })) : []),
  ]);
  return { leerling, docent, leerlingDelen: delen.map((pdf, i) => ({ naam: res.delen[i].naam, pdf })) };
}
