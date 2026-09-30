import { isVeiligheidsbord, pictogramPastBijVraag } from "./types.ts";
import type { GhsSymbool, MaatcilinderFiguur, NakijkItem, SchemaFiguur, Vraag, VraagGrafiek, VraagTabel, VakProfiel } from "./types";
import { heeftEchtFiguur } from "./blad-volgorde.ts";

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

function inferGhs(tekst: string): GhsSymbool | null {
  const t = tekst.toLowerCase();
  // Veiligheidsborden eerst: 'gehoorbescherming dragen' is een gebodsbord, geen GHS-symbool.
  if (/gehoorbescherming|oorkappen|oordoppen|oorbeschermer/.test(t)) return "gebod-gehoorbescherming";
  if (/veiligheidsbril|oogbescherming|spatbril/.test(t)) return "gebod-oogbescherming";
  if (/stofmasker|mondkapje|adembescherming/.test(t)) return "gebod-stofmasker";
  if (/veiligheidshelm|bouwhelm|\bhelm\b/.test(t)) return "gebod-helm";
  if (/werkhandschoen|handschoenen/.test(t)) return "gebod-handschoenen";
  if (/veiligheidsschoen|werkschoen/.test(t)) return "gebod-veiligheidsschoenen";
  if (/roken verboden|niet roken/.test(t)) return "verbod-roken";
  if (/open vuur verboden|geen open vuur/.test(t)) return "verbod-open-vuur";
  if (/elektrische spanning|hoogspanning|gevaarlijke spanning/.test(t) && /bord|waarschuwing/.test(t)) return "waarschuwing-elektriciteit";
  if (/heet oppervlak|hete oppervlak/.test(t)) return "waarschuwing-heet";
  if (/ontvlambaar|brandbaar|\bvlam/.test(t)) return "ontvlambaar";
  if (/giftig|doodshoofd|schedel|toxisch/.test(t)) return "giftig";
  if (/bijtend|corros/.test(t)) return "bijtend";
  if (/milieu|milieugevaar/.test(t)) return "milieu";
  if (/explos/.test(t)) return "explosief";
  if (/oxider/.test(t)) return "oxiderend";
  if (/gas onder druk|gasfles/.test(t)) return "gas-onder-druk";
  if (/gezondheidsgevaar|kankerverwekk/.test(t)) return "gezondheidsgevaar";
  if (/schadelijk|irriterend|uitroepteken/.test(t)) return "schadelijk";
  return null;
}

export function isPictogramVraag(q: Vraag): boolean {
  return /pictogram|gevarensymbool|gevaarsymbool|gevarenteken|veiligheidsbord|gebodsbord|waarschuwingsbord|verbodsbord/i.test(
    `${q.stam} ${q.context ?? ""} ${q.leerdoel}`,
  );
}

function schrapSymboolbeschrijving(s: string): string {
  return s
    .replace(/een rood(?:e)? pictogram met vlammen/gi, "dit gevarensymbool")
    .replace(/rood(?:e)? pictogram met vlammen/gi, "dit gevarensymbool")
    .replace(/doodshoofd-?pictogram/gi, "dit gevarensymbool")
    .replace(/pictogram met (?:een )?(?:vlammen|doodshoofd|vlam|schedel)/gi, "dit gevarensymbool")
    .replace(/\b(?:vlammen|doodshoofd|schedel en gekruiste beenderen)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

/** Elke pictogramvraag krijgt het GHS-symbool; de stam beschrijft het niet. */
export function plaatsPictogrammen(vragen: Vraag[], nakijk: NakijkItem[] = []): Vraag[] {
  return vragen.map((q) => {
    if (q.figuur || q.figuurId) return q; // bevroren figuur: niets toevoegen
    if (!isPictogramVraag(q) && !q.pictogram) return q;
    const n = nakijk.find((item) => item.nummer === q.nummer);
    // Pictogramveld dat na een herschrijving niet meer bij de tekst hoort (bijv. een drukberekening): weg ermee.
    const tekst = `${q.context ?? ""} ${q.stam} ${(q.opties ?? []).map((o) => o.tekst).join(" ")} ${n?.modelantwoord ?? ""}`;
    if (q.pictogram && !pictogramPastBijVraag(q) && !inferGhs(tekst)) {
      const { pictogram: _weg, ...kaal } = q;
      return kaal as Vraag;
    }
    const uitTekst =
      inferGhs(n?.modelantwoord ?? "") ??
      inferGhs(`${q.context ?? ""} ${q.stam} ${(q.opties ?? []).map((o) => o.tekst).join(" ")}`);
    // Het model koos een GHS-symbool terwijl de tekst over een veiligheidsbord gaat (bijv. gehoorbescherming): tekst wint.
    const soort = q.pictogram && !(uitTekst && isVeiligheidsbord(uitTekst) && !isVeiligheidsbord(q.pictogram)) ? q.pictogram : (uitTekst ?? q.pictogram);
    if (!soort) return q;
    const bord = isVeiligheidsbord(soort);
    // Een gebods-/waarschuwingsbord heet geen gevarensymbool (en omgekeerd): tekst en rubriek consistent.
    const woord = (t: string) => (bord ? t.replace(/\bgevarensymbool\b/gi, "veiligheidsbord").replace(/\bGHS-?(?:gevaren)?symbool\b/gi, "veiligheidsbord") : t.replace(/\b(?:gebods|waarschuwings|veiligheids)bord\b/gi, "gevarensymbool"));
    if (n) {
      n.puntenverdeling = (n.puntenverdeling ?? []).map((p) => ({
        ...p,
        criterium: bord ? p.criterium.replace(/\b(?:GHS-?)?(?:gezondheidsgevaar|gevaren?)[- ]?(?:pictogram|symbool)\b/gi, "veiligheidsbord") : p.criterium,
      }));
    }
    return {
      ...q,
      pictogram: soort,
      context: q.context ? woord(schrapSymboolbeschrijving(q.context)) : q.context,
      stam: woord(schrapSymboolbeschrijving(q.stam)),
    };
  });
}

function parseMl(tekst: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*m(?:l|L)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tekst))) {
    const n = Number(m[1]!.replace(",", "."));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function isOnderdompel(q: Vraag): boolean {
  return /onderdompel|maatcilinder/i.test(`${q.stam} ${q.context ?? ""} ${q.leerdoel}`);
}

/** Onderdompelvragen: maatcilinder aflezen. De standen staan in de figuur. */
export function plaatsMaatcilinders(vragen: Vraag[]): Vraag[] {
  return vragen.map((q) => {
    if (q.figuur || q.figuurId) return q; // bevroren figuur: niets toevoegen
    if (q.maatcilinder || !isOnderdompel(q)) return q;
    const nrs = parseMl(`${q.context ?? ""} ${q.stam}`);
    const begin = nrs[0] ?? 30;
    const eind = nrs[1] ?? begin + 18;
    const fig: MaatcilinderFiguur = {
      titel: "Maatcilinder",
      maxMl: Math.max(100, Math.ceil((eind + 10) / 10) * 10),
      standen: [
        { label: "begin", ml: begin },
        { label: "na onderdompelen", ml: eind },
      ],
    };
    let stam = q.stam;
    if (nrs.length >= 2) {
      stam = stam
        .replace(/de beginstand[^.]{0,80}\./gi, "")
        .replace(/na het onderdompelen[^.]{0,80}\./gi, "")
        .replace(/\d+(?:[.,]\d+)?\s*m(?:l|L)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (!/af van de maatcilinder|figuur/i.test(stam)) {
        stam = `Lees de beginstand en de stand na het onderdompelen af van de maatcilinder. ${stam}`.trim();
      }
    }
    return { ...q, stam, maatcilinder: fig };
  });
}

/**
 * Als NaSk-lesstof figuren noemt (of ruim genoeg is voor een hoofdstuktoets)
 * maar de AI die weglaat: plak grafiek/schema uit de bron.
 * Een tabel alleen telt niet als figuur.
 */
export function verzekerBronFiguren(
  vragen: Vraag[],
  bron: string,
  vakProfiel?: VakProfiel,
  nakijk: NakijkItem[] = [],
): Vraag[] {
  let next = plaatsPictogrammen(vragen, nakijk);
  next = plaatsMaatcilinders(next);
  if (vakProfiel !== "nask") return next;
  if (next.some((q) => heeftEchtFiguur(q) || q.figuurId)) return next;

  const wilFiguur = noemtFiguur(bron) || isRuimeBron(bron);
  if (!wilFiguur) return verzekerMinimaalFiguur(next);

  const fig = extractBronFiguren(bron);
  const schema = fig?.grafiek ? null : suggestSchemaFiguur(bron);
  if (fig?.grafiek || schema) {
    const idx = next.findIndex((q) =>
      noemtFiguur(`${q.stam} ${q.context ?? ""} ${q.leerdoel} ${q.domein}`),
    );
    const i = idx >= 0 ? idx : 0;
    const q = next[i];
    if (!q) return next;
    const copy = next.slice();
    copy[i] = {
      ...q,
      tabel: q.tabel ?? fig?.tabel,
      grafiek: q.grafiek ?? fig?.grafiek,
      schemaFiguur: q.schemaFiguur ?? schema ?? undefined,
    };
    return copy;
  }
  return verzekerMinimaalFiguur(next);
}

/** Laatste redmiddel: één maatcilinder of het blijft zonder echte figuur niet "voldoet". */
function verzekerMinimaalFiguur(vragen: Vraag[]): Vraag[] {
  if (vragen.some((q) => heeftEchtFiguur(q) || q.figuurId)) return vragen;
  const idx = vragen.findIndex((q) => /volume|water|cilinder|dichtheid/i.test(`${q.stam} ${q.leerdoel}`));
  const i = idx >= 0 ? idx : vragen.findIndex((q) => q.type === "berekening" || q.type === "open");
  if (i < 0) return vragen;
  const q = vragen[i];
  if (!q) return vragen;
  const copy = vragen.slice();
  copy[i] = {
    ...q,
    maatcilinder: {
      titel: "Maatcilinder",
      maxMl: 100,
      standen: [
        { label: "begin", ml: 28 },
        { label: "na onderdompelen", ml: 53 },
      ],
    },
  };
  return copy;
}
