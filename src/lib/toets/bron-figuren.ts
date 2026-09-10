import type { SchemaFiguur, Vraag, VraagGrafiek, VraagTabel, VakProfiel } from "./types";

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
  return /tabel|grafiek|diagram|figuur|meetreeks|meetwaarden|schema|schakeling|krachten|blokken(?:schema)?|stroomkring/i.test(
    text,
  );
}

/** Genoeg lesstof voor een hoofdstuktoets (figuur-heuristiek). */
export function isRuimeBron(bron: string): boolean {
  return bron.trim().length >= 800 || /\bhoofdstuk\b|\bparagraaf\b/i.test(bron.slice(0, 2500));
}

/** Herkent NaSk/exacte vakken voor figuur-heuristieken. */
export function detectVakProfiel(vak: string, bron = ""): VakProfiel {
  const t = `${vak} ${bron.slice(0, 2000)}`.toLowerCase();
  if (
    /\bnask\b|natuur-?\s*en\s*scheikunde|natuurkunde|scheikunde|n\/?sk\b|fysica|chemie/.test(t)
  ) {
    return "nask";
  }
  if (/\bbiologie\b|\bbio\b/.test(t)) return "biologie";
  return "generiek";
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

/** Stelt een eenvoudig schema voor op basis van trefwoorden in de lesstof. */
export function suggestSchemaFiguur(bron: string): SchemaFiguur | null {
  const t = bron.toLowerCase();
  if (/schakeling|stroomkring|weerstand|amp[eè]re|voltmeter|serieschakeling|parallelschakeling/.test(t)) {
    return {
      soort: "circuit",
      titel: "Eenvoudige stroomkring",
      labels: ["bron", "lamp", "schakelaar"],
    };
  }
  if (/kracht(?:en)?|zwaartekracht|normaalkracht|wrijving|veer(?:kracht)?|resulterend/.test(t)) {
    return {
      soort: "krachten",
      titel: "Krachten op een voorwerp",
      labels: ["Fz", "Fn", "Fw"],
    };
  }
  if (/blokken(?:schema)?|energiestroom|omzetting|fotosynthese|proces/.test(t)) {
    return {
      soort: "blokken",
      titel: "Blokkenschema",
      labels: ["in", "proces", "uit"],
    };
  }
  return null;
}

function heeftFiguur(q: Vraag): boolean {
  return Boolean(q.tabel || q.grafiek || q.schemaFiguur);
}

/**
 * Als NaSk-lesstof figuren noemt (of ruim genoeg is voor een hoofdstuktoets)
 * maar de AI die weglaat: plak tabel/grafiek uit de bron of een eenvoudig schema.
 * Doel: hoofdstuktoetsen vaker ≥1 schema/tabel/grafiek.
 */
export function verzekerBronFiguren(
  vragen: Vraag[],
  bron: string,
  vakProfiel?: VakProfiel,
): Vraag[] {
  if (vakProfiel !== "nask") return vragen;
  if (vragen.some(heeftFiguur)) return vragen;

  const wilFiguur = noemtFiguur(bron) || isRuimeBron(bron);
  if (!wilFiguur) return vragen;

  const fig = extractBronFiguren(bron);
  const schema = fig ? null : suggestSchemaFiguur(bron);
  if (!fig && !schema) return vragen;

  const idx = vragen.findIndex((q) =>
    noemtFiguur(`${q.stam} ${q.context ?? ""} ${q.leerdoel} ${q.domein}`),
  );
  const i = idx >= 0 ? idx : 0;
  const q = vragen[i];
  if (!q) return vragen;
  const next = vragen.slice();
  next[i] = {
    ...q,
    tabel: q.tabel ?? fig?.tabel,
    grafiek: q.grafiek ?? fig?.grafiek,
    schemaFiguur: q.schemaFiguur ?? schema ?? undefined,
  };
  return next;
}
