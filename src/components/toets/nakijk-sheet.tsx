import { RTTI_META } from "@/lib/toets/constants";
import type { GegenereerdeToets } from "@/lib/toets/types";
import { figuurIsGeldig } from "@/lib/toets/figuren/bevriezing";

export function NakijkSheet({
  toets,
  editing,
  onAntwoord,
}: {
  toets: GegenereerdeToets;
  editing?: boolean;
  onAntwoord?: (nummer: number, modelantwoord: string) => void;
}) {
  const figuurNr = new Map<string, number>();
  for (const q of toets.vragen) if (figuurIsGeldig(q.figuur)) figuurNr.set(q.figuur.id, figuurNr.size + 1);
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
              {q?.rttiUitleg || q?.bronvermelding ? (
                <p className="mt-1 text-xs italic text-muted">
                  {[q.rttiUitleg ? `RTTI ${q.rttiUitleg}` : "", q.vraagtype && q.vraagtype !== "OVERIG" ? `type ${q.vraagtype}` : "", q.bronvermelding ?? ""].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {q && figuurIsGeldig(q.figuur) ? (
                <p className="mt-1 text-xs italic text-muted">
                  Zie figuur {figuurNr.get(q.figuur.id)} ({q.figuur.alt.toLowerCase()}, goedgekeurd na {q.figuur.pogingen}{" "}
                  keuringspoging{q.figuur.pogingen === 1 ? "" : "en"}).
                </p>
              ) : null}
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
