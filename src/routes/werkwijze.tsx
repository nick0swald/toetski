import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppShell, Page, PageIntro } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { RTTI_META, RTTI_ORDER, RTTI_PRESETS } from "@/lib/toets/constants";

export const Route = createFileRoute("/werkwijze")({ component: Werkwijze });

const STAPPEN = [
  {
    n: "01",
    t: "Drop de lesstof",
    d: "Leerlingboek, antwoordenboek, notities of een link. Ook een scan. Check de bevestigingsregel en tik Toets maken.",
  },
  {
    n: "02",
    t: "Word-pakket",
    d: "Leerlingblad, nakijkmodel, matrijs en cijfer downloaden vanzelf. Tik Word als de download wordt geblokkeerd.",
  },
  {
    n: "03",
    t: "Jij blijft eigenaar",
    d: "Kijk inhoud en cesuur na voordat leerlingen de toets maken. Niets gaat automatisch het PTA in.",
  },
];

function Werkwijze() {
  return (
    <AppShell>
      <Page>
        <PageIntro title="Werkwijze">
          Plak of drop lesstof → Toets maken → Word-pakket. Jij controleert inhoud en cesuur.
        </PageIntro>
        <ol className="grid gap-4">
          {STAPPEN.map((s) => (
            <li key={s.n} className="rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
              <span className="text-sm font-semibold tabular-nums text-muted">{s.n}</span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-brand">{s.t}</h2>
              <p className="mt-3 leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
        <section className="mt-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-brand">RTTI</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {RTTI_ORDER.map((k) => (
              <li key={k} className="rounded-[var(--radius-md)] bg-paper p-4">
                <p className="font-semibold text-brand">
                  {RTTI_META[k].kort} · {RTTI_META[k].naam}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{RTTI_META[k].uitleg}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 overflow-x-auto rounded-[var(--radius-md)] bg-paper p-4">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-semibold text-brand">Preset</th>
                  <th className="px-2 py-2 font-semibold text-brand">R</th>
                  <th className="px-2 py-2 font-semibold text-brand">T1</th>
                  <th className="px-2 py-2 font-semibold text-brand">T2</th>
                  <th className="px-2 py-2 font-semibold text-brand">I</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(RTTI_PRESETS).map((p) => (
                  <tr key={p.label} className="border-b border-border last:border-b-0">
                    <td className="py-2 pr-3">{p.label}</td>
                    <td className="px-2 py-2 tabular-nums">{p.verdeling.R}%</td>
                    <td className="px-2 py-2 tabular-nums">{p.verdeling.T1}%</td>
                    <td className="px-2 py-2 tabular-nums">{p.verdeling.T2}%</td>
                    <td className="px-2 py-2 tabular-nums">{p.verdeling.I}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="mt-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
          <Button asChild>
            <Link to="/">
              Naar de maker
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>
      </Page>
    </AppShell>
  );
}
