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
  PageBreak,
  VerticalAlign,
} from "docx";
import { RTTI_META, RTTI_ORDER, SCHOOL } from "./constants";
import { cesuurZin, formuleTekst, modelLabel, omzetTabel, voldoendeHint } from "./cijfer";
import { totaalPunten } from "./rtti";
import { slug } from "./text";
import type { CijferNorm, GegenereerdeToets, VraagGrafiek } from "./types";
import { withDefaults } from "./defaults";

const GREEN = "004422";
const INK = "0A2E22";
const MUTED = "1E4A38";

const thin = { style: BorderStyle.SINGLE, size: 4, color: "C3D7EE" };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function p(text: string, opts?: { bold?: boolean; size?: number; color?: string; italics?: boolean }) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: opts?.size ?? 22,
        bold: opts?.bold,
        italics: opts?.italics,
        color: opts?.color ?? INK,
      }),
    ],
  });
}

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 160 },
    children: [
      new TextRun({ text, font: "Arial", size: 32, bold: true, color: GREEN }),
    ],
  });
}

function sub(text: string) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text, font: "Arial", size: 18, color: MUTED }),
    ],
  });
}

function cell(text: string, opts?: { bold?: boolean; width?: number; fill?: string }) {
  return new TableCell({
    borders,
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts?.fill ? { fill: opts.fill } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: "Arial",
            size: 18,
            bold: opts?.bold,
            color: INK,
          }),
        ],
      }),
    ],
  });
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

function asciiGrafiek(g: VraagGrafiek): string[] {
  const pts = [...g.punten].sort((a, b) => a.x - b.x);
  if (pts.length < 2) {
    return pts.map((pt) => `${pt.x} → ${pt.y}`);
  }
  const rows = 6;
  const cols = 28;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const grid = Array.from({ length: rows }, () => Array<string>(cols).fill(" "));
  for (const p of pts) {
    const c = Math.round(((p.x - minX) / spanX) * (cols - 1));
    const r = rows - 1 - Math.round(((p.y - minY) / spanY) * (rows - 1));
    grid[r]![c] = "*";
  }
  const fmt = (n: number) => String(n).replace(".", ",");
  const lines = grid.map((row, i) => {
    const label =
      i === 0 ? fmt(maxY).padStart(6) : i === rows - 1 ? fmt(minY).padStart(6) : "      ";
    return `${label} |${row.join("")}`;
  });
  lines.push(`       +${"-".repeat(cols)}`);
  lines.push(
    `        ${g.xLabel || "x"}  ${fmt(minX)} … ${fmt(maxX)}${g.yLabel ? `   (${g.yLabel})` : ""}`,
  );
  return lines;
}

function toetsParagrafen(toets: GegenereerdeToets): (Paragraph | Table)[] {
  const t = withDefaults(toets);
  const m = t.meta;
  const max = totaalPunten(t.vragen);
  const out: (Paragraph | Table)[] = [
    heading(m.titel),
    sub(
      `${m.vak} · ${m.leerweg} klas ${m.leerjaar} · versie ${m.versie} · ${m.moeilijkheid}`,
    ),
    p(`Tijd: ${m.duurMinuten} minuten. Maximumscore: ${max} punten. ${t.vragen.length} vragen.`),
    p("Naam: ________________________    Klas: ________    Datum: ________"),
    p(`Hulpmiddelen: ${m.hulpmiddelen.join(" · ") || "geen"}`, { italics: true }),
  ];
  if (m.instructies.length) {
    out.push(p("Instructie", { bold: true }));
    for (const s of m.instructies) out.push(p(`• ${s}`));
  }
  for (const q of t.vragen) {
    out.push(p(`Vraag ${q.nummer}  (${q.punten} punten)`, { bold: true, size: 24 }));
    if (q.context) out.push(p(q.context, { italics: true }));
    for (const line of q.stam.split("\n")) out.push(p(line || " "));
    if (q.tabel?.koppen.length) {
      const rows: TableRow[] = [
        new TableRow({
          children: q.tabel.koppen.map((k) => cell(k, { bold: true, fill: "E8F0EA" })),
        }),
        ...q.tabel.rijen.map(
          (rij) => new TableRow({ children: rij.map((c) => cell(c)) }),
        ),
      ];
      out.push(
        new Table({ width: { size: 9000, type: WidthType.DXA }, rows }),
      );
    }
    if (q.grafiek?.punten.length) {
      out.push(p(q.grafiek.titel || "Grafiek", { bold: true }));
      for (const line of asciiGrafiek(q.grafiek)) {
        out.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: line,
                font: "Courier New",
                size: 16,
                color: INK,
              }),
            ],
          }),
        );
      }
    }
    if (q.opties?.length) {
      for (const o of q.opties) out.push(p(`${o.letter}.  ${o.tekst}`));
    }
  }
  return out;
}

function nakijkParagrafen(toets: GegenereerdeToets): (Paragraph | Table)[] {
  const t = withDefaults(toets);
  const max = totaalPunten(t.vragen);
  const tabel = omzetTabel(max, t.cijferNorm);
  const out: (Paragraph | Table)[] = [
    heading(`Nakijkmodel · ${t.meta.titel}`),
    sub("Niet voor leerlingen"),
    p(formuleTekst(t.cijferNorm, max), { bold: true }),
    p(cesuurZin(max, t.cijferNorm)),
    p("Omzettingstabel (punten → cijfer)", { bold: true }),
  ];

  const rows: TableRow[] = [
    new TableRow({
      children: [cell("Punten", { bold: true }), cell("Cijfer", { bold: true })],
    }),
  ];
  for (const rij of tabel) {
    rows.push(
      new TableRow({
        children: [cell(String(rij.punten)), cell(rij.cijfer.toFixed(1).replace(".", ","))],
      }),
    );
  }
  out.push(
    new Table({
      width: { size: 4000, type: WidthType.DXA },
      rows,
    }),
  );

  for (const n of t.nakijkmodel) {
    const q = t.vragen.find((v) => v.nummer === n.nummer);
    out.push(
      p(
        `Vraag ${n.nummer}  (${q?.punten ?? "?"}p)  ${q ? RTTI_META[q.rtti].kort : ""}  ${q?.domein ?? ""}`,
        { bold: true },
      ),
    );
    out.push(p(`Modelantwoord: ${n.modelantwoord}`));
    for (const pc of n.puntenverdeling) {
      out.push(p(`  ${pc.punt}p — ${pc.criterium}`));
    }
    if (n.nietToekennen?.length) {
      out.push(p(`Niet toekennen: ${n.nietToekennen.join(" · ")}`, { italics: true }));
    }
  }
  return out;
}

function matrijsBlocks(toets: GegenereerdeToets): (Paragraph | Table)[] {
  const t = withDefaults(toets);
  const { matrijs } = t;
  const max = totaalPunten(t.vragen);
  const header = [
    cell("Domein", { bold: true, fill: "E8F0EA" }),
    ...RTTI_ORDER.map((k) => cell(RTTI_META[k].kort, { bold: true, fill: "E8F0EA" })),
    cell("Totaal", { bold: true, fill: "E8F0EA" }),
  ];
  const rows: TableRow[] = [new TableRow({ children: header })];
  for (const d of matrijs.domeinen) {
    const row = matrijs.cellen[d];
    const tot = RTTI_ORDER.reduce((s, k) => s + (row?.[k]?.punten ?? 0), 0);
    rows.push(
      new TableRow({
        children: [
          cell(d, { bold: true }),
          ...RTTI_ORDER.map((k) => {
            const cel = row?.[k];
            if (!cel || cel.punten <= 0) return cell("—");
            return cell(`${cel.vraagnummers.map((n) => `v${n}`).join(" ")} (${cel.punten}p)`);
          }),
          cell(`${tot}p`, { bold: true }),
        ],
      }),
    );
  }
  rows.push(
    new TableRow({
      children: [
        cell("Totaal", { bold: true }),
        ...RTTI_ORDER.map((k) =>
          cell(`${matrijs.totalen[k].punten}p · ${matrijs.totalen[k].percentage}%`, { bold: true }),
        ),
        cell(`${max}p`, { bold: true }),
      ],
    }),
  );

  const out: (Paragraph | Table)[] = [
    heading(`Toetsmatrijs · ${t.meta.titel}`),
    sub(`RTTI · versie ${t.meta.versie} · ${t.meta.leerweg} klas ${t.meta.leerjaar}`),
    new Table({ width: { size: 9360, type: WidthType.DXA }, rows }),
    p(" "),
    p("Leerdoelen per vraag", { bold: true }),
  ];
  for (const q of t.vragen) {
    out.push(
      p(`v${q.nummer}  ${q.leerdoel}  (${q.domein} · ${q.punten}p · ${RTTI_META[q.rtti].naam})`),
    );
  }
  if (t.soort === "matrijs" && t.kwaliteit?.punten?.length) {
    out.push(p(" "), heading("Feedback op de toets"));
    out.push(p(t.kwaliteit.samenvatting));
    for (const k of t.kwaliteit.punten) {
      out.push(
        p(`${k.criterium} · ${k.oordeel}`, { bold: true }),
        p(k.toelichting),
      );
    }
  }
  return out;
}

function kwaliteitParagrafen(toets: GegenereerdeToets): (Paragraph | Table)[] {
  const t = withDefaults(toets);
  const oordeelLabel: Record<string, string> = {
    voldoet: "Voldoet",
    aandacht: "Aandacht",
    ontbreekt: "Ontbreekt",
  };
  const out: (Paragraph | Table)[] = [
    heading(`Kwaliteitscheck · ${t.meta.titel}`),
    sub(
      `${t.meta.vak} · ${t.meta.leerweg} klas ${t.meta.leerjaar} · versie ${t.meta.versie}`,
    ),
    p(
      "Constructiehulp. Jouw vakoordeel gaat hier boven. Docent controleert altijd inhoud en cesuur.",
      { italics: true },
    ),
    p(t.kwaliteit.samenvatting || "Geen samenvatting."),
  ];
  for (const k of t.kwaliteit.punten) {
    out.push(
      p(`${k.criterium} · ${oordeelLabel[k.oordeel] ?? k.oordeel}`, { bold: true }),
      p(k.toelichting),
    );
  }
  return out;
}

function cijferParagrafenVan(
  max: number,
  norm: CijferNorm,
  titel: string,
  subregel: string,
): (Paragraph | Table)[] {
  const tabel = omzetTabel(max, norm);
  const rows: TableRow[] = [
    new TableRow({
      children: [
        cell("Punten", { bold: true, fill: "E8F0EA" }),
        cell("Cijfer", { bold: true, fill: "E8F0EA" }),
      ],
    }),
  ];
  for (const rij of tabel) {
    rows.push(
      new TableRow({
        children: [
          cell(String(rij.punten)),
          cell(rij.cijfer.toFixed(1).replace(".", ",")),
        ],
      }),
    );
  }
  return [
    heading(titel),
    sub(subregel),
    p(formuleTekst(norm, max), { bold: true }),
    p(voldoendeHint(norm)),
    p(cesuurZin(max, norm)),
    p("Omzettingstabel (punten → cijfer)", { bold: true }),
    new Table({ width: { size: 4000, type: WidthType.DXA }, rows }),
  ];
}

function cijferParagrafen(toets: GegenereerdeToets): (Paragraph | Table)[] {
  const t = withDefaults(toets);
  const max = totaalPunten(t.vragen);
  return cijferParagrafenVan(
    max,
    t.cijferNorm,
    `Cijferomzetting · ${t.meta.titel}`,
    `${modelLabel(t.cijferNorm.model)} · versie ${t.meta.versie} · ${t.meta.leerweg} klas ${t.meta.leerjaar}`,
  );
}

function docOf(
  children: (Paragraph | Table)[],
  label: string,
) {
  return new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 } },
        },
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
  a.type =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  await new Promise((resolve) => window.setTimeout(resolve, 1500));
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadToetsDocx(toets: GegenereerdeToets) {
  const t = withDefaults(toets);
  await saveDoc(
    docOf(toetsParagrafen(t), `Toets versie ${t.meta.versie}`),
    `${slug(t.meta.titel)}-versie-${t.meta.versie}-toets.docx`,
  );
}

export async function downloadNakijkDocx(toets: GegenereerdeToets) {
  const t = withDefaults(toets);
  await saveDoc(
    docOf(nakijkParagrafen(t), `Nakijkmodel versie ${t.meta.versie}`),
    `${slug(t.meta.titel)}-versie-${t.meta.versie}-nakijkmodel.docx`,
  );
}

export async function downloadMatrijsDocx(toets: GegenereerdeToets) {
  const t = withDefaults(toets);
  await saveDoc(
    docOf(matrijsBlocks(t), `Toetsmatrijs versie ${t.meta.versie}`),
    `${slug(t.meta.titel)}-versie-${t.meta.versie}-matrijs.docx`,
  );
}

export async function downloadCijferDocx(toets: GegenereerdeToets) {
  const t = withDefaults(toets);
  await saveDoc(
    docOf(cijferParagrafen(t), `Cijferomzetting versie ${t.meta.versie}`),
    `${slug(t.meta.titel)}-versie-${t.meta.versie}-cijfer.docx`,
  );
}

export async function downloadCijferTabelDocx(opts: {
  titel?: string;
  max: number;
  norm: CijferNorm;
}) {
  const titel = opts.titel?.trim() || "Cijferomzetting";
  await saveDoc(
    docOf(
      cijferParagrafenVan(
        opts.max,
        opts.norm,
        titel,
        `${modelLabel(opts.norm.model)} · maximum ${opts.max} punten`,
      ),
      "Cijferomzetting",
    ),
    `${slug(titel)}-${opts.norm.model}-${opts.max}p.docx`,
  );
}

export async function downloadPakketDocx(toets: GegenereerdeToets) {
  const t = withDefaults(toets);
  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 } } },
        ...headerFooter(`Toets versie ${t.meta.versie}`),
        children: toetsParagrafen(t),
      },
      {
        properties: { page: { size: { width: 11906, height: 16838 } } },
        ...headerFooter("Nakijkmodel — niet voor leerlingen"),
        children: [new Paragraph({ children: [new PageBreak()] }), ...nakijkParagrafen(t)],
      },
      {
        properties: { page: { size: { width: 11906, height: 16838 } } },
        ...headerFooter("Toetsmatrijs — niet voor leerlingen"),
        children: [...matrijsBlocks(t)],
      },
      {
        properties: { page: { size: { width: 11906, height: 16838 } } },
        ...headerFooter("Cijferomzetting — niet voor leerlingen"),
        children: [...cijferParagrafen(t)],
      },
    ],
  });
  await saveDoc(doc, `${slug(t.meta.titel)}-versie-${t.meta.versie}-pakket.docx`);
}

export async function downloadKwaliteitDocx(toets: GegenereerdeToets) {
  const t = withDefaults(toets);
  await saveDoc(
    docOf(kwaliteitParagrafen(t), `Kwaliteitscheck · ${t.meta.titel}`),
    `${slug(t.meta.titel)}-versie-${t.meta.versie}-kwaliteit.docx`,
  );
}
