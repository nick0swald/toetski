import { BronTabel, GoedgekeurdeFiguurBeeld, StimulusFiguren } from "@/components/toets/bron-figuur";
import { blokkenVoorVraag } from "@/lib/toets/blad-volgorde";
import type { GegenereerdeToets } from "@/lib/toets/types";
import { totaalPunten } from "@/lib/toets/rtti";

export function ToetsSheet({
  toets,
  editing,
  onStam,
  onVerwijderFiguur,
}: {
  toets: GegenereerdeToets;
  editing?: boolean;
  onStam?: (nummer: number, stam: string) => void;
  /** Alleen verwijderen (nooit wijzigen) van de figuur bij één vraag. */
  onVerwijderFiguur?: (nummer: number) => void;
}) {
  const m = toets.meta;
  const max = totaalPunten(toets.vragen);
  const pijplijn = Boolean(toets.figuurPijplijn);
  const figuurNr = new Map<string, number>();
  for (const q of toets.vragen) if (q.figuur && blokkenVoorVraag(q).includes("figuur")) figuurNr.set(q.figuur.id, figuurNr.size + 1);
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
        {toets.vragen.map((q) => {
          const blokken = blokkenVoorVraag(q, { pijplijn });
          return (
          <li key={q.nummer}>
            {blokken.includes("context") && q.context ? (
              <p className="text-sm italic text-muted">{q.context}</p>
            ) : null}
            {blokken.includes("stimulus") ? (
              <StimulusFiguren
                grafiek={q.grafiek}
                schemaFiguur={q.schemaFiguur}
                pictogram={q.pictogram}
                maatcilinder={q.maatcilinder}
              />
            ) : null}
            <h3 className="mt-2 text-base font-bold text-brand">
              {q.punten}p {q.nummer}
            </h3>
            {editing ? (
              <textarea
                className="mt-2 w-full min-h-24 rounded-[var(--radius-md)] bg-surface/50 p-3 text-sm"
                value={q.stam}
                onChange={(e) => onStam?.(q.nummer, e.target.value)}
              />
            ) : (
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{q.stam}</p>
            )}
            {blokken.includes("figuur") && q.figuur ? (
              <div>
                <GoedgekeurdeFiguurBeeld figuur={q.figuur} nummer={figuurNr.get(q.figuur.id)} />
                {editing && onVerwijderFiguur ? (
                  <button
                    type="button"
                    className="mt-2 min-h-9 rounded-[var(--radius-md)] border border-warn/40 px-3 text-xs font-semibold text-warn hover:bg-warn/10 print:hidden"
                    onClick={() => {
                      if (window.confirm(`Figuur bij vraag ${q.nummer} verwijderen? De figuur zelf wordt niet aangepast; verwijst de vraag ernaar, dan krijgt de vraag de gegevens als tabel of tekst.`)) {
                        onVerwijderFiguur(q.nummer);
                      }
                    }}
                  >
                    Figuur verwijderen
                  </button>
                ) : null}
              </div>
            ) : null}
            {blokken.includes("tabel") && q.tabel ? <BronTabel tabel={q.tabel} /> : null}
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
          );
        })}
      </ol>
    </article>
  );
}
