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

/** GHS-ruit (zwart symbool op wit), of een veiligheidsbord (gebod/waarschuwing/verbod). Zelf getekend. */
export function ghsPictogramSvg(soort: GhsSymbool, W = 220, H = 220): string {
  if (/^(gebod|waarschuwing|verbod)-/.test(soort)) return veiligheidsbordSvg(soort, W, H);
  const cx = W / 2;
  const cy = H / 2;
  const m = 14;
  const ruit = `<polygon points="${cx},${m} ${W - m},${cy} ${cx},${H - m} ${m},${cy}" fill="#ffffff" stroke="${INK}" stroke-width="3"/>`;
  const k = Math.min(W, H) / 240;
  const sym = `<g transform="translate(${cx - 120 * k} ${cy - 120 * k}) scale(${k})">${ghsSymboolPad(soort)}</g>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${ruit}
  ${sym}
</svg>`;
}

/** Symbolen op een 240×240-raster rond (120,120), passend binnen de ruit. */
function ghsSymboolPad(soort: GhsSymbool): string {
  const K = INK;
  switch (soort) {
    case "ontvlambaar":
      return `<path d="M120 58 C 136 84, 158 96, 150 136 C 146 156, 132 166, 120 166 C 104 166, 90 156, 88 138 C 86 118, 100 108, 104 92 C 110 104, 110 112, 118 118 C 124 100, 118 80, 120 58 Z" fill="${K}"/><rect x="78" y="172" width="84" height="9" fill="${K}"/>`;
    case "oxiderend":
      return `<path d="M120 52 C 134 72, 150 84, 144 110 C 140 124, 130 130, 120 130 C 108 130, 98 122, 96 110 C 94 94, 106 86, 108 74 C 114 84, 114 92, 118 96 C 122 82, 118 68, 120 52 Z" fill="${K}"/><circle cx="120" cy="150" r="18" fill="none" stroke="${K}" stroke-width="9"/><rect x="82" y="178" width="76" height="8" fill="${K}"/>`;
    case "giftig":
      return `<ellipse cx="120" cy="92" rx="30" ry="28" fill="${K}"/><rect x="104" y="108" width="32" height="20" rx="4" fill="${K}"/>
        <circle cx="109" cy="90" r="8" fill="#fff"/><circle cx="131" cy="90" r="8" fill="#fff"/><path d="M117 104 L120 97 L123 104 Z" fill="#fff"/>
        <path d="M112 120 v7 M120 120 v7 M128 120 v7" stroke="#fff" stroke-width="2.5"/>
        <path d="M78 138 L162 176 M162 138 L78 176" stroke="${K}" stroke-width="11" stroke-linecap="round"/>
        <circle cx="76" cy="134" r="7" fill="${K}"/><circle cx="72" cy="143" r="7" fill="${K}"/><circle cx="164" cy="134" r="7" fill="${K}"/><circle cx="168" cy="143" r="7" fill="${K}"/>
        <circle cx="76" cy="180" r="7" fill="${K}"/><circle cx="72" cy="171" r="7" fill="${K}"/><circle cx="164" cy="180" r="7" fill="${K}"/><circle cx="168" cy="171" r="7" fill="${K}"/>`;
    case "bijtend":
      return `<g fill="none" stroke="${K}" stroke-width="5" stroke-linejoin="round">
          <rect x="72" y="52" width="16" height="46" rx="7" transform="rotate(-50 80 75)"/>
          <rect x="142" y="52" width="16" height="46" rx="7" transform="rotate(-50 150 75)"/>
        </g>
        <path d="M96 94 q 4 8 0 12 q -4 -4 0 -12 Z M98 112 q 4 8 0 12 q -4 -4 0 -12 Z" fill="${K}"/>
        <path d="M166 94 q 4 8 0 12 q -4 -4 0 -12 Z M168 112 q 4 8 0 12 q -4 -4 0 -12 Z" fill="${K}"/>
        <path d="M66 152 h 44 v 20 h -44 Z" fill="${K}"/><path d="M90 152 q 6 10 12 0 Z" fill="#fff"/>
        <path d="M140 172 L140 150 Q140 142 146 142 L150 142 L150 134 Q150 128 156 128 Q162 128 162 134 L162 142 L170 142 Q176 142 176 150 L176 172 Z" fill="${K}"/><path d="M160 142 q 6 12 14 4 Z" fill="#fff"/>`;
    case "milieu":
      return `<rect x="62" y="170" width="116" height="6" fill="${K}"/>
        <path d="M86 170 V 110 M86 132 L70 116 M86 124 L102 106 M86 146 L100 136 M70 116 L66 104 M102 106 L108 96" stroke="${K}" stroke-width="6" stroke-linecap="round" fill="none"/>
        <path d="M118 150 Q 140 132 162 150 Q 140 166 118 150 Z" fill="${K}"/><path d="M162 150 L176 140 L176 160 Z" fill="${K}"/>
        <path d="M126 144 l6 6 m0 -6 l-6 6" stroke="#fff" stroke-width="2.5"/>`;
    case "explosief":
      return `<circle cx="120" cy="140" r="20" fill="${K}"/>
        ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<polygon points="-6,-34 6,-34 0,-58" fill="${K}" transform="translate(120 140) rotate(${a})"/>`).join("")}
        ${[22, 112, 202, 292].map((a) => `<rect x="-4" y="-50" width="8" height="10" fill="${K}" transform="translate(120 140) rotate(${a})"/>`).join("")}`;
    case "gas-onder-druk":
      return `<g transform="rotate(-30 120 130)"><rect x="70" y="112" width="96" height="40" rx="18" fill="${K}"/><rect x="164" y="124" width="14" height="16" fill="${K}"/><rect x="176" y="120" width="6" height="24" fill="${K}"/></g>`;
    case "gezondheidsgevaar": {
      const ster = Array.from({ length: 16 }, (_, i) => {
        const r = i % 2 === 0 ? 24 : 10;
        const a = (Math.PI / 8) * i - Math.PI / 2;
        return `${(120 + r * Math.cos(a)).toFixed(1)},${(142 + r * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      return `<circle cx="120" cy="74" r="19" fill="${K}"/>
        <path d="M78 178 L80 124 Q 82 102 104 98 L136 98 Q 158 102 160 124 L162 178 Z" fill="${K}"/>
        <polygon points="${ster}" fill="#fff"/>`;
    }
    case "schadelijk":
    default:
      return `<path d="M111 62 L129 62 L125 146 L115 146 Z" fill="${K}"/><circle cx="120" cy="168" r="10" fill="${K}"/>`;
  }
}

const BLAUW = "#005ca9";
const GEEL = "#f9c300";
const ROOD = "#d2232a";

/** Veiligheidsborden volgens NEN-EN-ISO 7010 (vereenvoudigd): gebod blauw, waarschuwing geel, verbod rood. */
export function veiligheidsbordSvg(soort: GhsSymbool, W = 220, H = 220): string {
  const k = Math.min(W, H) / 240;
  let body = "";
  if (soort.startsWith("gebod-")) {
    const W_ = "#ffffff";
    const hoofd = `<circle cx="120" cy="98" r="28" fill="${W_}"/><path d="M68 196 Q 70 150 104 140 L136 140 Q 170 150 172 196 Z" fill="${W_}"/>`;
    let sym = "";
    if (soort === "gebod-gehoorbescherming")
      sym = `${hoofd}<path d="M84 98 C 84 44, 156 44, 156 98" fill="none" stroke="${BLAUW}" stroke-width="16"/><path d="M84 98 C 84 44, 156 44, 156 98" fill="none" stroke="${W_}" stroke-width="8"/>
        <rect x="72" y="80" width="22" height="40" rx="10" fill="${W_}" stroke="${BLAUW}" stroke-width="4"/><rect x="146" y="80" width="22" height="40" rx="10" fill="${W_}" stroke="${BLAUW}" stroke-width="4"/>`;
    else if (soort === "gebod-oogbescherming")
      sym = `${hoofd}<rect x="90" y="84" width="60" height="22" rx="10" fill="${BLAUW}"/><rect x="95" y="88" width="22" height="14" rx="6" fill="${W_}"/><rect x="123" y="88" width="22" height="14" rx="6" fill="${W_}"/>`;
    else if (soort === "gebod-stofmasker")
      sym = `${hoofd}<path d="M100 104 Q 120 96 140 104 L138 122 Q 120 134 102 122 Z" fill="${W_}" stroke="${BLAUW}" stroke-width="4"/><path d="M100 108 L92 100 M140 108 L148 100" stroke="${BLAUW}" stroke-width="3"/>`;
    else if (soort === "gebod-helm")
      sym = `${hoofd}<path d="M88 92 C 88 56, 152 56, 152 92 Z" fill="${W_}" stroke="${BLAUW}" stroke-width="4"/><rect x="78" y="90" width="84" height="10" rx="4" fill="${W_}" stroke="${BLAUW}" stroke-width="4"/>`;
    else if (soort === "gebod-handschoenen")
      sym = `<g fill="#ffffff"><rect x="90" y="58" width="13" height="62" rx="6"/><rect x="106" y="50" width="13" height="70" rx="6"/><rect x="122" y="52" width="13" height="68" rx="6"/><rect x="138" y="62" width="13" height="58" rx="6"/>
        <rect x="88" y="104" width="64" height="62" rx="12"/><rect x="60" y="112" width="44" height="14" rx="7" transform="rotate(35 82 119)"/><rect x="92" y="164" width="56" height="26" rx="3"/></g>
        <path d="M92 168 h 56" stroke="${BLAUW}" stroke-width="4"/>`;
    else
      sym = `<path d="M84 64 L122 64 L124 136 L166 148 Q 180 154 178 172 L178 182 L80 182 Z" fill="#ffffff"/><path d="M150 150 Q 176 156 176 176" fill="none" stroke="${BLAUW}" stroke-width="4"/><path d="M80 170 H 178" stroke="${BLAUW}" stroke-width="4"/>`;
    body = `<circle cx="120" cy="120" r="108" fill="${BLAUW}"/><circle cx="120" cy="120" r="108" fill="none" stroke="#ffffff" stroke-width="4"/><clipPath id="c"><circle cx="120" cy="120" r="104"/></clipPath><g clip-path="url(#c)">${sym}</g>`;
  } else if (soort.startsWith("waarschuwing-")) {
    let sym = "";
    if (soort === "waarschuwing-elektriciteit") sym = `<polygon points="132,78 98,146 122,146 106,196 150,124 126,124 142,78" fill="${INK}"/>`;
    else if (soort === "waarschuwing-heet")
      sym = `<rect x="74" y="178" width="92" height="9" fill="${INK}"/>${[92, 120, 148].map((x) => `<path d="M${x} 168 q -10 -12 0 -24 q 10 -12 0 -24 q -10 -12 0 -22" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`).join("")}`;
    else sym = `<path d="M111 90 L129 90 L125 160 L115 160 Z" fill="${INK}"/><circle cx="120" cy="180" r="10" fill="${INK}"/>`;
    body = `<polygon points="120,20 226,210 14,210" fill="${GEEL}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>${sym}`;
  } else {
    let sym = "";
    if (soort === "verbod-roken")
      sym = `<rect x="62" y="130" width="96" height="18" fill="#ffffff" stroke="${INK}" stroke-width="4"/><rect x="158" y="130" width="22" height="18" fill="${INK}"/><path d="M76 122 q -8 -14 4 -26 q 10 -12 2 -28" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    else
      sym = `<path d="M92 184 L136 104" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M138 60 C 152 80, 160 92, 150 108 C 144 116, 132 116, 128 108 C 122 96, 134 84, 138 60 Z" fill="${INK}"/>`;
    body = `<circle cx="120" cy="120" r="104" fill="#ffffff"/>${sym}<circle cx="120" cy="120" r="96" fill="none" stroke="${ROOD}" stroke-width="18"/><path d="M52 52 L188 188" stroke="${ROOD}" stroke-width="18"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <g transform="translate(${W / 2 - 120 * k} ${H / 2 - 120 * k}) scale(${k})">${body}</g>
</svg>`;
}

/** Maatcilinder met af te lezen vloeistofstanden. */
export function maatcilinderSvg(fig: MaatcilinderFiguur, W = 280, H = 320, opts: { eenheid?: string } = {}): string {
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
  // Vloeistof zichtbaar tot de laagste stand (beginstand), anders lijkt de cilinder leeg.
  const laagste = (fig.standen ?? []).reduce((m, st) => Math.min(m, st.ml), Infinity);
  const vulling = Number.isFinite(laagste) && laagste > 0
    ? `<path d="M${left + 1} ${yOf(laagste).toFixed(1)} V${bottom} Q${(left + right) / 2} ${bottom + 15} ${right - 1} ${bottom} V${yOf(laagste).toFixed(1)} Z" fill="#d6e8fa" stroke="none"/>`
    : "";
  const titel = fig.titel
    ? `<text x="${W / 2}" y="18" text-anchor="middle" font-family="Arial" font-size="12" font-weight="700" fill="${INK}">${escapeXml(fig.titel)}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${titel}
  <path d="M${left} ${top} V${bottom} Q${(left + right) / 2} ${bottom + 16} ${right} ${bottom} V${top}" fill="none" stroke="${INK}" stroke-width="2"/>
  <line x1="${left}" y1="${top}" x2="${right}" y2="${top}" stroke="${INK}" stroke-width="2"/>
  ${vulling}
  ${ticks.join("")}
  ${liquids.join("")}
  <text x="${(left + right) / 2}" y="${H - 6}" text-anchor="middle" font-family="Arial" font-size="11" fill="${INK}">${escapeXml(opts.eenheid ?? "mL")}</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
