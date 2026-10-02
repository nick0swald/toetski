/**
 * Kleine opmaakmachine bovenop pdfkit (Node, ook op Vercel): rich text met <b>, <i>, <sub>, <sup>, <br/>,
 * <small>, <font color>, blokken met meetbare hoogte, tabellen met cellen vol blokken, en KeepTogether — genoeg
 * om de opmaak van build.py (reportlab platypus) na te bouwen.
 */
import PDFDocument from "pdfkit";

export type Doc = InstanceType<typeof PDFDocument>;
export const CM = 72 / 2.54;
export const A4 = { w: 595.28, h: 841.89 };

export interface Stijl {
  font: "Arial" | "Arial-Bold";
  size: number;
  leading: number;
  kleur?: string;
  uitlijning?: "links" | "midden";
}

export const ST: Record<string, Stijl> = {
  body: { font: "Arial", size: 10.5, leading: 10.5 * 1.35 },
  small: { font: "Arial", size: 8.5, leading: 10.5 },
  h1: { font: "Arial-Bold", size: 18, leading: 23 },
  h2: { font: "Arial-Bold", size: 13, leading: 17 },
  band: { font: "Arial-Bold", size: 10, leading: 12.5 },
  bandw: { font: "Arial-Bold", size: 10, leading: 12.5, kleur: "#ffffff", uitlijning: "midden" },
  sectie: { font: "Arial-Bold", size: 13, leading: 16, kleur: "#ffffff", uitlijning: "midden" },
  ans: { font: "Arial", size: 9.8, leading: 14 },
  cell: { font: "Arial", size: 9.5, leading: 11.5 },
  cellb: { font: "Arial-Bold", size: 9.5, leading: 11.5 },
  idx: { font: "Arial", size: 8, leading: 9.6 },
  idxb: { font: "Arial-Bold", size: 8, leading: 9.6 },
  pn: { font: "Arial-Bold", size: 10.5, leading: 10.5 * 1.35 },
};

const SYMBOOL = /[\u2259\u22c5]/;

interface Run {
  tekst: string;
  bold: boolean;
  size: number;
  rise: number;
  kleur: string;
}

/** Markup → runs. */
function runs(markup: string, st: Stijl): Run[] {
  const out: Run[] = [];
  let bold = st.font === "Arial-Bold";
  const kleuren = [st.kleur ?? "#000000"];
  const sizes = [st.size];
  let rise = 0;
  const re = /<(\/?)(b|i|sub|sup|small|font|br)\b([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    if (m[4] !== undefined) {
      const t = m[4].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      out.push({ tekst: t, bold, size: sizes[sizes.length - 1], rise, kleur: kleuren[kleuren.length - 1] });
      continue;
    }
    const [, sluit, tag, attrs] = m;
    if (tag === "br") {
      out.push({ tekst: "\n", bold, size: sizes[sizes.length - 1], rise, kleur: kleuren[kleuren.length - 1] });
      continue;
    }
    if (tag === "b") bold = !sluit ? true : st.font === "Arial-Bold";
    else if (tag === "sub" || tag === "sup") {
      if (!sluit) {
        sizes.push(Math.round(st.size * 0.72 * 10) / 10);
        rise = tag === "sub" ? -st.size * 0.15 : st.size * 0.33;
      } else {
        sizes.pop();
        rise = 0;
      }
    } else if (tag === "small") {
      if (!sluit) sizes.push(st.size * 0.85);
      else sizes.pop();
    } else if (tag === "font") {
      if (!sluit) kleuren.push(/color="([^"]+)"/.exec(attrs)?.[1] ?? kleuren[kleuren.length - 1]);
      else if (kleuren.length > 1) kleuren.pop();
    }
  }
  return out;
}

interface Stuk extends Run {
  w: number;
  spatieNa: boolean;
}

type FontAlias = "Arial" | "Arial-Bold" | "Sym";
/**
 * pdfkit cachet een font onder z'n PostScript-naam; een registerFont-alias voor
 * hetzelfde font wordt dan bij elke doc.font() opnieuw geparsed (≈ 25 s voor één
 * toets). Daarom kiezen we het font via de echte naam (zie maakPdf).
 */
const fontNamen = new WeakMap<Doc, Record<FontAlias, string>>();
function kiesFont(doc: Doc, alias: FontAlias): Doc {
  return doc.font(fontNamen.get(doc)?.[alias] ?? alias);
}

function zetFont(doc: Doc, r: { bold: boolean; size: number }, tekst: string) {
  kiesFont(doc, SYMBOOL.test(tekst) ? "Sym" : r.bold ? "Arial-Bold" : "Arial").fontSize(r.size);
}

/** Splits op spaties; symbooltekens krijgen een eigen stuk (eigen font). */
function stukken(doc: Doc, rs: Run[]): (Stuk | "\n")[] {
  const out: (Stuk | "\n")[] = [];
  for (const r of rs) {
    if (r.tekst === "\n") {
      out.push("\n");
      continue;
    }
    const woorden = r.tekst.split(/( +)/);
    for (const w of woorden) {
      if (!w) continue;
      if (/^ +$/.test(w)) {
        const laatste = out[out.length - 1];
        if (laatste && laatste !== "\n") laatste.spatieNa = true;
        continue;
      }
      for (const deel of w.split(/([\u2259\u22c5])/)) {
        if (!deel) continue;
        zetFont(doc, r, deel);
        out.push({ ...r, tekst: deel, w: doc.widthOfString(deel), spatieNa: false });
      }
    }
  }
  return out;
}

interface Regel {
  stukken: Stuk[];
  w: number;
}

function breek(doc: Doc, markup: string, st: Stijl, breedte: number): Regel[] {
  const st2 = stukken(doc, runs(markup, st));
  const regels: Regel[] = [];
  let cur: Stuk[] = [];
  let w = 0;
  const spatie = (s: Stuk) => {
    kiesFont(doc, s.bold ? "Arial-Bold" : "Arial").fontSize(s.size);
    return doc.widthOfString(" ");
  };
  for (const s of st2) {
    if (s === "\n") {
      regels.push({ stukken: cur, w });
      cur = [];
      w = 0;
      continue;
    }
    const prev = cur[cur.length - 1];
    const extra = prev && prev.spatieNa ? spatie(prev) : 0;
    if (cur.length && w + extra + s.w > breedte + 0.01) {
      regels.push({ stukken: cur, w });
      cur = [s];
      w = s.w;
    } else {
      cur.push(s);
      w += extra + s.w;
    }
  }
  if (cur.length || !regels.length) regels.push({ stukken: cur, w });
  return regels;
}

// ── blokken ─────────────────────────────────────────────────────────────────────────────────────

export interface Blok {
  hoogte(doc: Doc, w: number): number;
  teken(doc: Doc, x: number, y: number, w: number): void;
  /** Mag de flow hier een pagina afbreken binnen het blok (bv. lange tabel)? Dan geeft splits() de delen. */
  splits?(doc: Doc, w: number): Blok[];
  paginaNa?: boolean;
  bijeen?: boolean;
}

export class Para implements Blok {
  markup: string;
  st: Stijl;
  na: number;
  constructor(markup: string, st: Stijl = ST.body, na = 0) {
    this.markup = markup;
    this.st = st;
    this.na = na;
  }
  hoogte(doc: Doc, w: number) {
    return breek(doc, this.markup, this.st, w).length * this.st.leading + this.na;
  }
  teken(doc: Doc, x: number, y: number, w: number) {
    const regels = breek(doc, this.markup, this.st, w);
    regels.forEach((r, i) => {
      let cx = this.st.uitlijning === "midden" ? x + (w - r.w) / 2 : x;
      // pdfkit-tekst staat met de bovenkant op y; de basislijn ligt ~0,8·size lager. Centreer in de regelhoogte.
      const top = y + i * this.st.leading + (this.st.leading - this.st.size * 1.15) / 2;
      r.stukken.forEach((s, j) => {
        zetFont(doc, s, s.tekst);
        doc.fillColor(s.kleur);
        const dy = (this.st.size - s.size) * 0.8 - s.rise;
        doc.text(s.tekst, cx, top + dy, { lineBreak: false });
        cx += s.w;
        if (s.spatieNa && j < r.stukken.length - 1) {
          kiesFont(doc, s.bold ? "Arial-Bold" : "Arial").fontSize(s.size);
          cx += doc.widthOfString(" ");
        }
      });
    });
    doc.fillColor("#000000");
  }
}

export class Ruimte implements Blok {
  h: number;
  constructor(h: number) {
    this.h = h;
  }
  hoogte() {
    return this.h;
  }
  teken() {}
}

export class PaginaEinde implements Blok {
  paginaNa = true;
  hoogte() {
    return 0;
  }
  teken() {}
}

export class Beeld implements Blok {
  png: Uint8Array;
  wPt: number;
  hPt: number;
  uitlijning: "links" | "midden";
  constructor(png: Uint8Array, wPt: number, hPt: number, uitlijning: "links" | "midden" = "midden") {
    this.png = png;
    this.wPt = wPt;
    this.hPt = hPt;
    this.uitlijning = uitlijning;
  }
  hoogte() {
    return this.hPt;
  }
  teken(doc: Doc, x: number, y: number, w: number) {
    const bx = this.uitlijning === "midden" ? x + (w - this.wPt) / 2 : x;
    doc.image(Buffer.from(this.png), bx, y, { width: this.wPt, height: this.hPt });
  }
}

/** Stippellijnen als antwoordruimte (0,85 cm). */
export class Lijnen implements Blok {
  n: number;
  constructor(n: number) {
    this.n = n;
  }
  hoogte() {
    return this.n * 0.85 * CM + 0.1 * CM;
  }
  teken(doc: Doc, x: number, y: number, w: number) {
    doc.save().lineWidth(0.6).strokeColor("#595959").dash(1, { space: 2.2 });
    for (let i = 0; i < this.n; i++) {
      const ly = y + (i + 1) * 0.85 * CM;
      doc.moveTo(x, ly).lineTo(x + w, ly).stroke();
    }
    doc.undash().restore();
  }
}

export interface Cel {
  inhoud: Blok[];
  bg?: string;
  uitlijning?: "links" | "rechts";
}

export interface TabelOpties {
  kolommen: number[];
  pad?: { l: number; r: number; t: number; b: number };
  rooster?: { kleur: string; lw: number };
  rand?: { kleur: string; lw: number };
  lijnOnder?: { kleur: string; lw: number };
  /** Witte lijn onder elke rij (legenda). */
  rijLijn?: { kleur: string; lw: number };
  va?: "top" | "midden";
  bg?: string;
  kopRij?: boolean;
}

export class Tabel implements Blok {
  rijen: Cel[][];
  o: TabelOpties;
  constructor(rijen: (Cel | Blok[] | string)[][], o: TabelOpties) {
    this.rijen = rijen.map((r) => r.map((c) => (typeof c === "string" ? { inhoud: [new Para(c, ST.cell)] } : Array.isArray(c) ? { inhoud: c } : c)));
    this.o = o;
  }
  private pad() {
    return this.o.pad ?? { l: 6, r: 6, t: 3, b: 3 };
  }
  private rijHoogte(doc: Doc, r: Cel[]) {
    const p = this.pad();
    return Math.max(...r.map((c, i) => c.inhoud.reduce((s, b) => s + b.hoogte(doc, this.o.kolommen[i] - p.l - p.r), 0))) + p.t + p.b;
  }
  hoogte(doc: Doc) {
    return this.rijen.reduce((s, r) => s + this.rijHoogte(doc, r), 0);
  }
  splits(): Blok[] {
    if (this.rijen.length <= 1) return [this];
    const kop = this.o.kopRij ? this.rijen[0] : null;
    const rest = kop ? this.rijen.slice(1) : this.rijen;
    // Elke rij een eigen tabel (met de kop erboven op een nieuwe pagina zou mooier zijn; tabellen hier zijn kort).
    const delen: Blok[] = [];
    if (kop) delen.push(new Tabel([kop, rest[0]], this.o));
    for (const r of kop ? rest.slice(1) : rest) delen.push(new Tabel([r], { ...this.o, kopRij: false }));
    return delen;
  }
  teken(doc: Doc, x: number, y: number) {
    const p = this.pad();
    const totaalW = this.o.kolommen.reduce((a, b) => a + b, 0);
    let cy = y;
    const top = y;
    for (const r of this.rijen) {
      const h = this.rijHoogte(doc, r);
      let cx = x;
      r.forEach((c, i) => {
        const cw = this.o.kolommen[i];
        const bg = c.bg ?? this.o.bg;
        if (bg) doc.save().rect(cx, cy, cw, h).fill(bg).restore();
        const inh = c.inhoud.reduce((s, b) => s + b.hoogte(doc, cw - p.l - p.r), 0);
        let by = cy + p.t + (this.o.va === "midden" ? (h - p.t - p.b - inh) / 2 : 0);
        for (const b of c.inhoud) {
          const bw = cw - p.l - p.r;
          if (c.uitlijning === "rechts" && b instanceof Para) {
            const regels = breek(doc, b.markup, b.st, bw);
            const ww = Math.max(...regels.map((q) => q.w));
            b.teken(doc, cx + p.l + bw - ww, by, ww + 0.5);
          } else b.teken(doc, cx + p.l, by, bw);
          by += b.hoogte(doc, bw);
        }
        if (this.o.rooster) doc.save().lineWidth(this.o.rooster.lw).strokeColor(this.o.rooster.kleur).rect(cx, cy, cw, h).stroke().restore();
        cx += cw;
      });
      if (this.o.rijLijn) doc.save().lineWidth(this.o.rijLijn.lw).strokeColor(this.o.rijLijn.kleur).moveTo(x, cy + h).lineTo(x + totaalW, cy + h).stroke().restore();
      cy += h;
    }
    if (this.o.lijnOnder) doc.save().lineWidth(this.o.lijnOnder.lw).strokeColor(this.o.lijnOnder.kleur).moveTo(x, cy).lineTo(x + totaalW, cy).stroke().restore();
    if (this.o.rand) doc.save().lineWidth(this.o.rand.lw).strokeColor(this.o.rand.kleur).rect(x, top, totaalW, cy - top).stroke().restore();
  }
}

/** Blok ingesprongen (Cito: punten + nummer in de kantlijn). */
export class Ingesprongen implements Blok {
  b: Blok;
  links: number;
  constructor(b: Blok, links: number) {
    this.b = b;
    this.links = links;
  }
  hoogte(doc: Doc, w: number) {
    return this.b.hoogte(doc, w - this.links);
  }
  teken(doc: Doc, x: number, y: number, w: number) {
    this.b.teken(doc, x + this.links, y, w - this.links);
  }
}

export class Bijeen implements Blok {
  bijeen = true;
  blokken: Blok[];
  constructor(blokken: Blok[]) {
    this.blokken = blokken;
  }
  hoogte(doc: Doc, w: number) {
    return this.blokken.reduce((s, b) => s + b.hoogte(doc, w), 0);
  }
  teken(doc: Doc, x: number, y: number, w: number) {
    let cy = y;
    for (const b of this.blokken) {
      b.teken(doc, x, cy, w);
      cy += b.hoogte(doc, w);
    }
  }
  splits() {
    return this.blokken;
  }
}

export interface Fonts {
  regular: Uint8Array;
  bold: Uint8Array;
  symbool: Uint8Array;
}

/** Zet de blokken op A4 (marges 2,5 cm) met paginanummers onderaan; geeft de PDF-bytes. */
export async function maakPdf(blokken: Blok[], fonts: Fonts, meta: { titel: string }): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, font: Buffer.from(fonts.regular) as unknown as string, info: { Title: meta.titel, Author: "Toetski", CreationDate: new Date(Date.UTC(2026, 9, 9)) } });
  const namen = {} as Record<FontAlias, string>;
  for (const [alias, bytes] of [["Arial", fonts.regular], ["Arial-Bold", fonts.bold], ["Sym", fonts.symbool]] as const) {
    doc.font(Buffer.from(bytes) as unknown as string); // één keer parsen; pdfkit cachet onder de PostScript-naam
    namen[alias] = (doc as unknown as { _font: { name: string } })._font.name;
    doc.registerFont(namen[alias], Buffer.from(bytes));
  }
  fontNamen.set(doc, namen);
  const M = 2.5 * CM;
  const TW = A4.w - 2 * M;
  const onder = A4.h - M;
  let y = M;
  const nieuw = () => {
    doc.addPage({ size: "A4", margin: 0 });
    y = M;
  };
  const flow = (lijst: Blok[]) => {
    for (const b of lijst) {
      if (b.paginaNa) {
        if (y > M + 0.5) nieuw();
        continue;
      }
      const h = b.hoogte(doc, TW);
      if (y + h <= onder + 0.5) {
        b.teken(doc, M, y, TW);
        y += h;
        continue;
      }
      // Past niet: als het op een lege pagina wel past, eerst een nieuwe pagina; anders opsplitsen.
      if (h <= onder - M && y > M + 0.5) {
        nieuw();
        b.teken(doc, M, y, TW);
        y += h;
        continue;
      }
      const delen = b.splits?.(doc, TW);
      if (delen && delen.length > 1) flow(delen);
      else {
        if (y > M + 0.5) nieuw();
        b.teken(doc, M, y, TW);
        y += h;
      }
    }
  };
  flow(blokken);
  const bereik = doc.bufferedPageRange();
  for (let i = 0; i < bereik.count; i++) {
    doc.switchToPage(bereik.start + i);
    kiesFont(doc, "Arial").fontSize(9).fillColor("#000000");
    const t = String(i + 1);
    doc.text(t, A4.w / 2 - doc.widthOfString(t) / 2, A4.h - 1.3 * CM - 9, { lineBreak: false });
  }
  const delen: Buffer[] = [];
  doc.on("data", (d: Buffer) => delen.push(d));
  const klaar = new Promise<void>((res) => doc.on("end", () => res()));
  doc.end();
  await klaar;
  return new Uint8Array(Buffer.concat(delen));
}
