import { LeafMark } from "@/components/brand/mark";
import { BronGrafiek, BronTabel } from "@/components/toets/bron-figuur";
import { RttiBadge } from "@/components/toets/rtti-badge";
import { SCHOOL } from "@/lib/toets/constants";
import { totaalPunten } from "@/lib/toets/rtti";
import type { GegenereerdeToets } from "@/lib/toets/types";
import { cn } from "@/lib/utils";

function Field({ label }: { label: string }) {
  return (
    <div className="flex min-h-8 items-end gap-2 border-b border-dotted border-ink/30 pb-0.5">
      <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="flex-1" />
    </div>
  );
}

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
    <article className="cito-doc mx-auto w-full max-w-[210mm] bg-paper px-6 py-8 text-ink shadow-[var(--shadow-sheet)] sm:px-10 sm:py-10 print:max-w-none print:px-0 print:py-0 print:shadow-none">
      <header className="border-b-2 border-primary pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-brand">
            <LeafMark className="size-7" />
            <div>
              <p className="font-display text-lg leading-tight tracking-tight">
                {SCHOOL}
              </p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                Schooltoets
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-muted">
            <p>
              {m.vak} · {m.leerweg} · versie {m.versie}
            </p>
            <p>
              klas {m.leerjaar} · {m.moeilijkheid}
            </p>
          </div>
        </div>
        <h1 className="mt-4 font-display text-2xl tracking-tight text-balance">
          {m.titel}
        </h1>
        {m.onderwerp && m.onderwerp !== m.titel ? (
          <p className="mt-1 text-sm text-muted">{m.onderwerp}</p>
        ) : null}
        <p className="mt-3 text-sm">
          Tijd: {m.duurMinuten} minuten
          <span className="mx-2 text-border">·</span>
          Maximumscore: {max} punten
          <span className="mx-2 text-border">·</span>
          {toets.vragen.length} vragen
        </p>
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="Naam" />
        <Field label="Klas" />
        <Field label="Datum" />
        <Field label="Docent" />
      </div>

      {m.hulpmiddelen.length > 0 ? (
        <p className="mt-5 text-sm">
          <span className="font-semibold">Hulpmiddelen: </span>
          {m.hulpmiddelen.join(" · ")}
        </p>
      ) : null}

      {m.instructies.length > 0 ? (
        <section className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Instructie
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-snug">
            {m.instructies.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <ol className="mt-8 space-y-8">
        {toets.vragen.map((q) => (
          <li key={q.nummer} className="break-inside-avoid">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">
                {q.nummer}{" "}
                <span className="font-normal text-muted">({q.punten}p)</span>
              </h3>
              {editing ? (
                <span className="print:hidden">
                  <RttiBadge rtti={q.rtti} />
                </span>
              ) : null}
            </div>
            {q.context ? (
              <div className="mt-2 rounded-[var(--radius-sm)] border border-border bg-bg/60 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                {q.context}
              </div>
            ) : null}
            {editing && onStam ? (
              <textarea
                value={q.stam}
                onChange={(e) => onStam(q.nummer, e.target.value)}
                className="mt-2 min-h-24 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm leading-relaxed"
              />
            ) : (
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{q.stam}</p>
            )}
            {q.tabel ? <BronTabel tabel={q.tabel} /> : null}
            {q.grafiek ? <BronGrafiek grafiek={q.grafiek} /> : null}
            {q.opties?.length ? (
              <ul className="mt-3 space-y-1.5">
                {q.opties.map((o) => (
                  <li key={o.letter} className="flex gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-ink/30 text-xs font-medium">
                      {o.letter}
                    </span>
                    <span className="pt-0.5">{o.tekst}</span>
                  </li>
                ))}
              </ul>
            ) : q.type !== "meerkeuze" ? (
              <div
                className={cn(
                  "mt-3 border-t border-dotted border-ink/25",
                  q.punten >= 3 ? "h-24" : "h-14",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        ))}
      </ol>

      <footer className="mt-10 border-t border-border pt-3 text-[11px] text-muted print:mt-6">
        {SCHOOL} · niet verspreiden buiten de afname · blad 1/{Math.max(1, Math.ceil(toets.vragen.length / 6))}
      </footer>
    </article>
  );
}
