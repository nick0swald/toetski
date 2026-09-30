import type { NakijkItem, PuntenCriterium, Vraag } from "./types";

function isMc(q: Vraag): boolean {
  return q.type === "meerkeuze" || q.type === "juist-onjuist" || (q.opties?.length ?? 0) >= 2;
}

function isBerekening(q: Vraag): boolean {
  return q.type === "berekening" || /\bbereken\b/i.test(q.stam);
}

function heel(n: number): number {
  return Math.max(0, Math.round(Number(n) || 0));
}

function fractioneel(n: number): boolean {
  return Math.abs(n - Math.round(n)) > 0.001;
}

/**
 * Standaardrubriek in de stijl van de docent (1 punt per stap, zoals het CSE-correctievoorschrift):
 * 2p formule + rest; 3p omrekenen/aflezen + formule + rest; 4p met een extra tussenstap.
 * Geen punt voor "gegevens en gevraagde".
 */
export function rekenRubriek(punten = 3): PuntenCriterium[] {
  const formule = { punt: 1, criterium: "gebruik van de juiste formule (grootheden benoemd)" };
  const rest = { punt: 1, criterium: "rest van de berekening juist (uitkomst met eenheid)" };
  if (punten <= 2) return [formule, rest];
  const omrekenen = { punt: 1, criterium: "juist omrekenen of aflezen van de benodigde waarde" };
  if (punten === 3) return [omrekenen, formule, rest];
  return [omrekenen, formule, { punt: 1, criterium: "juiste tussenstap (tweede formule of tussenuitkomst)" }, rest];
}

/** Criterium dat alleen overschrijven beloont (examenstijl kent dat punt niet). */
export function isGegevensCriterium(c: string): boolean {
  return /\bgegevens\b|\bgevraagde?\b|\bnoteren\s+van\s+de\s+gegevens\b/i.test(c) && !/formule|omreken|aflez|bereken/i.test(c);
}

export const DOORREKENEN =
  "Examenregel: een rekenfout en een fout of ontbrekende eenheid kosten samen hooguit 1 punt; verder rekenen met de eigen (foute) waarde wordt goed gerekend; significantie en tussentijds afronden kosten geen punten; het formulepunt alleen als de formule met de juiste grootheden is opgeschreven (alleen een rekenbewerking is niet genoeg).";

/**
 * Rekenvragen krijgen deelpunten: een fout (bijv. niet delen door 2) kost 1 punt, niet de hele vraag.
 * "Niet toekennen"-regels worden aftrekregels; de doorrekenregel staat er altijd bij.
 */
export function rekenAftrek(regels: string[] | undefined): string[] {
  const uit = (regels ?? [])
    .map((r) => r.trim())
    .filter(Boolean)
    .filter((r) => !/^rekenfout of vergeten stap|^examenregel:/i.test(r))
    .map((r) => (/aftrek|punt minder|-\s*1\s*p/i.test(r) ? r : `${r.replace(/[.;]+$/, "")}: 1 punt aftrek (niet de hele vraag fout)`));
  return [...uit, DOORREKENEN];
}

function overlapt(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.length > 8 && y.length > 8 && (x.includes(y) || y.includes(x))) return true;
  const perItem = /elke|per juiste|0[,.]5/;
  const lump = /minstens|alle |vier juiste|twee juiste/;
  return (perItem.test(x) && lump.test(y)) || (perItem.test(y) && lump.test(x));
}

function dedupe(criteria: PuntenCriterium[]): PuntenCriterium[] {
  const out: PuntenCriterium[] = [];
  for (const c of criteria) {
    const hit = out.findIndex((o) => overlapt(o.criterium, c.criterium));
    if (hit < 0) {
      out.push({ ...c });
      continue;
    }
    const prev = out[hit]!;
    const prevFrac = fractioneel(prev.punt);
    const nextFrac = fractioneel(c.punt);
    if ((prevFrac && !nextFrac) || (prevFrac === nextFrac && c.punt > prev.punt)) {
      out[hit] = { ...c };
    }
  }
  return out;
}

function rubriekOpen(q: Vraag, nakijk: NakijkItem): void {
  let criteria = dedupe(nakijk.puntenverdeling ?? []);
  const fracs = criteria.filter((c) => fractioneel(c.punt));
  const lumps = criteria.filter((c) => !fractioneel(c.punt) && c.punt >= 1);
  if (fracs.length && lumps.length) criteria = lumps;
  else if (fracs.length) criteria = criteria.map((c) => ({ ...c, punt: 1 }));

  criteria = criteria
    .map((c) => ({ ...c, punt: Math.max(1, heel(c.punt)) }))
    .filter((c) => c.punt > 0);

  if (!criteria.length) {
    criteria = [{ punt: Math.max(1, heel(q.punten || 1)), criterium: "juist antwoord" }];
  }
  const som = criteria.reduce((s, c) => s + c.punt, 0);
  q.punten = som;
  nakijk.puntenverdeling = criteria;
}

/**
 * Hele punten, rubriek som = vraagsom.
 * Rekenvragen: gegevens/gevraagd, formule, uitwerking+eenheid (3p), niet 4p voor één deling.
 */
export function repareerPunten(
  vragen: Vraag[],
  nakijkmodel: NakijkItem[],
): { vragen: Vraag[]; nakijkmodel: NakijkItem[] } {
  const nextV = vragen.map((q) => ({ ...q }));
  const nextN = nakijkmodel.map((n) => ({
    ...n,
    puntenverdeling: (n.puntenverdeling ?? []).map((p) => ({ ...p })),
    nietToekennen: n.nietToekennen ? [...n.nietToekennen] : undefined,
  }));

  nextV.forEach((q, i) => {
    const n = nextN.find((item) => item.nummer === q.nummer) ?? nextN[i];
    if (!n) return;
    if (isMc(q)) {
      q.punten = Math.max(1, heel(q.punten || 1));
      return;
    }
    if (isBerekening(q)) {
      const eigen = (n.puntenverdeling ?? []).filter((c) => c.criterium?.trim());
      const som = eigen.reduce((s, c) => s + c.punt, 0);
      // Specifieke stappen van het model blijven staan als ze netjes zijn (2–4 hele punten in 2–4 stappen);
      // anders de standaard driedeling.
      const netjes = eigen.length >= 2 && eigen.length <= 4 && eigen.every((c) => c.punt >= 1 && !fractioneel(c.punt)) && som >= 2 && som <= 4;
      // Een punt voor "gegevens en gevraagde" bestaat niet: dan de standaardrubriek met hetzelfde totaal.
      const verdeling = netjes && !eigen.some((c) => isGegevensCriterium(c.criterium))
        ? eigen.map((c) => ({ ...c }))
        : rekenRubriek(netjes ? som : heel(q.punten || 3) <= 2 ? 2 : 3);
      q.punten = verdeling.reduce((s, c) => s + c.punt, 0);
      n.puntenverdeling = verdeling;
      n.nietToekennen = rekenAftrek(n.nietToekennen);
      return;
    }
    rubriekOpen(q, n);
  });

  return { vragen: nextV, nakijkmodel: nextN };
}

export function rubricSomKlopt(vragen: Vraag[], nakijkmodel: NakijkItem[]): { ok: boolean; problemen: string[] } {
  const problemen: string[] = [];
  for (const q of vragen) {
    const n = nakijkmodel.find((item) => item.nummer === q.nummer);
    if (!n) {
      problemen.push(`vraag ${q.nummer}: geen nakijkregel`);
      continue;
    }
    const som = (n.puntenverdeling ?? []).reduce((s, p) => s + p.punt, 0);
    if (Math.abs(som - q.punten) > 0.001) problemen.push(`vraag ${q.nummer}: rubriek ${som} ≠ ${q.punten}p`);
    if ((n.puntenverdeling ?? []).some((p) => fractioneel(p.punt)) || fractioneel(q.punten)) {
      problemen.push(`vraag ${q.nummer}: geen hele punten`);
    }
  }
  return { ok: problemen.length === 0, problemen };
}
