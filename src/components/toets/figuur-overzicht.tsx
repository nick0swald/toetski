import type { FiguurRapportItem, GegenereerdeToets } from "@/lib/toets/types";

const SOORT: Record<string, string> = {
  lijngrafiek: "lijngrafiek",
  staafdiagram: "staafdiagram",
  spreidingsdiagram: "spreidingsdiagram",
  stroomkring: "schakeling",
  katrol: "katrol",
  hefboom: "hefboom",
  krachtenschema: "krachten",
  blokschema: "blokschema",
  oscilloscoop: "oscilloscoopbeeld",
  maatcilinder: "maatcilinder",
  pictogram: "pictogram",
  sfeerplaat: "sfeerplaat",
};

const FALLBACK: Record<NonNullable<FiguurRapportItem["fallback"]>, string> = {
  herschreven: "vraag herschreven zonder figuur",
  vervangen: "vraag vervangen",
  tabel: "gegevens als tabel",
  tekst: "gegevens in de tekst",
  "geen-figuur": "vraag zonder figuur",
  verwijderd: "verwijzing uit de vraag gehaald",
};

function status(i: FiguurRapportItem): { label: string; cls: string } {
  if (i.docentVerwijderd) return { label: "Verwijderd door jou", cls: "bg-paper text-muted" };
  if (i.status === "go") return { label: i.uitBank ? "Goedgekeurd · uit figuurbank" : "Goedgekeurd", cls: "bg-primary/20 text-brand" };
  return { label: "Afgekeurd", cls: "bg-warn/15 text-warn" };
}

/** Overzicht per figuur: goedgekeurd of afgekeurd, met reden. Alleen op het scherm (niet in de print). */
export function FiguurOverzicht({ toets }: { toets: GegenereerdeToets }) {
  const r = toets.figuurRapport;
  if (!toets.figuurPijplijn || !r) return null;
  // Laatste uitkomst per vraag+soort (extra rondes kunnen een eerdere poging opvolgen).
  const items = r.items.filter((i, idx) => !r.items.slice(idx + 1).some((j) => j.nummer === i.nummer && j.soort === i.soort && j.status === "go" && i.status !== "go"));
  const t = r.tijden;
  return (
    <details className="group mt-6 rounded-[var(--radius-xl)] bg-surface p-5 print:hidden sm:p-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-brand [&::-webkit-details-marker]:hidden">
        <span>
          Figuren · {items.filter((i) => i.status === "go" && !i.docentVerwijderd).length} goedgekeurd
          {items.some((i) => i.status !== "go") ? ` · ${items.filter((i) => i.status !== "go").length} afgekeurd` : ""}
        </span>
        <span className="text-xs font-normal text-muted group-open:hidden">tonen</span>
      </summary>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{r.zonderPlaatjes ? "Zonder plaatjes gemaakt." : "Geen figuren nodig in deze toets."}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {items.map((i, idx) => {
            const s = status(i);
            return (
              <li key={`${i.nummer}-${i.soort}-${idx}`} className="rounded-[var(--radius-md)] bg-paper p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-brand">Vraag {i.nummer}</span>
                  <span className="text-muted">{SOORT[i.soort] ?? i.soort}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
                  {i.pogingen > 1 ? <span className="text-xs text-muted">{i.pogingen} pogingen</span> : null}
                </div>
                {i.status !== "go" && i.redenen.length ? (
                  <p className="mt-1 text-xs text-muted">Reden: {i.redenen.slice(0, 2).join(" · ")}</p>
                ) : null}
                {i.fallback && (i.status !== "go" || i.docentVerwijderd) ? (
                  <p className="mt-1 text-xs text-muted">Gevolg: {FALLBACK[i.fallback]}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {r.meldingen.length ? (
        <ul className="mt-3 list-disc pl-5 text-xs text-muted">
          {r.meldingen.slice(0, 6).map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
      {t?.totaalMs ? (
        <p className="mt-3 text-xs text-muted tabular-nums">
          Tijd: {Math.round(t.totaalMs / 1000)} s (vragen {Math.round((t.vragenMs ?? 0) / 1000)} s
          {t.figurenMs != null ? `, figuren ${Math.round(t.figurenMs / 1000)} s` : ""})
        </p>
      ) : null}
    </details>
  );
}
