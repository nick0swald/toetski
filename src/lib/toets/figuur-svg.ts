import type { GhsSymbool, MaatcilinderFiguur, SchemaFiguur, VraagGrafiek } from "./types";

const INK = "#000000";
const GRID = "#bbbbbb";

/** Eenvoudige lijn-grafiek als SVG-string (printbaar B&W). */
export function grafiekSvg(grafiek: VraagGrafiek, W = 420, H = 240): string {
  const pts = grafiek.punten;
  if (pts.length < 2) return "";
  const pad = { l: 48, r: 16, t: 28, b: 40 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const xOf = (x: number) => pad.l + ((x - minX) / spanX) * (W - pad.l - pad.r);
  const yOf = (y: number) => pad.t + (1 - (y - minY) / spanY) * (H - pad.t - pad.b);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.x).toFixed(1)} ${yOf(p.y).toFixed(1)}`)
    .join(" ");
  const dots = pts
    .map(
      (p) =>
        `<circle cx="${xOf(p.x).toFixed(1)}" cy="${yOf(p.y).toFixed(1)}" r="3.2" fill="${INK}" />`,
    )
    .join("");
  const titel = grafiek.titel
    ? `<text x="${W / 2}" y="16" text-anchor="middle" font-family="Arial" font-size="12" font-weight="700" fill="${INK}">${escapeXml(grafiek.titel)}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${titel}
  <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}" stroke="${INK}" stroke-width="1.4"/>
  <line x1="${pad.l}" y1="${H - pad.b}" x2="${W - pad.r}" y2="${H - pad.b}" stroke="${INK}" stroke-width="1.4"/>
  <path d="${d}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}
  <text x="${W / 2}" y="${H - 10}" text-anchor="middle" font-family="Arial" font-size="11" fill="${INK}">${escapeXml(grafiek.xLabel)}</text>
  <text x="14" y="${H / 2}" text-anchor="middle" font-family="Arial" font-size="11" fill="${INK}" transform="rotate(-90 14 ${H / 2})">${escapeXml(grafiek.yLabel)}</text>
</svg>`;
}

/** Schema-lijnfiguur (circuit / krachten / blokken). */
export function schemaFiguurSvg(fig: SchemaFiguur, W = 420, H = 220): string {
  const labels = (fig.labels ?? []).slice(0, 4);
  const titel = fig.titel
    ? `<text x="${W / 2}" y="18" text-anchor="middle" font-family="Arial" font-size="12" font-weight="700" fill="${INK}">${escapeXml(fig.titel)}</text>`
    : "";
  let body = "";
  if (fig.soort === "circuit") {
    const l0 = escapeXml(labels[0] ?? "U");
    const l1 = escapeXml(labels[1] ?? "R");
    const l2 = escapeXml(labels[2] ?? "A");
    body = `
      <rect x="60" y="70" width="28" height="70" fill="none" stroke="${INK}" stroke-width="2"/>
      <line x1="74" y1="70" x2="74" y2="55" stroke="${INK}" stroke-width="2"/>
      <line x1="74" y1="140" x2="74" y2="155" stroke="${INK}" stroke-width="2"/>
      <line x1="74" y1="55" x2="300" y2="55" stroke="${INK}" stroke-width="2"/>
      <line x1="74" y1="155" x2="300" y2="155" stroke="${INK}" stroke-width="2"/>
      <line x1="300" y1="55" x2="300" y2="155" stroke="${INK}" stroke-width="2"/>
      <path d="M 180 55 l 8 12 l 8 -24 l 8 24 l 8 -24 l 8 12" fill="none" stroke="${INK}" stroke-width="2"/>
      <circle cx="300" cy="105" r="14" fill="none" stroke="${INK}" stroke-width="2"/>
      <text x="74" y="185" text-anchor="middle" font-family="Arial" font-size="11" fill="${INK}">${l0}</text>
      <text x="212" y="42" text-anchor="middle" font-family="Arial" font-size="11" fill="${INK}">${l1}</text>
      <text x="300" y="110" text-anchor="middle" font-family="Arial" font-size="11" fill="${INK}">${l2}</text>
    `;
  } else if (fig.soort === "krachten") {
    const l0 = escapeXml(labels[0] ?? "F₁");
    const l1 = escapeXml(labels[1] ?? "F₂");
    const l2 = escapeXml(labels[2] ?? "Fz");
    body = `
      <rect x="170" y="90" width="80" height="50" fill="none" stroke="${INK}" stroke-width="2"/>
      <line x1="210" y1="90" x2="210" y2="40" stroke="${INK}" stroke-width="2" marker-end="url(#arrow)"/>
      <line x1="250" y1="115" x2="320" y2="115" stroke="${INK}" stroke-width="2" marker-end="url(#arrow)"/>
      <line x1="210" y1="140" x2="210" y2="190" stroke="${INK}" stroke-width="2" marker-end="url(#arrow)"/>
      <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${INK}"/></marker></defs>
      <text x="222" y="36" font-family="Arial" font-size="11" fill="${INK}">${l0}</text>
      <text x="326" y="119" font-family="Arial" font-size="11" fill="${INK}">${l1}</text>
      <text x="222" y="200" font-family="Arial" font-size="11" fill="${INK}">${l2}</text>
      <line x1="120" y1="140" x2="340" y2="140" stroke="${GRID}" stroke-width="1" stroke-dasharray="4 3"/>
    `;
  } else {
    // blokken
    const l0 = escapeXml(labels[0] ?? "A");
    const l1 = escapeXml(labels[1] ?? "B");
    const l2 = escapeXml(labels[2] ?? "C");
    body = `
      <rect x="150" y="130" width="120" height="40" fill="none" stroke="${INK}" stroke-width="2"/>
      <rect x="170" y="90" width="80" height="40" fill="none" stroke="${INK}" stroke-width="2"/>
      <rect x="190" y="50" width="40" height="40" fill="none" stroke="${INK}" stroke-width="2"/>
      <line x1="100" y1="170" x2="320" y2="170" stroke="${INK}" stroke-width="2"/>
      <text x="210" y="156" text-anchor="middle" font-family="Arial" font-size="12" fill="${INK}">${l0}</text>
      <text x="210" y="116" text-anchor="middle" font-family="Arial" font-size="12" fill="${INK}">${l1}</text>
      <text x="210" y="76" text-anchor="middle" font-family="Arial" font-size="12" fill="${INK}">${l2}</text>
    `;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${titel}
  ${body}
</svg>`;
}

/** GHS-ruit, zwart-wit lijntekening (printbaar, geen boekillustratie). */
export function ghsPictogramSvg(soort: GhsSymbool, W = 220, H = 220): string {
  const cx = W / 2;
  const cy = H / 2 + 4;
  const ruit = `<polygon points="${cx},${18} ${W - 18},${cy} ${cx},${H - 18} ${18},${cy}" fill="#ffffff" stroke="${INK}" stroke-width="3"/>`;
  const sym = ghsSymboolPad(soort, cx, cy);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${ruit}
  ${sym}
</svg>`;
}

function ghsSymboolPad(soort: GhsSymbool, cx: number, cy: number): string {
  if (soort === "ontvlambaar") {
    return `<path d="M${cx} ${cy - 48} C ${cx + 8} ${cy - 20}, ${cx + 28} ${cy - 18}, ${cx + 22} ${cy + 8} C ${cx + 40} ${cy - 8}, ${cx + 36} ${cy - 36}, ${cx + 14} ${cy - 28} C ${cx + 18} ${cy - 46}, ${cx + 4} ${cy - 40}, ${cx} ${cy - 48} Z M${cx - 6} ${cy + 6} C ${cx - 22} ${cy - 8}, ${cx - 8} ${cy - 30}, ${cx + 2} ${cy - 16} C ${cx + 8} ${cy - 28}, ${cx + 22} ${cy - 10}, ${cx + 10} ${cy + 18} C ${cx + 28} ${cy + 8}, ${cx + 18} ${cy + 36}, ${cx} ${cy + 42} C ${cx - 20} ${cy + 36}, ${cx - 28} ${cy + 12}, ${cx - 6} ${cy + 6} Z" fill="${INK}"/>`;
  }
  if (soort === "giftig") {
    return `
      <circle cx="${cx}" cy="${cy - 10}" r="28" fill="none" stroke="${INK}" stroke-width="3"/>
      <circle cx="${cx - 10}" cy="${cy - 16}" r="4" fill="${INK}"/>
      <circle cx="${cx + 10}" cy="${cy - 16}" r="4" fill="${INK}"/>
      <path d="M${cx - 10} ${cy - 2} Q ${cx} ${cy + 8} ${cx + 10} ${cy - 2}" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <path d="M${cx - 36} ${cy + 18} L${cx + 36} ${cy + 46} M${cx + 36} ${cy + 18} L${cx - 36} ${cy + 46}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    `;
  }
  if (soort === "bijtend") {
    return `
      <path d="M${cx - 28} ${cy - 20} L${cx - 8} ${cy - 36} L${cx + 6} ${cy - 10} L${cx + 22} ${cy - 28} L${cx + 30} ${cy - 8} L${cx + 8} ${cy + 36} L${cx - 18} ${cy + 20} Z" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <path d="M${cx - 22} ${cy + 28} q 10 16 28 8" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <path d="M${cx + 4} ${cy + 8} l 6 18 l 10 -8" fill="none" stroke="${INK}" stroke-width="2.5"/>
    `;
  }
  if (soort === "milieu") {
    return `
      <path d="M${cx - 34} ${cy + 10} q 20 28 68 0" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <path d="M${cx - 20} ${cy + 8} q 6 -16 18 -8 q 4 10 16 0" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <path d="M${cx + 8} ${cy - 36} v 28 M${cx + 8} ${cy - 28} q 16 -8 16 8" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="${cx - 8}" cy="${cy - 8}" r="7" fill="none" stroke="${INK}" stroke-width="2.5"/>
    `;
  }
  if (soort === "explosief") {
    return `<polygon points="${cx},${cy - 46} ${cx + 12},${cy - 12} ${cx + 44},${cy - 8} ${cx + 16},${cy + 10} ${cx + 28},${cy + 44} ${cx},${cy + 20} ${cx - 28},${cy + 44} ${cx - 16},${cy + 10} ${cx - 44},${cy - 8} ${cx - 12},${cy - 12}" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
  }
  if (soort === "oxiderend") {
    return `<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="${INK}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="10" fill="${INK}"/>`;
  }
  if (soort === "gas-onder-druk") {
    return `<rect x="${cx - 16}" y="${cy - 40}" width="32" height="70" rx="10" fill="none" stroke="${INK}" stroke-width="3"/><rect x="${cx - 8}" y="${cy - 52}" width="16" height="14" fill="none" stroke="${INK}" stroke-width="3"/>`;
  }
  if (soort === "gezondheidsgevaar") {
    return `<path d="M${cx} ${cy - 40} l 8 16 h 16 l -12 12 6 18 -18 -10 -18 10 6 -18 -12 -12 h 16 z" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
  }
  return `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-family="Arial" font-size="64" font-weight="700" fill="${INK}">!</text>`;
}

/** Maatcilinder met af te lezen vloeistofstanden. */
export function maatcilinderSvg(fig: MaatcilinderFiguur, W = 280, H = 320): string {
  const max = Math.max(10, fig.maxMl || 100);
  const top = 36;
  const bottom = H - 28;
  const left = 78;
  const right = 150;
  const yOf = (ml: number) => bottom - (Math.max(0, Math.min(max, ml)) / max) * (bottom - top);
  const ticks: string[] = [];
  const step = max <= 50 ? 10 : max <= 100 ? 20 : 50;
  for (let ml = 0; ml <= max; ml += step) {
    const y = yOf(ml);
    ticks.push(
      `<line x1="${left}" y1="${y.toFixed(1)}" x2="${left + 14}" y2="${y.toFixed(1)}" stroke="${INK}" stroke-width="1.2"/>`,
      `<text x="${left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-family="Arial" font-size="11" fill="${INK}">${ml}</text>`,
    );
  }
  const liquids = (fig.standen ?? []).map((s) => {
    const y = yOf(s.ml);
    return `<line x1="${left + 2}" y1="${y.toFixed(1)}" x2="${right - 2}" y2="${y.toFixed(1)}" stroke="${INK}" stroke-width="2" stroke-dasharray="5 3"/>
      <text x="${right + 8}" y="${(y + 4).toFixed(1)}" font-family="Arial" font-size="11" fill="${INK}">${escapeXml(s.label)}</text>`;
  });
  const titel = fig.titel
    ? `<text x="${W / 2}" y="18" text-anchor="middle" font-family="Arial" font-size="12" font-weight="700" fill="${INK}">${escapeXml(fig.titel)}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${titel}
  <path d="M${left} ${top} V${bottom} Q${(left + right) / 2} ${bottom + 16} ${right} ${bottom} V${top}" fill="none" stroke="${INK}" stroke-width="2"/>
  <line x1="${left}" y1="${top}" x2="${right}" y2="${top}" stroke="${INK}" stroke-width="2"/>
  ${ticks.join("")}
  ${liquids.join("")}
  <text x="${(left + right) / 2}" y="${H - 6}" text-anchor="middle" font-family="Arial" font-size="11" fill="${INK}">mL</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
