import type { GegenereerdeToets } from "../types.ts";
import { figuurIsGeldig } from "./bevriezing.ts";
import { vraagZonderFiguur } from "./fallback.ts";

const VERWIJST = /\b(figuur|grafiek|diagram|afbeelding|plaatje|tekening|schema|schakeling hieronder|hieronder)\b/i;

/**
 * Docent verwijdert één figuur bij één vraag. ALLEEN verwijderen: de figuur zelf wordt nooit gewijzigd.
 * De vraag blijft bruikbaar: verwijst de tekst naar de figuur, dan wordt (net als bij een gedropte figuur)
 * de data als tabel/tekst gegeven of de verwijzing neutraal gemaakt. Het id wordt vastgelegd zodat
 * geen enkele latere stap de figuur terugzet.
 */
export function verwijderFiguur(toets: GegenereerdeToets, nummer: number, nu: Date = new Date()): GegenereerdeToets {
  const q = toets.vragen.find((v) => v.nummer === nummer);
  if (!q?.figuur) return toets;
  const fig = q.figuur;
  const { figuur: _f, figuurId: _i, ...rest } = q;
  const tekst = `${q.context ?? ""} ${q.stam}`;
  const { vraag, fallback } = figuurIsGeldig(fig)
    ? vraagZonderFiguur(rest, fig.spec, { legacy: false, verwijst: VERWIJST.test(tekst) })
    : { vraag: rest, fallback: "verwijderd" as const };
  const nieuw = { ...vraag, figuurVerwijderd: fig.id };
  const tijd = nu.toISOString();
  const rapport = toets.figuurRapport ?? { versie: 1 as const, items: [], meldingen: [] };
  let gevonden = false;
  const items = rapport.items.map((it) => {
    if (it.figuurId !== fig.id) return it;
    gevonden = true;
    return { ...it, docentVerwijderd: tijd, fallback };
  });
  if (!gevonden) {
    items.push({ nummer, soort: fig.soort, bron: fig.bron, status: "go", pogingen: fig.pogingen, redenen: [], figuurId: fig.id, docentVerwijderd: tijd, fallback });
  }
  return {
    ...toets,
    vragen: toets.vragen.map((v) => (v.nummer === nummer ? nieuw : v)),
    figuurRapport: {
      ...rapport,
      items,
      meldingen: [...(rapport.meldingen ?? []), `Vraag ${nummer}: figuur verwijderd door de docent.`],
    },
  };
}
