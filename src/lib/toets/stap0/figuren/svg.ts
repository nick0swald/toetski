/**
 * Kleine SVG-bouwer voor de stap-0-figuren. Alle maten in pt (1/72 inch), zodat lijndiktes en lettergroottes
 * dezelfde betekenis hebben als in makefigs.py (matplotlib). De figuur wordt in de toets op `breedteCm` geplaatst.
 */
export const PT_PER_CM = 72 / 2.54;

/**
 * Kolommen voor een set even grote panelen (bv. meerkeuze-opties A–D). Algemene regel: 4 panelen altijd als
 * 2 × 2 (A B / C D); 2–3 naast elkaar; meer dan 4 in rijen van 3.
 */
export function paneelKolommen(n: number): number {
  return n === 4 ? 2 : Math.min(Math.max(n, 1), 3);
}
export const ROOD = "#c0392b";
export const BLAUW = "#1f5f99";
const FONT = "Liberation Sans";

const r2 = (x: number) => Math.round(x * 100) / 100;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Tekst met <sub>/<sup>/<b> naar tspans (één regel). */
function tspans(markup: string, size: number): string {
  const parts = markup.split(/(<\/?(?:sub|sup|b)>)/);
  let out = "";
  let shift = 0;
  let bold = false;
  for (const p of parts) {
    if (p === "<sub>" || p === "<sup>") {
      const d = p === "<sub>" ? 0.3 : -0.4;
      shift += d;
      out += `<tspan dy="${r2(d * size)}" font-size="${r2(size * 0.72)}">`;
      continue;
    }
    if (p === "</sub>" || p === "</sup>") {
      const d = p === "</sub>" ? -0.3 : 0.4;
      shift += d;
      // Een lege tspan met dy herstelt de basislijn voor de rest van de regel.
      out += `</tspan><tspan dy="${r2(d * size)}">\u200b</tspan>`;
      continue;
    }
    if (p === "<b>") { bold = true; continue; }
    if (p === "</b>") { bold = false; continue; }
    if (p) out += bold ? `<tspan font-weight="bold">${esc(p)}</tspan>` : esc(p);
  }
  void shift;
  return out;
}

export interface TekstOpties {
  size?: number;
  anker?: "start" | "middle" | "end";
  /** Verticale uitlijning van de (eerste) regel. */
  va?: "baseline" | "center" | "top" | "bottom";
  bold?: boolean;
  kleur?: string;
  rol?: string;
  extra?: string;
}

export class Svg {
  readonly w: number;
  readonly h: number;
  private delen: string[] = [];
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }
  add(s: string) {
    this.delen.push(s);
  }
  line(x1: number, y1: number, x2: number, y2: number, o: { kleur?: string; lw?: number; dash?: string; cap?: string; rol?: string } = {}) {
    this.add(
      `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${o.kleur ?? "#000"}" stroke-width="${o.lw ?? 1}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""} stroke-linecap="${o.cap ?? "round"}"${o.rol ? ` data-rol="${o.rol}"` : ""}/>`,
    );
  }
  polyline(pts: [number, number][], o: { kleur?: string; lw?: number; rol?: string; extra?: string } = {}) {
    this.add(
      `<polyline points="${pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" ")}" fill="none" stroke="${o.kleur ?? "#000"}" stroke-width="${o.lw ?? 1}" stroke-linejoin="round" stroke-linecap="round"${o.rol ? ` data-rol="${o.rol}"` : ""}${o.extra ? ` ${o.extra}` : ""}/>`,
    );
  }
  polygon(pts: [number, number][], o: { fill?: string; kleur?: string; lw?: number; rol?: string; extra?: string } = {}) {
    this.add(
      `<polygon points="${pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" ")}" fill="${o.fill ?? "none"}" stroke="${o.kleur ?? "none"}" stroke-width="${o.lw ?? 1}" stroke-linejoin="miter"${o.rol ? ` data-rol="${o.rol}"` : ""}${o.extra ? ` ${o.extra}` : ""}/>`,
    );
  }
  rect(x: number, y: number, w: number, h: number, o: { fill?: string; kleur?: string; lw?: number; rol?: string; extra?: string } = {}) {
    this.add(
      `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${o.fill ?? "none"}" stroke="${o.kleur ?? "none"}" stroke-width="${o.lw ?? 1}"${o.rol ? ` data-rol="${o.rol}"` : ""}${o.extra ? ` ${o.extra}` : ""}/>`,
    );
  }
  circle(cx: number, cy: number, r: number, o: { fill?: string; kleur?: string; lw?: number; rol?: string } = {}) {
    this.add(
      `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${o.fill ?? "none"}" stroke="${o.kleur ?? "none"}" stroke-width="${o.lw ?? 1}"${o.rol ? ` data-rol="${o.rol}"` : ""}/>`,
    );
  }
  path(d: string, o: { fill?: string; kleur?: string; lw?: number; rol?: string } = {}) {
    this.add(`<path d="${d}" fill="${o.fill ?? "none"}" stroke="${o.kleur ?? "none"}" stroke-width="${o.lw ?? 1}"${o.rol ? ` data-rol="${o.rol}"` : ""}/>`);
  }
  /** Tekst; "\n" geeft meerdere regels (regelafstand 1,2). */
  text(x: number, y: number, markup: string, o: TekstOpties = {}) {
    const size = o.size ?? 11;
    const regels = markup.split("\n");
    const lh = size * 1.2;
    const n = regels.length;
    // dy van de eerste regel zodat de hele blok volgens va uitgelijnd is (cap-hoogte ≈ 0,72·size).
    const blok = (n - 1) * lh;
    let y0 = y;
    if (o.va === "center") y0 = y - blok / 2 + size * 0.36;
    else if (o.va === "top") y0 = y + size * 0.75;
    else if (o.va === "bottom") y0 = y - blok - size * 0.22;
    const inhoud = regels.map((r, i) => `<tspan x="${r2(x)}" y="${r2(y0 + i * lh)}">${tspans(r, size)}</tspan>`).join("");
    this.add(
      `<text font-family="${FONT}" font-size="${size}" text-anchor="${o.anker ?? "start"}"${o.bold ? ' font-weight="bold"' : ""} fill="${o.kleur ?? "#000"}"${o.rol ? ` data-rol="${o.rol}"` : ""}${o.extra ? ` ${o.extra}` : ""}>${inhoud}</text>`,
    );
  }
  groep(attrs: string, f: () => void) {
    this.add(`<g ${attrs}>`);
    f();
    this.add("</g>");
  }
  /** SVG op `breedteCm` (hoogte volgt de verhouding). */
  toString(breedteCm: number, extraRoot = ""): string {
    const hCm = (breedteCm * this.h) / this.w;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(breedteCm)}cm" height="${r2(hCm)}cm" viewBox="0 0 ${r2(this.w)} ${r2(this.h)}"${extraRoot ? ` ${extraRoot}` : ""}><rect width="100%" height="100%" fill="#fff"/>${this.delen.join("")}</svg>`;
  }
}

/** Lineaire afbeelding data → pt. */
export function schaal(d0: number, d1: number, p0: number, p1: number) {
  const f = (v: number) => p0 + ((v - d0) / (d1 - d0)) * (p1 - p0);
  f.inv = (p: number) => d0 + ((p - p0) / (p1 - p0)) * (d1 - d0);
  return f as ((v: number) => number) & { inv: (p: number) => number };
}

/** Pijlpunt (gevulde driehoek) met de punt precies op (x2,y2); geeft het eindpunt van de steel terug. */
export function pijl(s: Svg, x1: number, y1: number, x2: number, y2: number, o: { kleur?: string; lw?: number; kop?: number; breed?: number; rol?: string; extra?: string } = {}) {
  const kop = o.kop ?? 9;
  const breed = o.breed ?? 3.6;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const bx = x2 - ux * kop;
  const by = y2 - uy * kop;
  const kleur = o.kleur ?? "#000";
  s.groep(`${o.rol ? `data-rol="${o.rol}" ` : ""}${o.extra ?? ""}`, () => {
    s.line(x1, y1, bx + ux * 0.5, by + uy * 0.5, { kleur, lw: o.lw ?? 2.2, cap: "butt" });
    s.polygon(
      [
        [x2, y2],
        [bx - uy * breed, by + ux * breed],
        [bx + uy * breed, by - ux * breed],
      ],
      { fill: kleur, kleur, lw: 0.5 },
    );
  });
}

// ── eenvoudige SVG-lezer voor de figuurcontroles ─────────────────────────────────────────────────

export interface SvgEl {
  tag: string;
  attrs: Record<string, string>;
  /** Tekstinhoud (alleen bij <text>, zonder markup). */
  tekst?: string;
  /** data-attributen van omringende <g>-elementen (binnenste wint). */
  groep: Record<string, string>;
}

/** Leest alle elementen met hun attributen en de data-attributen van hun groepen (geen volledige XML-parser). */
export function leesSvg(svg: string): SvgEl[] {
  const out: SvgEl[] = [];
  const stapel: Record<string, string>[] = [];
  const re = /<(\/?)([a-z]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let tekstEl: SvgEl | null = null;
  const attrsVan = (s: string) => {
    const a: Record<string, string> = {};
    for (const x of s.matchAll(/([a-zA-Z0-9:-]+)="([^"]*)"/g)) a[x[1]] = x[2];
    return a;
  };
  while ((m = re.exec(svg))) {
    if (m[5] !== undefined) {
      if (tekstEl) tekstEl.tekst = (tekstEl.tekst ?? "") + m[5].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      continue;
    }
    const [, sluit, tag, rest, zelf] = m;
    if (tag === "tspan") {
      // Eerste regel van een tekst: x/y overnemen (de opbouw zet de positie op de tspan).
      if (tekstEl && !sluit && tekstEl.attrs.y === undefined) {
        const a = attrsVan(rest);
        if (a.y !== undefined) {
          tekstEl.attrs.x = a.x;
          tekstEl.attrs.y = a.y;
        }
      }
      continue;
    }
    if (sluit) {
      if (tag === "g") stapel.pop();
      if (tag === "text") tekstEl = null;
      continue;
    }
    const attrs = attrsVan(rest);
    if (tag === "g") {
      if (!zelf) stapel.push(Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith("data-"))));
      continue;
    }
    const groep = Object.assign({}, ...stapel);
    const el: SvgEl = { tag, attrs, groep };
    out.push(el);
    if (tag === "text" && !zelf) {
      el.tekst = "";
      tekstEl = el;
    }
  }
  for (const e of out) if (e.tekst !== undefined) e.tekst = e.tekst.replace(/\u200b/g, "");
  return out;
}

export function punten(attr: string): [number, number][] {
  return attr
    .trim()
    .split(/\s+/)
    .map((p) => p.split(",").map(Number) as [number, number]);
}
