import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpDown, FileDown, Loader2, Plus, Sparkles } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { DekkingHintBanner } from "@/components/toets/dekking-hint";
import { KwaliteitPanel } from "@/components/toets/kwaliteit-panel";
import { MatrijsSheet } from "@/components/toets/matrijs-sheet";
import { NakijkSheet } from "@/components/toets/nakijk-sheet";
import { ToetsSheet } from "@/components/toets/toets-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bijschavenToets, generateExtraQuestions } from "@/lib/toets/generate";
import { withDefaults } from "@/lib/toets/defaults";
import { maakVoorbeeldToets } from "@/lib/toets/sample";
import { cesuurPunten, formuleTekst } from "@/lib/toets/cijfer";
import { totaalPunten } from "@/lib/toets/rtti";
import { isVolgordeGemengd, ordenVragenMcEerst } from "@/lib/toets/vraag-volgorde";
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
  const [retryTick, setRetryTick] = useState(0);
  useEffect(() => {
    if (!hydrated || stored || retryTick >= 12) return;
    const t = window.setTimeout(() => setRetryTick((n) => n + 1), 40);
    return () => window.clearTimeout(t);
  }, [hydrated, stored, retryTick, id]);
  const raw =
    stored ??
    (retryTick > 0 ? useToetsStore.getState().byId(id) : undefined) ??
    (id === "voorbeeld-fotosynthese" ? maakVoorbeeldToets() : undefined);
  const toets = raw ? withDefaults(raw) : undefined;
  const updateVraag = useToetsStore((s) => s.updateVraag);
  const updateNakijk = useToetsStore((s) => s.updateNakijk);
  const update = useToetsStore((s) => s.update);
  const [tab, setTab] = useState<TabId>("toets");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extraCount, setExtraCount] = useState(1);
  const [extraBusy, setExtraBusy] = useState(false);
  const [bijschavenTekst, setBijschavenTekst] = useState("");
  const [bijschavenBusy, setBijschavenBusy] = useState(false);
  const ensureVoorbeeld = useToetsStore((s) => s.ensureVoorbeeld);
  const upsert = useToetsStore((s) => s.upsert);
  const stuurdocument = useToetsStore((s) => s.stuurdocument);

  useEffect(() => {
    if (id === "voorbeeld-fotosynthese" && !stored) ensureVoorbeeld();
  }, [id, stored, ensureVoorbeeld]);

  useEffect(() => {
    if (stored?.soort === "matrijs") setTab("matrijs");
  }, [id, stored?.soort]);

  const titel = toets?.meta.titel ?? "Toets";
  const gemengdeVolgorde = useMemo(
    () => (toets && toets.soort !== "matrijs" ? isVolgordeGemengd(toets.vragen) : false),
    [toets],
  );

  if (!hydrated || (!toets && retryTick < 12)) {
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

  function applyMcEerst() {
    if (isMatrijs) return;
    const { vragen, nakijkmodel } = ordenVragenMcEerst(current.vragen, current.nakijkmodel);
    upsert({ ...current, vragen, nakijkmodel });
    toast.success("Vragen geordend: MC eerst (nakijk/matrijs bijgewerkt)");
  }

  async function runBijschaven() {
    if (isMatrijs || bijschavenBusy) return;
    const instructie = bijschavenTekst.trim();
    if (instructie.length < 3) {
      toast.error("Typ een korte instructie (bijv. «vraag 3 korter» of «punten herverdelen»).");
      return;
    }
    setBijschavenBusy(true);
    try {
      const result = await bijschavenToets({
        data: {
          instructie,
          vak: current.meta.vak,
          leerweg: current.meta.leerweg,
          leerjaar: current.meta.leerjaar,
          bronmateriaal: current.bronmateriaal,
          stuurdocument: stuurdocument.trim() || undefined,
          vragen: current.vragen,
          nakijkmodel: current.nakijkmodel,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      upsert({
        ...current,
        vragen: result.vragen,
        nakijkmodel: result.nakijkmodel,
      });
      setBijschavenTekst("");
      toast.success(result.toelichting || "Bijgeschaafd");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bijschaven mislukt");
    } finally {
      setBijschavenBusy(false);
    }
  }

  async function addExtraVragen() {
    if (isMatrijs || extraBusy) return;
    const count = Math.min(8, Math.max(1, Math.floor(extraCount) || 1));
    setExtraBusy(true);
    try {
      const startNummer =
        (current.vragen.reduce((m, q) => Math.max(m, q.nummer || 0), 0) || current.vragen.length) + 1;
      const result = await generateExtraQuestions({
        data: {
          count,
          vak: current.meta.vak,
          leerweg: current.meta.leerweg,
          leerjaar: current.meta.leerjaar,
          moeilijkheid: current.meta.moeilijkheid,
          rttiDoel: current.matrijs.doelverdeling,
          bronmateriaal: current.bronmateriaal,
          extraEisen: current.extraEisen,
          stuurdocument: stuurdocument.trim() || undefined,
          bestaandeVragen: current.vragen.map((q) => ({
            nummer: q.nummer,
            type: q.type,
            stam: q.stam,
            rtti: q.rtti,
          })),
          startNummer,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      upsert({
        ...current,
        vragen: [...current.vragen, ...result.vragen],
        nakijkmodel: [...current.nakijkmodel, ...result.nakijkmodel],
      });
      const n = result.vragen.length;
      toast.success(n === 1 ? "1 extra vraag toegevoegd" : `${n} extra vragen toegevoegd`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Extra vragen maken mislukt");
    } finally {
      setExtraBusy(false);
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
            <div className="flex flex-wrap items-end gap-2">
              {isMatrijs ? null : (
                <>
                  <Button type="button" variant={editing ? "default" : "ghost"} onClick={() => setEditing((v) => !v)}>
                    {editing ? "Klaar" : "Bewerken"}
                  </Button>
                  {gemengdeVolgorde ? (
                    <Button type="button" variant="secondary" onClick={applyMcEerst}>
                      <ArrowUpDown className="size-4" />
                      MC eerst
                    </Button>
                  ) : null}
                  <Button asChild variant="ghost">
                    <Link to="/feedback" search={{ id: toets.id }}>
                      Wijzigingen
                    </Link>
                  </Button>
                  <div className="flex items-end gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor="extra-vragen-count" className="text-xs text-muted">
                        Aantal
                      </Label>
                      <Input
                        id="extra-vragen-count"
                        type="number"
                        min={1}
                        max={8}
                        value={extraCount}
                        disabled={extraBusy}
                        onChange={(e) =>
                          setExtraCount(Math.min(8, Math.max(1, Number(e.target.value) || 1)))
                        }
                        className="h-11 w-16 px-2 text-center"
                      />
                    </div>
                    <Button type="button" variant="secondary" disabled={extraBusy} onClick={addExtraVragen}>
                      {extraBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      Extra vraag(en)
                    </Button>
                  </div>
                </>
              )}
              <Button type="button" disabled={saving} onClick={saveDocx}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                Word
              </Button>
            </div>
          </div>
          {isMatrijs ? null : (
            <div className="mt-4 grid gap-2 rounded-[var(--radius-lg)] bg-surface p-4">
              <Label htmlFor="bijschaven" className="text-sm font-semibold text-brand">
                Bijschaven
              </Label>
              <p className="text-xs text-muted">
                Korte instructie → gerichte AI-fix (volgorde, punten, één vraag). Geen volledige regeneratie.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Textarea
                  id="bijschaven"
                  value={bijschavenTekst}
                  onChange={(e) => setBijschavenTekst(e.target.value)}
                  placeholder="Bijv. vraag 4 herschrijven met andere context · MC eerst · vraag 2 naar 2 punten"
                  className="min-h-16 flex-1 bg-paper"
                  disabled={bijschavenBusy}
                />
                <Button
                  type="button"
                  disabled={bijschavenBusy}
                  onClick={() => void runBijschaven()}
                  className="shrink-0"
                >
                  {bijschavenBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Bijschaven
                </Button>
              </div>
            </div>
          )}
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
          <>
            <ToetsSheet toets={toets} editing={editing} onStam={(nummer, stam) => updateVraag(toets.id, nummer, { stam })} />
            {isMatrijs ? null : <DekkingHintBanner toets={toets} />}
          </>
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
