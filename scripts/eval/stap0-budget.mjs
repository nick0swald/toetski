/**
 * Budget voor de betaalde stap-0-rondes (geen API-aanroepen hier).
 *
 * - Per aanroep een REALISTISCHE schatting (gemeten in ronde 2: toets_spec ≈ $0,063, gericht vraagstuk ≈ $0,030,
 *   rechter met figuren ≈ $0,014) voor de verdeling over de cases en over parallelle aanroepen; geen optelsom van
 *   worst cases meer.
 * - Een HARD plafond voor de hele ronde, getoetst aan de WERKELIJK gelogde kosten (eval-out/kosten.jsonl, regels van
 *   stap0-ronde sinds de start) + de realistische schatting van wat nu loopt + de worst case van déze aanroep.
 * - Prioriteit: generatie, herstel en aanvulling mogen het hele casebudget gebruiken; de rechter krijgt wat over is
 *   (1 run altijd als het plafond het toelaat, een 2e run alleen binnen het casebudget).
 */
import { existsSync, readFileSync } from "node:fs";

export const PRIJS = { in: 2.0, uit: 6.0 }; // grok-4.5, USD per 1M tokens
/** Verwachte uitvoer-tokens per soort aanroep (gemeten in ronde 2, ruim genomen). */
export const VERWACHT_UIT = { toets_spec: 9000, vraagstuk: 1800, rechter: 1200 };
export const TEKENS_PER_TOKEN = 3.3;

export const worstCase = (tekens, maxTokens) => ((tekens / 3) * PRIJS.in + maxTokens * PRIJS.uit) / 1e6;
export const realistisch = (tekens, soort, extraTokensIn = 0) => (1.15 * ((tekens / TEKENS_PER_TOKEN + extraTokensIn) * PRIJS.in + (VERWACHT_UIT[soort] ?? 2000) * PRIJS.uit)) / 1e6;

/** Werkelijk gelogde kosten van stap0-ronde sinds `start` (ISO, UTC). */
export function gelogdeKosten(logPad, start) {
  if (!existsSync(logPad)) return 0;
  let s = 0;
  for (const l of readFileSync(logPad, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try {
      const d = JSON.parse(l);
      if (d.script === "stap0-ronde" && (d.t ?? "") >= start) s += d.usd ?? 0;
    } catch {
      /* kapotte regel */
    }
  }
  return s;
}

/**
 * Budgetbewaker voor één case-proces. `gelogd()` geeft de werkelijk gelogde rondekosten (alle cases).
 * `aanvraag` = { soort, schatting (realistisch), worst } → true en gereserveerd, of false met reden.
 */
export function maakBewaker({ caseBudget, plafond, gelogd, log = () => {} }) {
  let lopend = 0;
  let eigen = 0;
  return {
    get lopend() {
      return lopend;
    },
    get eigen() {
      return eigen;
    },
    aanvraag({ soort, schatting, worst, binnenCase = true }) {
      const g = gelogd();
      if (g + lopend + worst > plafond + 1e-9) {
        log(`[budget] STOP vóór ${soort}: gelogd ${g.toFixed(4)} + lopend ${lopend.toFixed(4)} + worst case ${worst.toFixed(4)} > plafond ${plafond.toFixed(2)}`);
        return false;
      }
      if (binnenCase && eigen + lopend + schatting > caseBudget + 1e-9) {
        log(`[budget] STOP vóór ${soort}: case ${eigen.toFixed(4)} + lopend ${lopend.toFixed(4)} + schatting ${schatting.toFixed(4)} > casebudget ${caseBudget.toFixed(4)}`);
        return false;
      }
      lopend += schatting;
      return true;
    },
    klaar(schatting, usd) {
      lopend = Math.max(0, lopend - schatting);
      eigen += usd;
    },
  };
}

/**
 * Projectie per case (droog): verwachte kosten = generatie + gerichte aanroepen + rechterruns, met de gemeten
 * gemiddelden. Geeft per case de verwachting en welke cases binnen het plafond passen (in prioriteitsvolgorde).
 */
export function projectie(cases, plafond, gem = { toets_spec: 0.063, vraagstuk: 0.03, rechter: 0.014 }, rechterRuns = 2, marge = 0.05) {
  let som = 0;
  const uit = [];
  for (const c of cases) {
    const kosten = gem.toets_spec + c.gericht * gem.vraagstuk + rechterRuns * gem.rechter;
    const past = som + kosten <= plafond - marge;
    if (past) som += kosten;
    uit.push({ ...c, kosten: Math.round(kosten * 1000) / 1000, past });
  }
  return { cases: uit, totaal: Math.round(som * 1000) / 1000 };
}
