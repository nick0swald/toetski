import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  Header,
  Footer,
  VerticalAlign,
} from "docx";
import { RTTI_META, RTTI_ORDER, SCHOOL } from "./constants";
import { cesuurPunten, formuleTekst, modelLabel, omzetTabel, voldoendeHint } from "./cijfer";
import { totaalPunten } from "./rtti";
import { slug } from "./text";
import type { CijferNorm, GegenereerdeToets } from "./types";
import { withDefaults } from "./defaults";

const GREEN = "004422";
const INK = "000000";
const MUTED = "333333";
const thin = { style: BorderStyle.SINGLE, size: 4, color: "C3D7EE" };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

/** Nick's school Word standard (Cito-achtig voorbeeld). */
const FONT = "Arial";
const BODY_SIZE = 24; // 12pt
const SMALL_SIZE = 20; // 10pt
/** ~2.5cm / 2cm in twips (1cm ≈ 567). */
const PAGE_MARGINS = { top: 1418, right: 1418, bottom: 1134, left: 1418 };
const PAGE_A4 = { width: 11906, height: 16838 };

function p(text: string, opts?: { bold?: boolean; size?: number; italics?: boolean; after?: number }) {
  return new Paragraph({
    spacing: { after: opts?.after ?? 120, line: 276, lineRule: "auto" },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts?.size ?? BODY_SIZE,
        bold: opts?.bold,
        italics: opts?.italics,
        color: INK,
      }),
    ],
  });
}

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 160 },
    children: [new TextRun({ text, font: "Arial", size: 32, bold: true, color: GREEN })],
  });
}

function sub(text: string) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 18, color: MUTED })],
  });
}

function cell(text: string, opts?: { bold?: boolean; fill?: string }) {
  return new TableCell({
    borders,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts?.fill ? { fill: opts.fill } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, font: "Arial", size: 18, bold: opts?.bold, color: INK })],
      }),
    ],
  });
}


function schoolLeerlingChrome() {
  return {
    headers: {
      default: new Header({ children: [new Paragraph({ children: [] })] }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SMALL_SIZE, color: MUTED }),
            ],
          }),
        ],
      }),
    },
  };
}

function headerFooter(label: string) {
  return {
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: SCHOOL, font: "Arial", size: 16, color: GREEN, bold: true }),
              new TextRun({ text: `  ·  ${label}`, font: "Arial", size: 16, color: MUTED }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "blad ", font: "Arial", size: 16, color: MUTED }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: MUTED }),
            ],
          }),
        ],
      }),
    },
  };
}

function toetsParagrafen(toets: GegenereerdeToets): Paragraph[] {
  const t = withDefaults(toets);
  const m = t.meta;
  const max = totaalPunten(t.vragen);
  const out: Paragraph[] = [
    p(m.titel, { bold: true, size: 28, after: 80 }),
    p(`${m.vak} · ${m.leerweg} klas ${m.leerjaar} · versie ${m.versie}`, { size: SMALL_SIZE, after: 40 }),
    p(`Tijd: ${m.duurMinuten} minuten. Maximumscore: ${max} punten.`, { size: SMALL_SIZE, after: 40 }),
    p("Naam: ________________________    Klas: ________    Datum: ________", { after: 200 }),
  ];
  if (m.instructies.length) {
    out.push(p("Instructie", { bold: true, after: 60 }));
    for (const s of m.instructies) out.push(p(s, { size: SMALL_SIZE, after: 40 }));
    out.push(p("", { after: 120 }));
  }
  for (const q of t.vragen) {
    const stam = (q.stam || "").trim();
    const kop = `${q.punten}p  ${q.nummer}  ${stam}`;
    out.push(
      new Paragraph({
        spacing: { before: 200, after: 80, line: 276, lineRule: "auto" },
        indent: { left: 709, hanging: 709 },
        children: [
          new TextRun({ text: kop, font: FONT, size: BODY_SIZE, bold: true, color: INK }),
        ],
      }),
    );
    if (q.context?.trim()) {
      out.push(p(q.context.trim(), { size: BODY_SIZE, after: 80 }));
    }
    if (q.opties?.length) {
      for (const o of q.opties) {
        out.push(
          new Paragraph({
            spacing: { after: 40, line: 276, lineRule: "auto" },
            indent: { left: 709 },
            children: [
              new TextRun({
                text: `${o.letter}  ${o.tekst}`,
                font: FONT,
                size: BODY_SIZE,
                color: INK,
              }),
            ],
          }),
        );
      }
    } else {
      // Open vraag: antwoordlijnen zoals in schoolvoorbeeld
      for (let i = 0; i < 3; i++) {
        out.push(p("__________________________________________________________________", { after: 40 }));
      }
    }
  }
  return out;
}

function nakijkParagrafen(toets: GegenereerdeToets): (Paragraph | Table)[] {
  const t = withDefaults(toets);
  const max = totaalPunten(t.vragen);
  const out: (Paragraph | Table)[] = [
    p(`Nakijkmodel · ${t.meta.titel}`, { bold: true, size: 28, after: 80 }),
    p("Niet voor leerlingen", { size: SMALL_SIZE, italics: true, after: 40 }),
    p(
      `${t.meta.vak} · ${t.meta.leerweg} klas ${t.meta.leerjaar} · versie ${t.meta.versie}`,
      { size: SMALL_SIZE, after: 40 },
    ),
    p(formuleTekst(t.cijferNorm, max), { bold: true, after: 200 }),
  ];
  for (const n of t.nakijkmodel) {
    const q = t.vragen.find((v) => v.nummer === n.nummer);
    const punten = q?.punten ?? "?";
    const stam = (q?.stam || "").trim();
    const kop = stam
      ? `${punten}p  ${n.nummer}  ${stam}`
      : `${punten}p  ${n.nummer}`;
    out.push(
      new Paragraph({
        spacing: { before: 200, after: 80, line: 276, lineRule: "auto" },
        indent: { left: 709, hanging: 709 },
        children: [
          new TextRun({ text: kop, font: FONT, size: BODY_SIZE, bold: true, color: INK }),
        ],
      }),
    );
    out.push(p(`Modelantwoord: ${n.modelantwoord}`, { after: 60 }));
    for (const pc of n.puntenverdeling) {
      out.push(
        new Paragraph({
          spacing: { after: 40, line: 276, lineRule: "auto" },
          indent: { left: 709 },
          children: [
            new TextRun({
              text: `${pc.punt}p — ${pc.criterium}`,
              font: FONT,
              size: BODY_SIZE,
              color: INK,
            }),
          ],
        }),
      );
    }
    if (n.nietToekennen?.length) {
      out.push(p(`Niet toekennen: ${n.nietToekennen.join("; ")}`, { size: SMALL_SIZE, italics: true }));
    }
  }
  return out;
}

function matrijsBlocks(toets: GegenereerdeToets): (Paragraph | Table)[] {
  const t = withDefaults(toets);
  const { matrijs } = t;
  const header = [
    cell("Domein", { bold: true, fill: "E8F0EA" }),
    ...RTTI_ORDER.map((k) => cell(RTTI_META[k].kort, { bold: true, fill: "E8F0EA" })),
  ];
  const rows: TableRow[] = [new TableRow({ children: header })];
  for (const d of matrijs.domeinen) {
    const row = matrijs.cellen[d];
    rows.push(
      new TableRow({
        children: [
          cell(d, { bold: true }),
          ...RTTI_ORDER.map((k) => {
            const cel = row?.[k];
            if (!cel || cel.punten <= 0) return cell("—");
            return cell(`${cel.vraagnummers.map((n) => `v${n}`).join(" ")} (${cel.punten}p)`);
          }),
        ],
      }),
    );
  }
  const out: (Paragraph | Table)[] = [
    heading(`Toetsmatrijs · ${t.meta.titel}`),
    sub(`RTTI · ${t.meta.leerweg} klas ${t.meta.leerjaar}`),
    new Table({ width: { size: 9360, type: WidthType.DXA }, rows }),
  ];
  if (t.kwaliteit?.punten?.length) {
    out.push(heading("Feedback op de toets"));
    out.push(p(t.kwaliteit.samenvatting));
    for (const k of t.kwaliteit.punten) {
      out.push(p(`${k.criterium} · ${k.oordeel}`, { bold: true }), p(k.toelichting));
    }
  }
  return out;
}

function kwaliteitParagrafen(toets: GegenereerdeToets): (Paragraph | Table)[] {
  const t = withDefaults(toets);
  const out: (Paragraph | Table)[] = [
    heading(`Feedback · ${t.meta.titel}`),
    sub(`${t.meta.vak} · ${t.meta.leerweg} klas ${t.meta.leerjaar}`),
    p("Kwaliteitscheck van Ares058 Toetsmaker.", { italics: true }),
    p(t.kwaliteit.samenvatting || "Geen samenvatting."),
  ];
  for (const k of t.kwaliteit.punten) {
    out.push(p(`${k.criterium} · ${k.oordeel}`, { bold: true }), p(k.toelichting));
  }
  return out;
}

function cijferParagrafenVan(max: number, norm: CijferNorm, titel: string, subregel: string): (Paragraph | Table)[] {
  const tabel = omzetTabel(max, norm);
  const rows: TableRow[] = [
    new TableRow({ children: [cell("Punten", { bold: true, fill: "E8F0EA" }), cell("Cijfer", { bold: true, fill: "E8F0EA" })] }),
  ];
  for (const rij of tabel) {
    rows.push(new TableRow({ children: [cell(String(rij.punten)), cell(rij.cijfer.toFixed(1).replace(".", ","))] }));
  }
  return [
    heading(titel),
    sub(subregel),
    p(formuleTekst(norm, max), { bold: true }),
    p(voldoendeHint(norm)),
    p(`Cesuur: ${cesuurPunten(max, norm)} van ${max} punten voor een 5,5.`),
    new Table({ width: { size: 4000, type: WidthType.DXA }, rows }),
  ];
}

function cijferParagrafen(toets: GegenereerdeToets): (Paragraph | Table)[] {
  const t = withDefaults(toets);
  const max = totaalPunten(t.vragen);
  return cijferParagrafenVan(max, t.cijferNorm, `Cijferomzetting · ${t.meta.titel}`, modelLabel(t.cijferNorm.model));
}

function docOf(children: (Paragraph | Table)[], label: string) {
  return new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
    sections: [
      {
        properties: { page: { size: PAGE_A4, margin: PAGE_MARGINS } },
        ...headerFooter(label),
        children,
      },
    ],
  });
}

async function saveDoc(doc: Document, filename: string) {
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  await new Promise((resolve) => window.setTimeout(resolve, 1500));
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadMatrijsDocx(toets: GegenereerdeToets) {
  const t = withDefaults(toets);
  await saveDoc(docOf(matrijsBlocks(t), `Toetsmatrijs versie ${t.meta.versie}`), `${slug(t.meta.titel)}-matrijs.docx`);
}

export async function downloadCijferDocx(toets: GegenereerdeToets) {
  const t = withDefaults(toets);
  await saveDoc(docOf(cijferParagrafen(t), "Cijferomzetting"), `${slug(t.meta.titel)}-cijfer.docx`);
}

export async function downloadCijferTabelDocx(opts: { titel?: string; max: number; norm: CijferNorm }) {
  const titel = opts.titel?.trim() || "Cijferomzetting";
  await saveDoc(
    docOf(cijferParagrafenVan(opts.max, opts.norm, titel, modelLabel(opts.norm.model)), "Cijferomzetting"),
    `${slug(titel)}-${opts.norm.model}-${opts.max}p.docx`,
  );
}

export async function downloadKwaliteitDocx(toets: GegenereerdeToets) {
  const t = withDefaults(toets);
  await saveDoc(docOf(kwaliteitParagrafen(t), `Feedback · ${t.meta.titel}`), `${slug(t.meta.titel)}-feedback.docx`);
}

export async function downloadPakketDocx(toets: GegenereerdeToets) {
  const t = withDefaults(toets);
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
    sections: [
      { properties: { page: { size: PAGE_A4, margin: PAGE_MARGINS } }, ...schoolLeerlingChrome(), children: toetsParagrafen(t) },
      { properties: { page: { size: PAGE_A4, margin: PAGE_MARGINS } }, ...schoolLeerlingChrome(), children: nakijkParagrafen(t) },
      { properties: { page: { size: PAGE_A4, margin: PAGE_MARGINS } }, ...headerFooter("Toetsmatrijs"), children: matrijsBlocks(t) },
      { properties: { page: { size: PAGE_A4, margin: PAGE_MARGINS } }, ...headerFooter("Cijferomzetting"), children: cijferParagrafen(t) },
    ],
  });
  await saveDoc(doc, `${slug(t.meta.titel)}-versie-${t.meta.versie}-pakket.docx`);
}
