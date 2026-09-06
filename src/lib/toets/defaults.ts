import {
  DEFAULT_CIJFER,
  cesuurPunten,
  cesuurZin,
  formuleTekst,
  instructiesMetCesuur,
} from "./cijfer";
import { normalizeLeerweg } from "./constants";
import { totaalPunten } from "./rtti";
import type { GegenereerdeToets } from "./types";

export function withDefaults(t: GegenereerdeToets): GegenereerdeToets {
  const cijferNorm = t.cijferNorm ?? DEFAULT_CIJFER;
  const vragen = t.vragen ?? [];
  const max = Math.max(1, totaalPunten(vragen));
  const isMatrijs = (t.soort ?? "toets") === "matrijs";
  const cesuur = isMatrijs
    ? {
        nTerm: t.cesuur?.nTerm ?? 1,
        cesuurPunten: t.cesuur?.cesuurPunten ?? cesuurPunten(max, cijferNorm),
        toelichting:
          t.cesuur?.toelichting ??
          "Matrijs bij bestaande toets; cijfernorm is niet opnieuw vastgesteld.",
        formule: t.cesuur?.formule ?? formuleTekst(cijferNorm, max),
      }
    : {
        nTerm: 1,
        cesuurPunten: cesuurPunten(max, cijferNorm),
        toelichting: cesuurZin(max, cijferNorm),
        formule: formuleTekst(cijferNorm, max),
      };
  const instructies = isMatrijs
    ? (t.meta.instructies ?? [])
    : instructiesMetCesuur(t.meta.instructies ?? [], max, cijferNorm);

  return {
    ...t,
    ronde: t.ronde ?? 1,
    cijferNorm,
    extraEisen: t.extraEisen ?? "",
    bronmateriaal: t.bronmateriaal ?? "",
    soort: t.soort ?? "toets",
    feedbackGewenst: t.feedbackGewenst ?? false,
    vakProfiel: t.vakProfiel ?? "generiek",
    cesuur,
    meta: {
      ...t.meta,
      leerweg: normalizeLeerweg(t.meta.leerweg),
      versie: t.meta.versie ?? "A",
      moeilijkheid: t.meta.moeilijkheid ?? "normaal",
      hulpmiddelen: t.meta.hulpmiddelen ?? [],
      instructies,
    },
  };
}
