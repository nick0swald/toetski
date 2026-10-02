import { extractParagrafen } from "./leerdoelen.ts";
import { paragraafTekst } from "./leerdoelen-plan.ts";
import type { Vraag } from "./types";

/**
 * Lesstof voor een prompt met een tekenlimiet. Past de lesstof erin: ongewijzigd. Is ze langer (lesstof over
 * meer hoofdstukken, bijv. SE4.2 = H11 + H13 + materie), dan NIET alleen het begin (dan lijkt alle stof uit
 * latere hoofdstukken 'buiten de lesstof'), maar: de paragrafen van deze vragen (domein "13.2 …") ruim, en van
 * elke andere paragraaf het begin, in boekvolgorde. Zonder herkenbare paragraafkoppen: het begin (oud gedrag).
 */
export function lesstofVoorVragen(lesstof: string, vragen: Pick<Vraag, "domein" | "leerdoel">[], limiet: number): string {
  const tekst = lesstof.trim();
  if (tekst.length <= limiet) return tekst;
  const pars = extractParagrafen(tekst);
  if (pars.length < 2) return tekst.slice(0, limiet);
  const delen = pars.map((p) => ({ code: p.code, tekst: paragraafTekst(tekst, p, pars) })).filter((d) => d.tekst);
  if (delen.length < 2) return tekst.slice(0, limiet);
  const codes = new Set<string>();
  for (const q of vragen) {
    for (const m of `${q.domein ?? ""} ${q.leerdoel ?? ""}`.matchAll(/(?:^|[^\d.])(\d{1,2})\.(\d{1,2})(?![\d])/g)) codes.add(`${Number(m[1])}.${Number(m[2])}`);
  }
  const gevraagd = delen.filter((d) => codes.has(d.code));
  const overig = delen.filter((d) => !codes.has(d.code));
  // 70% voor de paragrafen van deze vragen, de rest als overzicht over alle andere paragrafen.
  const gevraagdBudget = gevraagd.length ? Math.floor(limiet * 0.7) : 0;
  const perGevraagd = gevraagd.length ? Math.floor(gevraagdBudget / gevraagd.length) : 0;
  const gebruiktGevraagd = gevraagd.reduce((s, d) => s + Math.min(d.tekst.length, perGevraagd), 0);
  const perOverig = overig.length ? Math.floor((limiet - gebruiktGevraagd) / overig.length) : 0;
  const stukken = delen.map((d) => {
    const max = codes.has(d.code) ? perGevraagd : perOverig;
    return d.tekst.length <= max ? d.tekst.trim() : `${d.tekst.slice(0, Math.max(0, max - 2)).trim()} …`;
  });
  return stukken.filter(Boolean).join("\n\n").slice(0, limiet);
}
