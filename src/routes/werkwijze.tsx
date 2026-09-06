import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppShell, Page, PageIntro } from "@/components/layout/app-shell";
import { RTTI_META, RTTI_ORDER, RTTI_PRESETS } from "@/lib/toets/constants";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/werkwijze")({ component: Werkwijze });

const STAPPEN = [
  {
    n: "01",
    t: "Lesstof wordt toets",
    d: "Plak alleen de lesstof → check de bevestigingsregel → Toets maken. Daar ontstaat het leerlingblad, het nakijkmodel, de toetsmatrijs en de cijferomzetting.",
  },
  {
    n: "02",
    t: "Kaders",
    d: "Wil je sturen: vakprofiel (Generiek of NaSk), niveau BB / KB / GT (HGL volgt GT), leerjaar, versie A/B, moeilijkheid, RTTI-balk en cijfernorm. Standaard is KB klas 2, versie A, normaal, lineair 1,0–10,0.",
  },
  {
    n: "03",
    t: "Word-pakket",
    d: "Na Toets maken downloadt het Word-pakket vanzelf. Tik Word als de download wordt geblokkeerd. Jij blijft eigenaar: niets gaat automatisch het PTA in.",
  },
  {
    n: "04",
    t: "Matrijsmaker",
    d: "Toets al klaar? Lever het bestand in, zet vak, leerjaar en doel-RTTI. Alleen de RTTI-matrijs als Word. Feedback is optioneel.",
  },
];

function Werkwijze() {
  return (
    <AppShell>
      <Page>
        <PageIntro title="Werkwijze">
          Constructiehulp voor Aeres VMBO Leeuwarden. In 30 seconden: plak
          lesstof → check de bevestigingsregel → Toets maken → Word-pakket
          (leerlingblad + nakijkmodel + matrijs + cijfer). Jij stelt inhoud en
          cesuur vast.
        </PageIntro>

        <ol className="grid gap-4">
          {STAPPEN.map((s) => (
            <li
              key={s.n}
              className="rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8"
            >
              <span className="text-sm font-semibold tabular-nums text-muted">
                {s.n}
              </span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-brand">
                {s.t}
              </h2>
              <p className="mt-3 leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>

        <section className="mt-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-brand">RTTI</h2>
          <p className="mt-3 leading-relaxed text-muted">
            Codering van Docentplus. Eén balk van 100%: R, T1, T2 en I. Kies
            makkelijk, normaal of moeilijk — of sleep de schotten zelf. De
            matrijs telt punten, niet het aantal vragen.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {RTTI_ORDER.map((k) => (
              <li key={k} className="rounded-[var(--radius-md)] bg-paper p-4">
                <p className="font-semibold text-brand">
                  {RTTI_META[k].kort} · {RTTI_META[k].naam}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {RTTI_META[k].uitleg}
                </p>
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
          <h2 className="text-2xl font-bold tracking-tight text-brand">Cijfernorm</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted">
            <li>
              Lineair: elk punt telt even zwaar. Cijfer = 1 + 9 × (score/max).
              Een 5,5 ligt altijd op 50%.
            </li>
            <li>
              Gebroken grafiek: knik bij de 5,5. Schuif het knikpunt naar
              beneden (voldoende makkelijker) of omhoog (moeilijker).
            </li>
            <li>
              Exponentieel: cijfer = 1 + 9 × (score/max)^k. k kleiner dan 1
              maakt middelste scores hoger; k groter dan 1 maakt ze lager.
            </li>
            <li>
              Moeilijkheid van de toets (vragen) en van de cesuur (cijfer) zijn
              twee verschillende knoppen.
            </li>
          </ul>
        </section>

        <section className="mt-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-brand">SLO en Cito</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted">
            <li>Validiteit: vragen dekken de ingevoerde leerdoelen.</li>
            <li>
              Betrouwbaarheid: nakijkmodel met verdeelsleutel, zodat twee
              collega’s tot dezelfde score komen.
            </li>
            <li>
              Transparantie: punten per vraag, instructie, en een cijfernorm.
            </li>
            <li>Taal: afgestemd op leerweg — BB korter en concreter dan GT.</li>
            <li>Opmaak: Cito-conventie (schreefloos, nummering, punten, A–D).</li>
          </ul>
        </section>

        <section className="mt-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-brand">
            Delen met collega’s
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            Deel de link van de app, niet je Grok-account. Opgeslagen werk
            blijft op het eigen apparaat. AI-gebruik gaat van de eigenaar van
            deze app.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/">
                Naar de maker
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/matrijsmaker">Matrijsmaker</Link>
            </Button>
          </div>
        </section>
      </Page>
    </AppShell>
  );
}
