import { LeafMark } from "@/components/brand/mark";
import { RttiBadge } from "@/components/toets/rtti-badge";
import { SCHOOL } from "@/lib/toets/constants";
import { cesuurZin, cijferVanScore, formuleTekst } from "@/lib/toets/cijfer";
import { totaalPunten } from "@/lib/toets/rtti";
import type { GegenereerdeToets } from "@/lib/toets/types";
import { withDefaults } from "@/lib/toets/defaults";

export function NakijkSheet({
  toets,
  editing,
  onAntwoord,
}: {
  toets: GegenereerdeToets;
  editing?: boolean;
  onAntwoord?: (nummer: number, modelantwoord: string) => void;
}) {
  const t = withDefaults(toets);
  const max = totaalPunten(t.vragen);
  const scores = [0, 0.4, 0.55, 0.7, 0.85, 1].map((f) => {
    const p = Math.round(f * max);
    return { p, cijfer: cijferVanScore(p, max, t.cijferNorm) };
  });

  return (
    <article className="cito-doc mx-auto w-full max-w-[210mm] bg-paper px-6 py-8 text-ink shadow-[var(--shadow-sheet)] sm:px-10 sm:py-10 print:max-w-none print:px-0 print:py-0 print:shadow-none">
      <header className="border-b-2 border-primary pb-4">
        <div className="flex items-center gap-2 text-brand">
          <LeafMark className="size-7" />
          <div>
            <p className="font-display text-lg leading-tight">{SCHOOL}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
              Correctievoorschrift · niet voor leerlingen
            </p>
          </div>
        </div>
        <h1 className="mt-4 font-display text-2xl tracking-tight">
          Nakijkmodel · {t.meta.titel}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t.meta.vak} · {t.meta.leerweg} klas {t.meta.leerjaar} · versie {t.meta.versie} · max {max} punten
        </p>
      </header>

      <section className="mt-5 rounded-[var(--radius-md)] border border-border bg-bg/50 px-4 py-3 text-sm">
        <p className="font-medium">{formuleTekst(t.cijferNorm, max)}</p>
        <p className="mt-2 font-medium">{cesuurZin(max, t.cijferNorm)}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted">
          {scores.map((s) => (
            <span key={s.p}>
              {s.p}p → {s.cijfer.toFixed(1)}
            </span>
          ))}
        </div>
      </section>

      <ol className="mt-8 space-y-7">
        {t.nakijkmodel.map((n) => {
          const q = t.vragen.find((v) => v.nummer === n.nummer);
          return (
            <li key={n.nummer} className="break-inside-avoid">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">
                  Vraag {n.nummer}{" "}
                  <span className="font-normal text-muted">({q?.punten ?? "?"}p)</span>
                </h3>
                {q ? <RttiBadge rtti={q.rtti} /> : null}
                {q ? (
                  <span className="text-xs text-muted">{q.domein}</span>
                ) : null}
              </div>
              {editing && onAntwoord ? (
                <textarea
                  value={n.modelantwoord}
                  onChange={(e) => onAntwoord(n.nummer, e.target.value)}
                  className="mt-2 min-h-20 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm"
                />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {n.modelantwoord}
                </p>
              )}
              <ul className="mt-2 space-y-1 text-sm">
                {n.puntenverdeling.map((p, i) => (
                  <li key={`${n.nummer}-${i}`} className="flex gap-2">
                    <span className="w-8 shrink-0 tabular-nums font-medium text-brand">
                      {p.punt}p
                    </span>
                    <span>{p.criterium}</span>
                  </li>
                ))}
              </ul>
              {n.nietToekennen?.length ? (
                <p className="mt-2 text-sm text-muted">
                  <span className="font-medium text-fg">Niet toekennen: </span>
                  {n.nietToekennen.join(" · ")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
