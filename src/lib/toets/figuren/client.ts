import { maakFiguur, planFiguren } from "../figuur-pipeline";
import type { FiguurGebeurtenis, VerwerkDeps } from "./verwerk";

/** Koppelt de client-orkestratie aan de serverfuncties (één aanroep per figuur, parallel). */
export function figuurDeps(voortgang?: (tekst: string) => void, gebeurtenis?: (e: FiguurGebeurtenis) => void): VerwerkDeps {
  return {
    plan: (input) => planFiguren({ data: input }),
    maak: (opdracht, budgetMs) =>
      maakFiguur({
        data: {
          vraag: opdracht.vraag,
          nakijk: opdracht.nakijk,
          spec: opdracht.spec,
          legacy: opdracht.legacy,
          verwijst: opdracht.verwijst,
          nieuweStam: opdracht.nieuweStam,
          budgetMs: budgetMs == null ? undefined : Math.max(3_000, Math.min(165_000, Math.round(budgetMs))),
        },
      }),
    voortgang,
    gebeurtenis,
  };
}
