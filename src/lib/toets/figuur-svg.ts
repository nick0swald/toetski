import type { SchemaFiguur, VraagGrafiek } from "./types";

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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
