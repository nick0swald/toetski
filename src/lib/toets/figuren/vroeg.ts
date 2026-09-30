import { detectVakProfiel } from "../bron-figuren.ts";
import { metFiguurKwaliteit } from "../kwaliteit-check.ts";
import type { FiguurRapportItem, GegenereerdeToets, NakijkItem, Vraag } from "../types.ts";
import { diepBevriezen, figuurIsGeldig, zonderLegacyFiguren } from "./bevriezing.ts";
import { vraagZonderFiguur } from "./fallback.ts";
import { heeftLegacyFiguur, legacySpecs } from "./spec.ts";
import { verwerkFiguren, type VerwerkDeps } from "./verwerk.ts";

/**
 * Vroege beeldpijplijn: figuren worden al gemaakt en gekeurd op de RUWE vragen, parallel aan het
 * afwerken (reparatie, punten, MC-hussel). Daarna koppelen we per afgewerkte vraag:
 * - alleen als de vraag inhoudelijk dezelfde bleef (zelfde stam en type, zelfde figuurdata),
 * - een vraag die tijdens het afwerken is vervangen/herschreven verliest zijn figuur.
 * Goedgekeurde figuren worden ongewijzigd (bevroren) overgenomen; nooit opnieuw getekend.
 */

export function vraagSleutel(q: Pick<Vraag, "stam" | "type">): string {
  const stam = q.stam
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${q.type}|${stam}`;
}

function legacyGelijk(a: Vraag, b: Vraag): boolean {
  return JSON.stringify(legacySpecs(a).map((s) => s.data)) === JSON.stringify(legacySpecs(b).map((s) => s.data));
}

export interface VroegeRonde {
  /** Ruwe vragen zoals ze de pijplijn in gingen. */
  ruw: Vraag[];
  /** Resultaat van verwerkFiguren op de voorlopige toets met de ruwe vragen. */
  resultaat: GegenereerdeToets;
}

export async function koppelVroegeFiguren(
  finaal: GegenereerdeToets,
  vroeg: VroegeRonde | null,
  deps: VerwerkDeps,
  opts: { deadline?: number } = {},
): Promise<GegenereerdeToets> {
  const items: FiguurRapportItem[] = [];
  const meldingen: string[] = [...(vroeg?.resultaat.figuurRapport?.meldingen ?? [])];
  let vragen = finaal.vragen.slice();
  let nakijkmodel = finaal.nakijkmodel.slice();
  const gebruikt = new Set<number>();

  if (vroeg) {
    const telling = new Map<string, number>();
    for (const r of vroeg.ruw) telling.set(vraagSleutel(r), (telling.get(vraagSleutel(r)) ?? 0) + 1);
    const ruwOpSleutel = new Map(vroeg.ruw.filter((r) => telling.get(vraagSleutel(r)) === 1).map((r) => [vraagSleutel(r), r]));
    const prov = new Map(vroeg.resultaat.vragen.map((q) => [q.nummer, q]));
    const provNakijk = new Map(vroeg.resultaat.nakijkmodel.map((n) => [n.nummer, n]));
    const provItems = new Map<number, FiguurRapportItem[]>();
    for (const it of vroeg.resultaat.figuurRapport?.items ?? []) provItems.set(it.nummer, [...(provItems.get(it.nummer) ?? []), it]);

    vragen = vragen.map((F) => {
      const R = ruwOpSleutel.get(vraagSleutel(F));
      if (!R) return F;
      const its = provItems.get(R.nummer);
      const P = prov.get(R.nummer);
      if (!its?.length || !P) return F;
      // Figuurdata moet nog precies hetzelfde zijn als waarop gekeurd is.
      if (heeftLegacyFiguur(R) && !legacyGelijk(R, F)) return F;
      gebruikt.add(R.nummer);
      const hoofd = its.find((i) => i.status === "go") ?? its[0]!;
      items.push(...its.map((i) => ({ ...i, nummer: F.nummer })));
      if (hoofd.status === "go" && figuurIsGeldig(P.figuur)) {
        const nieuw: Vraag = zonderLegacyFiguren({ ...F, stam: P.stam !== R.stam ? P.stam : F.stam, figuur: diepBevriezen(P.figuur) });
        delete nieuw.figuurId;
        return nieuw;
      }
      if (hoofd.fallback === "herschreven" || hoofd.fallback === "vervangen") {
        const pn = provNakijk.get(R.nummer);
        if (pn) nakijkmodel = nakijkmodel.map((n) => (n.nummer === F.nummer ? { ...pn, nummer: F.nummer } : n));
        return zonderLegacyFiguren({ ...P, nummer: F.nummer });
      }
      return zonderLegacyFiguren({ ...F, stam: P.stam, context: P.context, tabel: P.tabel ?? F.tabel });
    });

    for (const [nr, its] of provItems) {
      if (gebruikt.has(nr)) continue;
      const go = its.find((i) => i.status === "go");
      if (!go) continue;
      meldingen.push(`Figuur bij ruwe vraag ${nr} vervallen: de vraag is tijdens het afwerken gewijzigd of vervangen.`);
    }
  }

  // Wat nog ongekeurde figuurvelden heeft (bijv. door het afwerken toegevoegd): tweede ronde binnen het budget,
  // anders deterministische terugval. Nooit een ongekeurde figuur.
  const tussen: GegenereerdeToets = {
    ...finaal,
    vragen,
    nakijkmodel,
    figuurRapport: { versie: 1, items, meldingen: meldingen.slice(-12) },
  };
  const rest = vragen.filter((q) => !figuurIsGeldig(q.figuur) && heeftLegacyFiguur(q)).map((q) => q.nummer);
  return verwerkFiguren(tussen, deps, { alleenNummers: rest, zonderPlanner: true, deadline: opts.deadline });
}

/** "Zonder plaatjes": geen pijplijn; figuurvelden worden deterministisch omgezet (tabel/tekst) of weggelaten. */
export function zonderPlaatjes(toets: GegenereerdeToets): GegenereerdeToets {
  const vragen = toets.vragen.map((q) => {
    const kaal = q.figuur ? ({ ...q, figuur: undefined } as Vraag) : q;
    if (!heeftLegacyFiguur(kaal)) return zonderLegacyFiguren(kaal);
    const spec = legacySpecs(kaal)[0];
    return spec ? vraagZonderFiguur(kaal, spec, { legacy: true, verwijst: true }).vraag : zonderLegacyFiguren(kaal);
  });
  const rapport = { versie: 1 as const, items: [], meldingen: ["Zonder plaatjes gekozen: geen figuren gemaakt."], zonderPlaatjes: true };
  const nask = detectVakProfiel(toets.meta.vak, toets.bronmateriaal) === "nask";
  return {
    ...toets,
    vragen,
    metPlaatjes: false,
    figuurPijplijn: 1,
    figuurRapport: rapport,
    kwaliteit: metFiguurKwaliteit(toets.kwaliteit, vragen, rapport, { nask }),
  };
}

export type { NakijkItem };
