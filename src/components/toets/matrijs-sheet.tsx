import { LeafMark } from "@/components/brand/mark";
import { RttiBars } from "@/components/toets/rtti-bars";
import { RTTI_META, RTTI_ORDER, SCHOOL } from "@/lib/toets/constants";
import { totaalPunten } from "@/lib/toets/rtti";
import type { GegenereerdeToets, Rtti, RttiVerdeling } from "@/lib/toets/types";

export function MatrijsSheet({ toets }: { toets: GegenereerdeToets }) {
  const { matrijs } = toets;
  const max = totaalPunten(toets.vragen);
  const actual: RttiVerdeling = {
    R: matrijs.totalen.R.percentage,
    T1: matrijs.totalen.T1.percentage,
    T2: matrijs.totalen.T2.percentage,
    I: matrijs.totalen.I.percentage,
  };

  return (
    <article className="cito-doc mx-auto w-full max-w-[210mm] bg-paper px-6 py-8 text-ink shadow-[var(--shadow-sheet)] sm:px-10 sm:py-10 print:max-w-none print:px-0 print:py-0 print:shadow-none">
      <header className="border-b-2 border-primary pb-4">
        <div className="flex items-center gap-2 text-brand">
          <LeafMark className="size-7" />
          <div>
            <p className="font-display text-lg leading-tight">{SCHOOL}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
              Toetsmatrijs · RTTI
            </p>
          </div>
        </div>
        <h1 className="mt-4 font-display text-2xl tracking-tight">
          {toets.meta.titel}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {toets.meta.vak} · {toets.meta.leerweg} klas {toets.meta.leerjaar} · {max} punten
        </p>
      </header>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Puntenverdeling versus doel
        </h2>
        <div className="mt-4">
          <RttiBars actual={actual} doel={matrijs.doelverdeling} />
        </div>
      </section>

      <section className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-primary text-left">
              <th className="py-2 pr-3 font-semibold">Domein / leerdoelcluster</th>
              {RTTI_ORDER.map((k) => (
                <th key={k} className="px-2 py-2 font-semibold">
                  {RTTI_META[k].kort}
                </th>
              ))}
              <th className="px-2 py-2 font-semibold">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {matrijs.domeinen.map((d) => {
              const row = matrijs.cellen[d];
              const rowTotal = RTTI_ORDER.reduce(
                (s, k) => s + (row?.[k]?.punten ?? 0),
                0,
              );
              return (
                <tr key={d} className="border-b border-border align-top">
                  <td className="py-2.5 pr-3 font-medium">{d}</td>
                  {RTTI_ORDER.map((k: Rtti) => {
                    const cel = row?.[k];
                    return (
                      <td key={k} className="px-2 py-2.5 tabular-nums">
                        {cel && cel.punten > 0 ? (
                          <span>
                            <span className="text-muted">
                              {cel.vraagnummers.map((n) => `v${n}`).join(" ")}
                            </span>
                            <span className="mt-0.5 block font-medium">
                              {cel.punten}p
                            </span>
                          </span>
                        ) : (
                          <span className="text-border">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2.5 tabular-nums font-medium">{rowTotal}p</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary font-semibold">
              <td className="py-2.5 pr-3">Totaal</td>
              {RTTI_ORDER.map((k) => (
                <td key={k} className="px-2 py-2.5 tabular-nums">
                  {matrijs.totalen[k].punten}p
                  <span className="ml-1 font-normal text-muted">
                    {matrijs.totalen[k].percentage}%
                  </span>
                </td>
              ))}
              <td className="px-2 py-2.5 tabular-nums">{max}p</td>
            </tr>
            <tr className="text-muted">
              <td className="py-2 pr-3 font-medium">Doel</td>
              {RTTI_ORDER.map((k) => (
                <td key={k} className="px-2 py-2 tabular-nums">
                  {matrijs.doelverdeling[k]}%
                </td>
              ))}
              <td className="px-2 py-2">100%</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Vragen per leerdoel
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {toets.vragen.map((q) => (
            <li key={q.nummer} className="flex gap-3">
              <span className="w-8 shrink-0 tabular-nums text-muted">v{q.nummer}</span>
              <span>
                <span className="font-medium">{q.leerdoel}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {q.domein} · {q.punten}p · {RTTI_META[q.rtti].naam}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
