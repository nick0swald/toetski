import { RTTI_META } from "@/lib/toets/constants";
import type { GegenereerdeToets } from "@/lib/toets/types";

export function NakijkSheet({
  toets,
  editing,
  onAntwoord,
}: {
  toets: GegenereerdeToets;
  editing?: boolean;
  onAntwoord?: (nummer: number, modelantwoord: string) => void;
}) {
  return (
    <article className="rounded-[var(--radius-xl)] bg-paper p-6 sm:p-10">
      <h2 className="text-2xl font-bold text-brand">Nakijkmodel · {toets.meta.titel}</h2>
      <p className="mt-2 text-sm text-muted">Niet voor leerlingen. {toets.cesuur.formule}</p>
      <ol className="mt-6 grid gap-6">
        {toets.nakijkmodel.map((n) => {
          const q = toets.vragen.find((v) => v.nummer === n.nummer);
          return (
            <li key={n.nummer} className="border-t border-border pt-4">
              <p className="font-semibold text-brand">
                Vraag {n.nummer} ({q?.punten ?? "?"}p) {q ? RTTI_META[q.rtti].kort : ""}
              </p>
              {editing ? (
                <textarea
                  className="mt-2 w-full min-h-20 rounded-[var(--radius-md)] bg-surface/50 p-3 text-sm"
                  value={n.modelantwoord}
                  onChange={(e) => onAntwoord?.(n.nummer, e.target.value)}
                />
              ) : (
                <p className="mt-2 leading-relaxed">{n.modelantwoord}</p>
              )}
              {n.puntenverdeling.length ? (
                <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                  {n.puntenverdeling.map((p) => (
                    <li key={p.criterium}>
                      {p.punt}p — {p.criterium}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
