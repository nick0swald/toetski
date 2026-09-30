import { maakFiguur, planFiguren } from "../figuur-pipeline";
import type { VerwerkDeps } from "./verwerk";

/** Koppelt de client-orkestratie aan de serverfuncties (één aanroep per figuur, parallel). */
export function figuurDeps(voortgang?: (tekst: string) => void): VerwerkDeps {
  return {
    plan: (input) => planFiguren({ data: input }),
    maak: (opdracht) =>
      maakFiguur({
        data: {
          vraag: opdracht.vraag,
          nakijk: opdracht.nakijk,
          spec: opdracht.spec,
          legacy: opdracht.legacy,
          verwijst: opdracht.verwijst,
          nieuweStam: opdracht.nieuweStam,
        },
      }),
    voortgang,
  };
}
