import { borgFiguurVerwijzingen, heeftOpdracht, repareerSchoolnamen } from "./context-regels.ts";
export { heeftOpdracht };
import { herstelGroepen } from "./context-groepen.ts";
import { herbouwMatrijs } from "./rtti.ts";
import { cesuurPunten, formuleTekst } from "./cijfer.ts";
import type { GegenereerdeToets } from "./types";

/**
 * Laatste bewaking vóór het blad: geen verwijzing naar een figuur die er niet staat.
 * Een vraag die zonder figuur niet te maken is, gaat eruit (punten, cesuur en matrijs worden herberekend).
 */
/**
 * Zinsbreuk tussen context en stam herstellen (r8: context "Bram luistert naar muziek." + stam "op zijn
 * telefoon. Noem …"): begint de stam met een kleine letter, dan hoort het eerste stuk bij de context.
 */
export function herstelZinsbreuk<T extends { context?: string | null; stam: string }>(q: T): T {
  const ctx = (q.context ?? "").trim();
  const m = /^([a-zà-ÿ][^.?!]*[.!])\s+(.+)$/s.exec(q.stam.trim());
  if (!ctx || !m || !/[.]$/.test(ctx)) return q;
  // Alleen als het eerste stuk geen opdracht/vraag is (dan is het een voortzetting van de contextzin).
  if (/\?|\b(?:noem|noteer|bereken|leg|geef|teken|bepaal|maak|kies)\b/i.test(m[1]!)) return q;
  return { ...q, context: `${ctx.replace(/\.$/, "")} ${m[1]}`, stam: m[2]!.trim() };
}

/** Zin die na een punt met een kleine letter begint (r9: "… 92 dB. mag je hier …") krijgt een hoofdletter. */
export function hoofdletterNaPunt(t: string | undefined | null): string | undefined {
  if (!t) return t ?? undefined;
  return t.replace(/(^|[^.]\b(\S+)[.!?]\s+)([a-zà-ÿ])/g, (m, voor: string, woord: string | undefined, letter: string) =>
    woord && /^(?:bijv|ca|o\.a|enz|d\.w\.z|m\.a\.w|resp|vgl|nr|max|min|gem|ong)\.?$/i.test(woord) ? m : `${voor}${letter.toUpperCase()}`,
  ).replace(/^([a-zà-ÿ])/, (l) => l.toUpperCase());
}

export function eindControle(toets0: GegenereerdeToets): GegenereerdeToets {
  // Schoolnamen ook hier (figuurterugval kan tekst uit de ruwe vraag terugzetten).
  const nk = toets0.nakijkmodel.map((n) => ({ ...n, puntenverdeling: (n.puntenverdeling ?? []).map((p) => ({ ...p })) }));
  const vr = toets0.vragen.map((q) => {
    const kopie = { ...q, opties: q.opties?.map((o) => ({ ...o })) };
    repareerSchoolnamen(kopie, nk.find((n) => n.nummer === q.nummer));
    const h = herstelZinsbreuk(kopie);
    return { ...h, context: hoofdletterNaPunt(h.context), stam: hoofdletterNaPunt(h.stam) ?? h.stam };
  });
  const toets = { ...toets0, vragen: vr, nakijkmodel: nk };
  const b = borgFiguurVerwijzingen(toets.vragen, toets.nakijkmodel);
  if (!b.meldingen.length) return toets;
  const rapport = toets.figuurRapport ?? { versie: 1 as const, items: [], meldingen: [] };
  const her = b.hernummer;
  let uit: GegenereerdeToets = {
    ...toets,
    // Viel de eerste vraag van een situatie weg, dan schuift de situatietekst door naar de volgende.
    vragen: b.verwijderd.length ? herstelGroepen(b.vragen, toets.vragen) : b.vragen,
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
    // De kwaliteitsfeedback telde nog met de verwijderde vragen: zeg dat erbij.
    if (uit.kwaliteit?.punten) {
      uit = {
        ...uit,
        kwaliteit: {
          ...uit.kwaliteit,
          punten: [
            ...uit.kwaliteit.punten,
            {
              criterium: "Eindcontrole",
              oordeel: "let op",
              toelichting: `${b.verwijderd.length} vraag/vragen verwijderd (zonder figuur niet te maken); de toets telt nu ${uit.vragen.length} vragen / ${max} punten. Tellingen hierboven zijn van vóór deze stap.`,
            },
          ],
        },
      };
    }
  }
  return uit;
}

