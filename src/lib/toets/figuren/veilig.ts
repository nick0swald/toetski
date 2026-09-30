import type { GegenereerdeToets, NakijkItem, Vraag } from "../types";
import { figuurDeps } from "./client";
import { naModelRonde, verwerkFiguren } from "./verwerk";
import { bewaakFiguren, zonderLegacyFiguren } from "./bevriezing";

/**
 * Client-ingang van de beeldpijplijn. Faalt hier iets onverwachts, dan krijgt de docent
 * gewoon de toets — zonder ongekeurde figuren — en een melding in de kwaliteitsfeedback.
 */
export async function verwerkFigurenVeilig(toets: GegenereerdeToets, voortgang?: (t: string) => void): Promise<GegenereerdeToets> {
  try {
    return await verwerkFiguren(toets, figuurDeps(voortgang));
  } catch (err) {
    const melding = `Beeldpijplijn mislukt (${err instanceof Error ? err.message.slice(0, 120) : "fout"}); toets zonder figuren.`;
    return {
      ...toets,
      vragen: toets.vragen.map(zonderLegacyFiguren),
      figuurPijplijn: 1,
      figuurRapport: { versie: 1, items: [], meldingen: [melding] },
      kwaliteit: {
        ...toets.kwaliteit,
        punten: [...toets.kwaliteit.punten, { criterium: "Figuurkeuring (go/no-go)", oordeel: "let op", toelichting: melding }],
      },
    };
  }
}

export async function naModelRondeVeilig(
  oud: GegenereerdeToets,
  nieuw: { vragen: Vraag[]; nakijkmodel: NakijkItem[] },
): Promise<GegenereerdeToets> {
  try {
    return await naModelRonde(oud, nieuw, figuurDeps());
  } catch {
    const r = bewaakFiguren(oud.vragen, nieuw.vragen, { pijplijn: Boolean(oud.figuurPijplijn) });
    return { ...oud, vragen: r.vragen, nakijkmodel: nieuw.nakijkmodel };
  }
}
