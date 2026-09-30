import { RTTI_META, RTTI_ORDER } from "./constants.ts";
import type { ItemIssue } from "./item-kwaliteit";
import type { Rtti, RttiVerdeling, Vraag } from "./types";

export const RTTI_TOLERANTIE = 10;

export function rttiPercentages(vragen: Vraag[]): Record<Rtti, number> {
  const max = Math.max(1, vragen.reduce((s, q) => s + (q.punten || 0), 0));
  const out = {} as Record<Rtti, number>;
  for (const k of RTTI_ORDER) out[k] = Math.round((vragen.filter((q) => q.rtti === k).reduce((s, q) => s + (q.punten || 0), 0) / max) * 100);
  return out;
}

function normaal(doel: RttiVerdeling): Record<Rtti, number> {
  const som = RTTI_ORDER.reduce((s, k) => s + (doel[k] || 0), 0) || 1;
  const out = {} as Record<Rtti, number>;
  for (const k of RTTI_ORDER) out[k] = ((doel[k] || 0) / som) * 100;
  return out;
}

/**
 * Plan om de RTTI-verdeling binnen de tolerantie te brengen: kies vragen uit het niveau met het
 * grootste overschot en laat ze herschrijven naar het niveau met het grootste tekort (zelfde
 * onderwerp en punten). Simuleert de verschuiving zodat er niet te veel wordt omgezet.
 */
export function rttiHerschrijfPlan(vragen: Vraag[], doel: RttiVerdeling, opts: { vermijd?: Set<number>; max?: number } = {}): ItemIssue[] {
  const d = normaal(doel);
  const totaal = Math.max(1, vragen.reduce((s, q) => s + (q.punten || 0), 0));
  const labels = new Map(vragen.map((q) => [q.nummer, q.rtti]));
  const pct = (): Record<Rtti, number> => {
    const out = {} as Record<Rtti, number>;
    for (const k of RTTI_ORDER) out[k] = (vragen.filter((q) => labels.get(q.nummer) === k).reduce((s, q) => s + (q.punten || 0), 0) / totaal) * 100;
    return out;
  };
  const issues: ItemIssue[] = [];
  const gebruikt = new Set(opts.vermijd ?? []);
  for (let stap = 0; stap < (opts.max ?? 3); stap++) {
    const p = pct();
    const afw = RTTI_ORDER.map((k) => ({ k, v: p[k] - d[k] }));
    if (Math.max(...afw.map((a) => Math.abs(a.v))) <= RTTI_TOLERANTIE) break;
    const over = afw.slice().sort((a, b) => b.v - a.v)[0]!;
    const tekort = afw.slice().sort((a, b) => a.v - b.v)[0]!;
    if (over.v <= 0 || tekort.v >= 0) break;
    const nodigP = (Math.min(over.v, -tekort.v) / 100) * totaal;
    const kandidaten = vragen
      .filter((q) => labels.get(q.nummer) === over.k && !gebruikt.has(q.nummer) && !q.figuur)
      .sort((a, b) => Math.abs((a.punten || 1) - nodigP) - Math.abs((b.punten || 1) - nodigP));
    const q = kandidaten[0];
    if (!q) break;
    // Alleen omzetten als het de grootste afwijking echt kleiner maakt.
    const voor = Math.max(...afw.map((a) => Math.abs(a.v)));
    labels.set(q.nummer, tekort.k);
    const na = Math.max(...RTTI_ORDER.map((k) => Math.abs(pct()[k] - d[k])));
    if (na >= voor) {
      labels.set(q.nummer, over.k);
      break;
    }
    gebruikt.add(q.nummer);
    issues.push({
      nummer: q.nummer,
      code: "rtti",
      uitleg: `RTTI-balans: herschrijf deze vraag van ${over.k} naar ${tekort.k} (${RTTI_META[tekort.k].naam}: ${RTTI_META[tekort.k].uitleg}). Zelfde paragraaf en ${q.punten} punt${q.punten === 1 ? "" : "en"}; zet rtti op "${tekort.k}".`,
    });
  }
  return issues;
}

/**
 * Klas 3–4: minstens `min` inzichtvragen (I). Ontbreken ze, dan wordt een open meerpuntsvraag (liefst T2)
 * herschreven tot een echte redeneervraag in een nieuwe situatie. De opdrachtzin ("Leg uit of …",
 * "Voorspel …") maakt het I-label controleerbaar voor de RTTI-regels.
 */
export function inzichtIssues(vragen: Vraag[], min: number, vermijd: Set<number> = new Set()): ItemIssue[] {
  const nu = vragen.filter((q) => q.rtti === "I").length;
  if (!min || nu >= min) return [];
  const volgorde: Record<Rtti, number> = { T2: 0, T1: 1, R: 2, I: 3 };
  const kandidaten = vragen
    .filter((q) => !vermijd.has(q.nummer) && !q.opties?.length && !q.figuur && !q.figuurId && (q.punten ?? 1) >= 2)
    .sort((a, b) => volgorde[a.rtti] - volgorde[b.rtti] || (b.punten ?? 1) - (a.punten ?? 1));
  return kandidaten.slice(0, min - nu).map((q) => ({
    nummer: q.nummer,
    code: "rtti",
    uitleg: `RTTI: de toets heeft nog geen inzichtvraag (I); klas 3–4 moet er minstens één hebben. Herschrijf deze vraag tot een I-vraag over hetzelfde leerdoel en dezelfde paragraaf, ${q.punten} punten: een NIEUWE, realistische situatie waarin de leerling moet redeneren of voorspellen, met een opdrachtzin als "Leg uit of …" of "Voorspel wat er gebeurt met … als …". Geen herhaling van een verband dat al in een andere vraag getoetst wordt, en het antwoord staat niet in een andere vraag. Rubriek: 1 punt per redeneerstap (bijv. juiste conclusie + juiste redenering). Zet rtti op "I".`,
  }));
}
