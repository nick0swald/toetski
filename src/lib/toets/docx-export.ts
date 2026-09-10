import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
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
import { grafiekSvg, schemaFiguurSvg } from "./figuur-svg";
import type { CijferNorm, GegenereerdeToets, SchemaFiguur, Vraag, VraagTabel } from "./types";
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

type DocChild = Paragraph | Table;

/** SVG → PNG via browser canvas (docx-export draait client-side). */
async function svgToPngBytes(svg: string, width: number, height: number): Promise<Uint8Array> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("SVG kon niet worden geladen"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas niet beschikbaar");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/png");
    const b64 = dataUrl.split(",")[1] ?? "";
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function vraagTabelDocx(tabel: VraagTabel): Table {
  const cols = Math.max(1, tabel.koppen.length);
  const colW = Math.floor(9360 / cols);
  const header = new TableRow({
    children: tabel.koppen.map((k) =>
      cell(k, { bold: true, fill: "E8F0EA", width: colW, center: true }),
    ),
  });
  const rows = [
    header,
    ...tabel.rijen.map(
      (rij) =>
        new TableRow({
          children: Array.from({ length: cols }, (_, j) =>
            cell(rij[j] ?? "", { width: colW, center: true }),
          ),
        }),
    ),
  ];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: Array.from({ length: cols }, () => colW),
    rows,
  });
}

async function svgImageParagraph(svg: string, widthPx: number, heightPx: number): Promise<Paragraph> {
  const png = await svgToPngBytes(svg, widthPx, heightPx);
  return new Paragraph({
    spacing: { before: 80, after: 120 },
    children: [
      new ImageRun({
        type: "png",
        data: png,
        transformation: { width: Math.round(widthPx * 0.75), height: Math.round(heightPx * 0.75) },
        altText: { title: "Figuur", description: "Toetsfiguur", name: "figuur" },
      }),
    ],
  });
}

async function vraagFiguurBlocks(q: Vraag): Promise<DocChild[]> {
  const out: DocChild[] = [];
  if (q.tabel?.koppen?.length) {
    out.push(vraagTabelDocx(q.tabel));
    out.push(p("", { after: 80 }));
  }
  if (q.grafiek && q.grafiek.punten.length >= 2) {
    const svg = grafiekSvg(q.grafiek, 420, 240);
    if (svg) out.push(await svgImageParagraph(svg, 420, 240));
  }
  if (q.schemaFiguur) {
    const svg = schemaFiguurSvg(q.schemaFiguur as SchemaFiguur, 420, 220);
    if (svg) out.push(await svgImageParagraph(svg, 420, 220));
  }
  return out;
}

function p(text: string, opts?: { bold?: boolean; size?: number; italics?: boolean; after?: number; before?: number }) {
  return new Paragraph({
    spacing: { before: opts?.before, after: opts?.after ?? 120, line: 276, lineRule: "auto" },
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

function cell(
  text: string,
  opts?: { bold?: boolean; fill?: string; center?: boolean; lines?: string[]; width?: number; columnSpan?: number },
) {
  const lines = opts?.lines?.length ? opts.lines : [text];
  return new TableCell({
    borders,
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts?.columnSpan,
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts?.fill ? { fill: opts.fill } : undefined,
    children: lines.map(
      (line, i) =>
        new Paragraph({
          alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: i === lines.length - 1 ? 40 : 0 },
          children: [
            new TextRun({
              text: line,
              font: "Arial",
              size: 18,
              bold: opts?.bold && i === 0,
              color: INK,
            }),
          ],
        }),
    ),
  });
}

function metaPair(label: string, value: string) {
  return new TableCell({
    borders: {
      top: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
    },
    width: { size: 4680, type: WidthType.DXA },
    children: [
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `${label}  `, font: "Arial", size: 16, bold: true, color: GREEN }),
          new TextRun({ text: value, font: "Arial", size: 18, color: INK }),
        ],
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


/** Voorblad-cel: label + waarde (of invullijn). */
function voorbladCel(
  label: string,
  value: string,
  opts?: { width?: number; blankLine?: boolean; rowSpan?: number },
) {
  const kids = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: label, font: FONT, size: SMALL_SIZE, bold: true, color: INK })],
    }),
  ];
  if (opts?.blankLine) {
    kids.push(
      new Paragraph({
        spacing: { after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } },
        children: [new TextRun({ text: " ", font: FONT, size: BODY_SIZE })],
      }),
    );
  } else {
    kids.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: value || " ", font: FONT, size: BODY_SIZE, color: INK })],
      }),
    );
  }
  return new TableCell({
    borders,
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    children: kids,
  });
}

function voorbladBlocks(toets: GegenereerdeToets): (Paragraph | Table)[] {
  const t = withDefaults(toets);
  const m = t.meta;
  const max = totaalPunten(t.vragen);
  const cesuur = cesuurPunten(max, t.cijferNorm);
  const hulpmiddelen = (m.hulpmiddelen?.length ? m.hulpmiddelen : ["Binas", "Rekenmachine"]).join(", ");
  const w = 4680;
  const rows: TableRow[] = [
    new TableRow({
      children: [
        voorbladCel("Vak", m.vak || "—", { width: w }),
        voorbladCel("Naam", "", { width: w, blankLine: true }),
      ],
    }),
    new TableRow({
      children: [
        voorbladCel("Toets titel / onderwerp en toetscode", m.titel || "—", { width: w }),
        voorbladCel("Klas", `${m.leerjaar}${m.leerweg}`, { width: w }),
      ],
    }),
    new TableRow({
      children: [
        voorbladCel("Toetsduur", `${m.duurMinuten} minuten`, { width: w }),
        voorbladCel("Datum", "", { width: w, blankLine: true }),
      ],
    }),
    new TableRow({
      children: [
        (m.extraTijd?.trim()
          ? voorbladCel("Extra tijd 20%", m.extraTijd.trim(), { width: w })
          : voorbladCel("Extra tijd 20%", "", { width: w, blankLine: true })),
        voorbladCel("Behaalde aantal punten", "", { width: w, blankLine: true }),
      ],
    }),
    new TableRow({
      children: [
        voorbladCel("Hulpmiddelen", hulpmiddelen, { width: w }),
        voorbladCel("Eindresultaat", "", { width: w, blankLine: true }),
      ],
    }),
    new TableRow({
      children: [
        voorbladCel("Totaal te behalen punten", String(max), { width: w }),
        voorbladCel("School", m.school || SCHOOL, { width: w }),
      ],
    }),
    new TableRow({
      children: [
        voorbladCel("Cesuur", `5,5 bij ${cesuur} punten`, { width: w }),
        voorbladCel("", "", { width: w }),
      ],
    }),
  ];
  return [
    p(SCHOOL, { bold: true, size: 28, after: 200 }),
    new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [w, w], rows }),
    new Paragraph({
      children: [new PageBreak()],
    }),
  ];
}

async function toetsParagrafen(toets: GegenereerdeToets): Promise<DocChild[]> {
  const t = withDefaults(toets);
  const m = t.meta;
  const out: DocChild[] = [...voorbladBlocks(t)];
  if (m.instructies.length) {
    out.push(p("Instructie", { after: 60 }));
    for (const s of m.instructies) out.push(p(s, { size: SMALL_SIZE, after: 40 }));
    out.push(p("", { after: 120 }));
  }
  for (const q of t.vragen) {
    const stam = (q.stam || "").trim();
    // Cito/school: context → figuur → genummerde vraagstam.
    if (q.context?.trim()) {
      out.push(p(q.context.trim(), { size: BODY_SIZE, before: 200, after: 80 }));
    }
    out.push(...(await vraagFiguurBlocks(q)));
    out.push(
      new Paragraph({
        spacing: { before: q.context?.trim() || q.tabel || q.grafiek || q.schemaFiguur ? 40 : 200, after: 80, line: 276, lineRule: "auto" },
        indent: { left: 709, hanging: 709 },
        children: [
          new TextRun({ text: `${q.punten}p`, font: FONT, size: BODY_SIZE, bold: true, color: INK }),
          new TextRun({
            text: stam ? `  ${q.nummer}  ${stam}` : `  ${q.nummer}`,
            font: FONT,
            size: BODY_SIZE,
            color: INK,
          }),
        ],
      }),
    );
    if (q.opties?.length) {
      for (const o of q.opties) {
        out.push(
          new Paragraph({
            spacing: { after: 40, line: 276, lineRule: "auto" },
            indent: { left: 709 },
            children: [
              new TextRun({
                // Leeg vierkant om aan te kruisen vóór de letter.
                text: `☐  ${o.letter}  ${o.tekst}`,
                font: FONT,
                size: BODY_SIZE,
                color: INK,
              }),
            ],
          }),
        );
      }
    } else {
      // Open: aantal antwoordlijnen ≈ punten + 1 (minimaal 2).
      const lijnen = Math.max(2, (Number(q.punten) || 1) + 1);
      for (let i = 0; i < lijnen; i++) {
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
    out.push(
      new Paragraph({
        spacing: { before: 200, after: 80, line: 276, lineRule: "auto" },
        indent: { left: 709, hanging: 709 },
        children: [
          new TextRun({ text: `${punten}p`, font: FONT, size: BODY_SIZE, bold: true, color: INK }),
          new TextRun({
            text: stam ? `  ${n.nummer}  ${stam}` : `  ${n.nummer}`,
            font: FONT,
            size: BODY_SIZE,
            color: INK,
          }),
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
  const max = totaalPunten(t.vragen);
  const cesuur = cesuurPunten(max, t.cijferNorm);
  const fill = "E8F0EA";
  const wOnderwerp = 2600;
  const wVragen = 1400;
  const wRtti = 1100;
  const wTotaal = 960;

  const meta = new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          metaPair("Vak", t.meta.vak || "—"),
          metaPair("Naam toets", t.meta.titel || "—"),
        ],
      }),
      new TableRow({
        children: [
          metaPair("Leerweg", t.meta.leerweg),
          metaPair("Toetsvorm", "schriftelijke toets"),
        ],
      }),
      new TableRow({
        children: [
          metaPair("Leerjaar", String(t.meta.leerjaar)),
          metaPair(
            "Cesuur",
            `${cesuur} van de ${max} punten (${t.cijferNorm.cesuurPct}%)`,
          ),
        ],
      }),
    ],
  });

  const headerTop = new TableRow({
    children: [
      cell("Onderwerpen / toetsdoelen", { bold: true, fill, width: wOnderwerp }),
      cell("Vragen", { bold: true, fill, center: true, width: wVragen }),
      cell("Aantal punten (RTTI)", {
        bold: true,
        fill,
        center: true,
        columnSpan: 4,
        width: wRtti * 4,
      }),
      cell("Totaal", { bold: true, fill, center: true, width: wTotaal }),
    ],
  });
  const headerRtti = new TableRow({
    children: [
      cell("", { fill, width: wOnderwerp }),
      cell("", { fill, width: wVragen }),
      ...RTTI_ORDER.map((k) =>
        cell(RTTI_META[k].kort, {
          bold: true,
          fill,
          center: true,
          width: wRtti,
          lines: [RTTI_META[k].kort, RTTI_META[k].naam],
        }),
      ),
      cell("%", { bold: true, fill, center: true, width: wTotaal }),
    ],
  });

  const rows: TableRow[] = [headerTop, headerRtti];
  let nr = 0;
  for (const d of matrijs.domeinen) {
    nr += 1;
    const row = matrijs.cellen[d];
    const alleVragen = RTTI_ORDER.flatMap((k) => row?.[k]?.vraagnummers ?? []);
    const unieke = [...new Set(alleVragen)].sort((a, b) => a - b);
    const domeinPunten = RTTI_ORDER.reduce((s, k) => s + (row?.[k]?.punten ?? 0), 0);
    const pct = max > 0 ? Math.round((domeinPunten / max) * 100) : 0;
    rows.push(
      new TableRow({
        children: [
          cell(`${nr}.  ${d}`, { bold: true, width: wOnderwerp }),
          cell(unieke.join(", ") || "—", { center: true, width: wVragen }),
          ...RTTI_ORDER.map((k) => {
            const cel = row?.[k];
            if (!cel || cel.punten <= 0) return cell("", { center: true, width: wRtti });
            const nums = cel.vraagnummers.join(", ");
            return cell("", {
              center: true,
              width: wRtti,
              lines: [String(cel.punten), `(${nums})`],
            });
          }),
          cell(`${pct}%`, { center: true, bold: true, width: wTotaal }),
        ],
      }),
    );
  }

  const aantalVragen = t.vragen.length;
  rows.push(
    new TableRow({
      children: [
        cell("Totaal", { bold: true, fill, width: wOnderwerp }),
        cell(String(aantalVragen), { bold: true, fill, center: true, width: wVragen }),
        ...RTTI_ORDER.map((k) =>
          cell(`${matrijs.totalen[k]?.percentage ?? 0}%`, {
            bold: true,
            fill,
            center: true,
            width: wRtti,
          }),
        ),
        cell("100%", { bold: true, fill, center: true, width: wTotaal }),
      ],
    }),
  );

  const out: (Paragraph | Table)[] = [
    heading("Toetsmatrijs · schriftelijke toets"),
    sub(`RTTI · versie ${t.meta.versie}`),
    meta,
    p("", { after: 120 }),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [wOnderwerp, wVragen, wRtti, wRtti, wRtti, wRtti, wTotaal],
      rows,
    }),
    p("", { after: 80 }),
    sub(
      RTTI_ORDER.map((k) => `${RTTI_META[k].kort} = ${RTTI_META[k].naam}`).join("  ·  "),
    ),
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
  const leerling = await toetsParagrafen(t);
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
    sections: [
      { properties: { page: { size: PAGE_A4, margin: PAGE_MARGINS } }, ...schoolLeerlingChrome(), children: leerling },
      { properties: { page: { size: PAGE_A4, margin: PAGE_MARGINS } }, ...schoolLeerlingChrome(), children: nakijkParagrafen(t) },
      { properties: { page: { size: PAGE_A4, margin: PAGE_MARGINS } }, ...headerFooter("Toetsmatrijs"), children: matrijsBlocks(t) },
      { properties: { page: { size: PAGE_A4, margin: PAGE_MARGINS } }, ...headerFooter("Cijferomzetting"), children: cijferParagrafen(t) },
    ],
  });
  await saveDoc(doc, `${slug(t.meta.titel)}-versie-${t.meta.versie}-pakket.docx`);
}

/** Alleen leerlingblad (voorblad + vragen), met figuren. */
export async function downloadLeerlingDocx(toets: GegenereerdeToets) {
  const t = withDefaults(toets);
  const leerling = await toetsParagrafen(t);
  await saveDoc(docOf(leerling, `Toets versie ${t.meta.versie}`), `${slug(t.meta.titel)}-versie-${t.meta.versie}.docx`);
}