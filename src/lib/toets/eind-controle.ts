import { borgFiguurVerwijzingen, repareerSchoolnamen } from "./context-regels.ts";
import { herbouwMatrijs } from "./rtti.ts";
import { cesuurPunten, formuleTekst } from "./cijfer.ts";
import type { GegenereerdeToets } from "./types";

/**
 * Laatste bewaking vóór het blad: geen verwijzing naar een figuur die er niet staat.
 * Een vraag die zonder figuur niet te maken is, gaat eruit (punten, cesuur en matrijs worden herberekend).
 */
export function eindControle(toets0: GegenereerdeToets): GegenereerdeToets {
  // Schoolnamen ook hier (figuurterugval kan tekst uit de ruwe vraag terugzetten).
  const nk = toets0.nakijkmodel.map((n) => ({ ...n, puntenverdeling: (n.puntenverdeling ?? []).map((p) => ({ ...p })) }));
  const vr = toets0.vragen.map((q) => {
    const kopie = { ...q, opties: q.opties?.map((o) => ({ ...o })) };
    repareerSchoolnamen(kopie, nk.find((n) => n.nummer === q.nummer));
    return kopie;
  });
  const toets = { ...toets0, vragen: vr, nakijkmodel: nk };
  const b = borgFiguurVerwijzingen(toets.vragen, toets.nakijkmodel);
  if (!b.meldingen.length) return toets;
  const rapport = toets.figuurRapport ?? { versie: 1 as const, items: [], meldingen: [] };
  const her = b.hernummer;
  let uit: GegenereerdeToets = {
    ...toets,
    vragen: b.vragen,
    nakijkmodel: b.nakijkmodel,
    figuurRapport: {
      ...rapport,
      items: her ? rapport.items.filter((i) => her.has(i.nummer)).map((i) => ({ ...i, nummer: her.get(i.nummer)! })) : rapport.items,
      meldingen: [...rapport.meldingen, ...b.meldingen],
    },
  };
  if (b.verwijderd.length) {
    const max = uit.vragen.reduce((s, q) => s + (q.punten || 0), 0);
    uit = herbouwMatrijs({ ...uit, cesuur: { ...uit.cesuur, cesuurPunten: cesuurPunten(max, uit.cijferNorm), formule: formuleTekst(uit.cijferNorm, max) } });
  }
  return uit;
}

