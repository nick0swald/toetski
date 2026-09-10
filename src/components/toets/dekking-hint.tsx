import { useMemo } from "react";
import type { GegenereerdeToets } from "@/lib/toets/types";
import { bouwDekkingHint } from "@/lib/toets/dekking";

/** Korte dekkingsnotitie onder de toets (geen dashboard). */
export function DekkingHintBanner({ toets }: { toets: GegenereerdeToets }) {
  const dekking = useMemo(
    () => bouwDekkingHint(toets.bronmateriaal ?? "", toets.vragen),
    [toets.bronmateriaal, toets.vragen],
  );
  if (!dekking) return null;
  return (
    <aside className="mx-auto mt-6 max-w-2xl rounded-[var(--radius-md)] bg-surface p-4 text-sm leading-relaxed text-muted print:hidden">
      <span className="font-semibold text-brand">Dekking: </span>
      {dekking.samenvatting}
    </aside>
  );
}
