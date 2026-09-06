import { createFileRoute, Link } from "@tanstack/react-router";
import { FileDown, Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { KwaliteitPanel } from "@/components/toets/kwaliteit-panel";
import { MatrijsSheet } from "@/components/toets/matrijs-sheet";
import { NakijkSheet } from "@/components/toets/nakijk-sheet";
import { ToetsSheet } from "@/components/toets/toets-sheet";
import { Button } from "@/components/ui/button";
import { withDefaults } from "@/lib/toets/defaults";
import { maakVoorbeeldToets } from "@/lib/toets/sample";
import { cesuurPunten, formuleTekst } from "@/lib/toets/cijfer";
import { totaalPunten } from "@/lib/toets/rtti";
import { useToetsStore } from "@/store/toets-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/toets/$id")({ component: ToetsPage });

const TABS = [
  { id: "toets", label: "Toets" },
  { id: "nakijk", label: "Nakijkmodel" },
  { id: "matrijs", label: "Toetsmatrijs" },
  { id: "cijfer", label: "Cijfer" },
  { id: "kwaliteit", label: "Kwaliteit" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CijferPanel = lazy(() =>
  import("@/components/toets/cijfer-panel").then((m) => ({ default: m.CijferPanel })),
);

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useToetsStore.persist.onFinishHydration(() => setHydrated(true));
    if (useToetsStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

function ToetsPage() {
  const { id } = Route.useParams();
  const hydrated = useHydrated();
  const stored = useToetsStore((s) => s.toetsen.find((t) => t.id === id));
  const raw = stored ?? (id === "voorbeeld-fotosynthese" ? maakVoorbeeldToets() : undefined);
  const toets = raw ? withDefaults(raw) : undefined;
  const updateVraag = useToetsStore((s) => s.updateVraag);
  const updateNakijk = useToetsStore((s) => s.updateNakijk);
  const update = useToetsStore((s) => s.update);
  const [tab, setTab] = useState<TabId>("toets");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookupReady, setLookupReady] = useState(false);
  const ensureVoorbeeld = useToetsStore((s) => s.ensureVoorbeeld);

  useEffect(() => {
    if (id === "voorbeeld-fotosynthese" && !stored) ensureVoorbeeld();
  }, [id, stored, ensureVoorbeeld]);

  useEffect(() => {
    if (stored?.soort === "matrijs") setTab("matrijs");
  }, [id, stored?.soort]);

  // Brief grace after hydration so a just-upserted toets can appear before "niet gevonden".
  useEffect(() => {
    if (!hydrated) {
      setLookupReady(false);
      return;
    }
    if (stored || id === "voorbeeld-fotosynthese") {
      setLookupReady(true);
      return;
    }
    setLookupReady(false);
    let n = 0;
    const idTimer = window.setInterval(() => {
      n += 1;
      if (useToetsStore.getState().byId(id) || n >= 8) {
        window.clearInterval(idTimer);
        setLookupReady(true);
      }
    }, 50);
    return () => window.clearInterval(idTimer);
  }, [hydrated, id, stored]);

  const titel = toets?.meta.titel ?? "Toets";

  if (!hydrated || !lookupReady) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl px-5 py-16 text-muted">Toets laden…</main>
      </AppShell>
    );
  }

  if (!toets) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl px-5 py-16">
          <h1 className="text-2xl font-medium tracking-tight">Toets niet gevonden</h1>
          <p className="mt-3 text-sm text-muted">Hij staat niet (meer) op dit apparaat.</p>
          <Button asChild className="mt-6">
            <Link to="/">Nieuwe toets</Link>
          </Button>
        </main>
      </AppShell>
    );
  }

  const current = toets;
  const isMatrijs = toets.soort === "matrijs";
  const heeftFeedback = Boolean(toets.feedbackGewenst) || toets.kwaliteit.punten.length > 0;
  const tabs = TABS.filter((t) => {
    if (isMatrijs && (t.id === "toets" || t.id === "cijfer" || t.id === "nakijk")) return false;
    if (t.id === "nakijk" && toets.nakijkmodel.length === 0) return false;
    if (t.id === "kwaliteit" && isMatrijs && !heeftFeedback) return false;
    return true;
  });
  const visibleTab: TabId = tabs.some((t) => t.id === tab) ? tab : (tabs[0]?.id ?? "toets");

  async function saveDocx() {
    setSaving(true);
    try {
      const { downloadMatrijsDocx, downloadPakketDocx } = await import("@/lib/toets/docx-export");
      if (current.soort === "matrijs") await downloadMatrijsDocx(current);
      else await downloadPakketDocx(current);
      toast.success("Word-bestand gedownload");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell printHidden>
      <div className="print:hidden">
        <div className="mx-auto max-w-3xl px-5 pt-8 sm:px-6">
          <Link to="/" className="text-sm text-muted hover:text-fg">
            Overzicht
          </Link>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-brand">{titel}</h1>
              <p className="mt-1 text-sm text-muted">
                {isMatrijs
                  ? `Matrijs · ${toets.meta.vak} · ${toets.meta.leerweg} klas ${toets.meta.leerjaar}`
                  : `${toets.meta.vak} · ${toets.meta.leerweg} klas ${toets.meta.leerjaar} · versie ${toets.meta.versie}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isMatrijs ? null : (
                <>
                  <Button type="button" variant={editing ? "default" : "ghost"} onClick={() => setEditing((v) => !v)}>
                    {editing ? "Klaar" : "Bewerken"}
                  </Button>
                  <Button asChild variant="ghost">
                    <Link to="/feedback" search={{ id: toets.id }}>
                      Wijzigingen
                    </Link>
                  </Button>
                </>
              )}
              <Button type="button" disabled={saving} onClick={saveDocx}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                Word
              </Button>
            </div>
          </div>
          {tabs.length > 1 ? (
            <nav className="mt-6 flex gap-1 overflow-x-auto rounded-[var(--radius-lg)] bg-surface p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-[var(--radius-md)] px-3 text-sm whitespace-nowrap",
                    visibleTab === t.id ? "bg-brand font-semibold text-paper" : "text-muted hover:text-brand",
                  )}
                >
                  {t.id === "kwaliteit" && isMatrijs ? "Feedback" : t.label}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
      <div className="mx-auto max-w-[210mm] px-3 py-8 sm:px-6">
        {visibleTab === "toets" ? (
          <ToetsSheet toets={toets} editing={editing} onStam={(nummer, stam) => updateVraag(toets.id, nummer, { stam })} />
        ) : null}
        {visibleTab === "nakijk" ? (
          <NakijkSheet
            toets={toets}
            editing={editing}
            onAntwoord={(nummer, modelantwoord) => updateNakijk(toets.id, nummer, { modelantwoord })}
          />
        ) : null}
        {visibleTab === "matrijs" ? <MatrijsSheet toets={toets} /> : null}
        {visibleTab === "cijfer" ? (
          <div className="mx-auto max-w-2xl rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
            <Suspense fallback={<p className="text-sm text-muted">Cijfermodule laden…</p>}>
              <CijferPanel
                max={totaalPunten(toets.vragen)}
                norm={toets.cijferNorm}
                onChange={(norm) => {
                  const max = totaalPunten(toets.vragen);
                  update(toets.id, {
                    cijferNorm: norm,
                    cesuur: {
                      ...toets.cesuur,
                      cesuurPunten: cesuurPunten(max, norm),
                      formule: formuleTekst(norm, max),
                    },
                  });
                }}
                onExport={async () => {
                  const { downloadCijferDocx } = await import("@/lib/toets/docx-export");
                  await downloadCijferDocx(toets);
                  toast.success("Word-bestand gedownload");
                }}
              />
            </Suspense>
          </div>
        ) : null}
        {visibleTab === "kwaliteit" ? (
          <div className="mx-auto max-w-2xl rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-brand">
              {isMatrijs ? "Feedback op deze toets" : "SLO-kwaliteitscheck"}
            </h2>
            <p className="mt-3 leading-relaxed text-muted">Jouw vakoordeel gaat hier boven.</p>
            <div className="mt-6">
              <KwaliteitPanel toets={toets} />
            </div>
            {isMatrijs ? null : (
              <Button asChild className="mt-6">
                <Link to="/feedback" search={{ id: toets.id }}>
                  Wijzigingen doorgeven
                </Link>
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
