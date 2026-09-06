import { RTTI_META, RTTI_ORDER } from "@/lib/toets/constants";
import { totaalPunten } from "@/lib/toets/rtti";
import type { GegenereerdeToets } from "@/lib/toets/types";

export function MatrijsSheet({ toets }: { toets: GegenereerdeToets }) {
  const { matrijs } = toets;
  const max = totaalPunten(toets.vragen);
  return (
    <article className="rounded-[var(--radius-xl)] bg-paper p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-brand">Toetsmatrijs · {toets.meta.titel}</h2>
      <p className="mt-2 text-sm text-muted">
        RTTI · {toets.meta.leerweg} klas {toets.meta.leerjaar} · {max} punten
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-2 font-semibold text-brand">Domein</th>
              {RTTI_ORDER.map((k) => (
                <th key={k} className="px-2 py-2 font-semibold text-brand">
                  {RTTI_META[k].kort}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrijs.domeinen.map((d) => (
              <tr key={d} className="border-b border-border">
                <td className="py-2 pr-2 font-medium">{d}</td>
                {RTTI_ORDER.map((k) => {
                  const cel = matrijs.cellen[d]?.[k];
                  return (
                    <td key={k} className="px-2 py-2 tabular-nums">
                      {cel && cel.punten > 0
                        ? `v${cel.vraagnummers.join(", v")} (${cel.punten}p)`
                        : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="py-2 pr-2 font-semibold">Totaal</td>
              {RTTI_ORDER.map((k) => (
                <td key={k} className="px-2 py-2 font-semibold tabular-nums">
                  {matrijs.totalen[k].punten}p · {matrijs.totalen[k].percentage}%
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <ul className="mt-6 grid gap-2 text-sm">
        {toets.vragen.map((q) => (
          <li key={q.nummer}>
            v{q.nummer} · {q.leerdoel || q.stam.slice(0, 80)} ({q.punten}p · {RTTI_META[q.rtti].naam})
          </li>
        ))}
      </ul>
    </article>
  );
}
