import { VraagFiguren } from "@/components/toets/bron-figuur";
import type { GegenereerdeToets } from "@/lib/toets/types";
import { totaalPunten } from "@/lib/toets/rtti";

export function ToetsSheet({
  toets,
  editing,
  onStam,
}: {
  toets: GegenereerdeToets;
  editing?: boolean;
  onStam?: (nummer: number, stam: string) => void;
}) {
  const m = toets.meta;
  const max = totaalPunten(toets.vragen);
  return (
    <article className="rounded-[var(--radius-xl)] bg-paper p-6 shadow-[var(--shadow-sheet)] sm:p-10">
      <p className="text-sm font-semibold text-brand">{m.school}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand">{m.titel}</h1>
      <p className="mt-2 text-sm text-muted">
        {m.vak} · {m.leerweg} klas {m.leerjaar} · versie {m.versie} · {m.duurMinuten} min · {max}{" "}
        punten
      </p>
      <p className="mt-4 text-sm">
        Naam: ________________________ · Klas: ________ · Datum: ________
      </p>
      <h2 className="mt-8 text-lg font-bold text-brand">INSTRUCTIE</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {(m.instructies.length
          ? m.instructies
          : [`Deze toets heeft ${toets.vragen.length} vragen.`]
        ).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {m.hulpmiddelen.length ? (
        <p className="mt-3 text-sm italic text-muted">
          Hulpmiddelen: {m.hulpmiddelen.join(" · ")}
        </p>
      ) : null}
      <ol className="mt-8 grid gap-8">
        {toets.vragen.map((q) => (
          <li key={q.nummer}>
            <h3 className="text-base font-bold text-brand">
              {q.nummer} ({q.punten}p)
            </h3>
            {/* Schoolvolgorde: context → figuur → stam */}
            {q.context ? <p className="mt-2 text-sm italic text-muted">{q.context}</p> : null}
            <VraagFiguren tabel={q.tabel} grafiek={q.grafiek} schemaFiguur={q.schemaFiguur} />
            {editing ? (
              <textarea
                className="mt-2 w-full min-h-24 rounded-[var(--radius-md)] bg-surface/50 p-3 text-sm"
                value={q.stam}
                onChange={(e) => onStam?.(q.nummer, e.target.value)}
              />
            ) : (
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{q.stam}</p>
            )}
            {q.opties?.length ? (
              <ul className="mt-3 grid gap-1">
                {q.opties.map((o) => (
                  <li key={o.letter} className="text-sm">
                    {o.letter}. {o.tekst}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </article>
  );
}
