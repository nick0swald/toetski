import type { Vraag, VraagGrafiek, VraagTabel, VakProfiel } from "./types";

function parseNlNumber(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function splitRow(line: string): string[] {
  let cells = line.split("|").map((c) => c.trim());
  if (cells[0] === "") cells = cells.slice(1);
  if (cells.length && cells[cells.length - 1] === "") cells = cells.slice(0, -1);
  return cells;
}

function isSeparator(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, "")));
}

function noemtFiguur(text: string): boolean {
  return /tabel|grafiek|diagram|figuur|meetreeks|meetwaarden/i.test(text);
}

/** Haalt een pijptabel (en eventueel een 2-kolomsgrafiek) uit lesstof. */
export function extractBronFiguren(bron: string): {
  tabel?: VraagTabel;
  grafiek?: VraagGrafiek;
} | null {
  const lines = bron.split(/\r?\n/).map((l) => l.trim());
  let best: { koppen: string[]; rijen: string[][] } | null = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.includes("|")) {
      i += 1;
      continue;
    }
    const block: string[][] = [];
    while (i < lines.length && (lines[i] ?? "").includes("|")) {
      const raw = lines[i] ?? "";
      i += 1;
      if (!raw || isSeparator(raw)) continue;
      const cells = splitRow(raw);
      if (cells.length >= 2) block.push(cells);
    }
    if (block.length >= 3 && (!best || block.length > best.rijen.length + 1)) {
      const [koppen, ...rijen] = block;
      if (koppen) best = { koppen, rijen };
    }
  }
  if (!best) return null;

  const tabel: VraagTabel = best;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const rij of best.rijen) {
    const x = parseNlNumber(rij[0] ?? "");
    const y = parseNlNumber(rij[1] ?? "");
    if (x === null || y === null) continue;
    xs.push(x);
    ys.push(y);
  }
  const grafiek: VraagGrafiek | undefined =
    xs.length >= 2
      ? {
          titel: `${best.koppen[1] ?? "y"} tegen ${best.koppen[0] ?? "x"}`,
          xLabel: best.koppen[0] ?? "x",
          yLabel: best.koppen[1] ?? "y",
          punten: xs.map((x, n) => ({ x, y: ys[n] ?? 0 })),
        }
      : undefined;

  return grafiek ? { tabel, grafiek } : { tabel };
}

/** Als NaSk-lesstof een tabel/grafiek noemt maar de AI die weglaat, plak hem op een vraag. */
export function verzekerBronFiguren(
  vragen: Vraag[],
  bron: string,
  vakProfiel?: VakProfiel,
): Vraag[] {
  if (vakProfiel !== "nask") return vragen;
  if (!noemtFiguur(bron)) return vragen;
  if (vragen.some((q) => q.tabel || q.grafiek)) return vragen;
  const fig = extractBronFiguren(bron);
  if (!fig) return vragen;
  const idx = vragen.findIndex((q) =>
    noemtFiguur(`${q.stam} ${q.context ?? ""} ${q.leerdoel}`),
  );
  const i = idx >= 0 ? idx : 0;
  const q = vragen[i];
  if (!q) return vragen;
  const next = vragen.slice();
  next[i] = {
    ...q,
    tabel: q.tabel ?? fig.tabel,
    grafiek: q.grafiek ?? fig.grafiek,
  };
  return next;
}
