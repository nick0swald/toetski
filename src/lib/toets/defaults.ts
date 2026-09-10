import { DEFAULT_CIJFER } from "./cijfer";
import { normalizeLeerweg } from "./constants";
import type { GegenereerdeToets } from "./types";

export function withDefaults(t: GegenereerdeToets): GegenereerdeToets {
  return {
    ...t,
    ronde: t.ronde ?? 1,
    cijferNorm: t.cijferNorm ?? DEFAULT_CIJFER,
    extraEisen: t.extraEisen ?? "",
    bronmateriaal: t.bronmateriaal ?? "",
    soort: t.soort ?? "toets",
    feedbackGewenst: t.feedbackGewenst ?? false,
    meta: {
      ...t.meta,
      leerweg: normalizeLeerweg(t.meta.leerweg),
      versie: t.meta.versie ?? "A",
      moeilijkheid: t.meta.moeilijkheid ?? "normaal",
      hulpmiddelen: t.meta.hulpmiddelen ?? [],
      instructies: t.meta.instructies ?? [],
      extraTijd: t.meta.extraTijd?.trim() || undefined,
    },
  };
}
