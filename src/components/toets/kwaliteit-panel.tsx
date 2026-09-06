import type { GegenereerdeToets, KwaliteitOordeel } from "@/lib/toets/types";
import { cn } from "@/lib/utils";

const label: Record<KwaliteitOordeel, string> = {
  voldoet: "Voldoet",
  aandacht: "Aandacht",
  ontbreekt: "Ontbreekt",
};

export function KwaliteitPanel({ toets }: { toets: GegenereerdeToets }) {
  return (
    <div className="grid gap-6">
      <p className="text-pretty leading-relaxed text-fg">{toets.kwaliteit.samenvatting}</p>
      <ul>
        {toets.kwaliteit.punten.map((p) => (
          <li key={p.criterium} className="border-t border-border py-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-brand">{p.criterium}</h3>
              <span
                className={cn(
                  "text-sm font-semibold",
                  p.oordeel === "voldoet" ? "text-brand" : "text-warn",
                )}
              >
                {label[p.oordeel]}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.toelichting}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm leading-relaxed text-muted">
        Dit is een constructiehulp. De vakdocent blijft verantwoordelijk voor inhoud, cesuur en
        afname.
      </p>
    </div>
  );
}
