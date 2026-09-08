import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileUp, Loader2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RTTI_PRESETS } from "@/lib/toets/constants";
import { generateMatrijs } from "@/lib/toets/generate";
import { BRON_ACCEPT, bestandTeGroot, leesBronBestand } from "@/lib/toets/lees-bron";
import { VOORBEELD_TOETS_TEKST } from "@/lib/toets/sample";
import { persistToetsBeforeNavigate } from "@/store/toets-store";
import { PageIntro } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";

export function MatrijsForm() {
  const navigate = useNavigate();
  /** Ingelezen / geplakte toets — niet in het notitieveld. */
  const [toetsTekst, setToetsTekst] = useState("");
  const [bronLabel, setBronLabel] = useState<string | null>(null);
  /** Alleen docentnotities / sturing. */
  const [notities, setNotities] = useState("");
  const [feedback, setFeedback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stap, setStap] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stappen = feedback
    ? ["Toets lezen", "Vragen en RTTI toewijzen", "Toetsmatrijs", "Feedback", "Word-bestand"]
    : ["Toets lezen", "Vragen en RTTI toewijzen", "Toetsmatrijs", "Word-bestand"];
  const canSubmit = toetsTekst.trim().length > 0 && !busy;

  function zetToets(tekst: string, label: string) {
    setToetsTekst(tekst);
    setBronLabel(label);
  }

  function wisToets() {
    setToetsTekst("");
    setBronLabel(null);
  }

  async function onFile(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (bestandTeGroot(file)) {
      toast.error("Bestand is te groot (max. 50 MB).");
      return;
    }
    try {
      const result = await leesBronBestand(file, undefined, (v) => {
        if (v.fase === "ocr" && v.pagina > 0) {
          toast.message(`Scan lezen · pagina ${v.pagina} van ${v.totaal}`);
        }
      });
      if (!result.text) {
        toast.error("Geen tekst in dit bestand.");
        return;
      }
      zetToets(result.text, file.name);
      toast.success(
        `Ingelezen: ${file.name}${result.paginaAantal ? ` · ${result.paginaAantal} pagina’s` : ""}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dit bestand kon niet worden gelezen.");
    }
  }

  /** Lange plak = toetsbron; korte tekst blijft notitie. */
  function verwerkPlak(tekst: string): boolean {
    const t = tekst.trim();
    if (!t) return false;
    const regels = t.split(/\n/).filter((r) => r.trim()).length;
    const lijktToets = t.length >= 400 || regels >= 8;
    if (!lijktToets) return false;
    zetToets(t, "geplakte toets");
    toast.success("Toets als bron gezet (notitieveld blijft leeg).");
    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setStap(0);
    const timer = window.setInterval(() => setStap((s) => (s < stappen.length - 1 ? s + 1 : s)), 1800);
    try {
      const result = await generateMatrijs({
        data: {
          leerweg: "KB",
          leerjaar: 2,
          rttiDoel: RTTI_PRESETS.onderbouw.verdeling,
          bronmateriaal: toetsTekst,
          extraEisen: notities.trim() || undefined,
          feedbackGewenst: feedback,
        },
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      const toetsId = await persistToetsBeforeNavigate(result.toets);
      try {
        const { downloadMatrijsDocx } = await import("@/lib/toets/docx-export");
        await downloadMatrijsDocx(result.toets);
        toast.success("Word-bestand gedownload.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Download geblokkeerd. Tik Word op de matrijs.");
      }
      navigate({ to: "/toets/$id", params: { id: toetsId } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Het maken van de matrijs is mislukt.";
      setError(msg);
      toast.error(msg);
    } finally {
      window.clearInterval(timer);
      setBusy(false);
    }
  }

  return (
    <>
    <PageIntro title="Matrijsmaker" className="mb-6">
      Lever een bestaande toets in. Notities komen in het veld.
    </PageIntro>
    <form onSubmit={onSubmit} className="grid min-w-0 gap-5">
      <div className="grid min-w-0 gap-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
        <div>
          <Label htmlFor="matrijs-notities">Notities / sturing</Label>
          <p className="mt-1 text-sm text-muted">Optioneel. De toets zelf komt via bestand of plakken — niet in dit veld.</p>
        </div>
        <Textarea
          id="matrijs-notities"
          value={notities}
          onChange={(e) => setNotities(e.target.value)}
          onPaste={(e) => {
            const files = [...e.clipboardData.files];
            if (files.length) {
              e.preventDefault();
              void onFile(e.clipboardData.files);
              return;
            }
            const text = e.clipboardData.getData("text/plain");
            if (verwerkPlak(text)) e.preventDefault();
          }}
          placeholder="Optioneel: notities voor de AI, bijv. ‘tel bronvragen mee als T2’."
          className="min-h-28 bg-paper"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label
            htmlFor="toets-bestand"
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-paper px-4 text-sm font-semibold text-brand hover:opacity-90"
          >
            <FileUp className="size-4 shrink-0" />
            Bestand
            <input
              id="toets-bestand"
              type="file"
              accept={BRON_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                void onFile(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              zetToets(VOORBEELD_TOETS_TEKST, "Voorbeeldtoets");
              toast.success("Voorbeeldtoets als bron gezet.");
            }}
          >
            Voorbeeldtoets
          </Button>
        </div>
        {bronLabel ? (
          <div className="flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] bg-paper px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand">{bronLabel}</span>
            <span className="text-xs text-muted">toetsbron</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Bron verwijderen" onClick={wisToets}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">Nog geen toetsbron — kies een bestand of plak de toets (lange plak wordt bron).</p>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={feedback}
            onChange={(e) => setFeedback(e.target.checked)}
            className="size-4 accent-primary"
          />
          Ook feedback op deze toets
        </label>
      </div>
      {busy ? (
        <div role="status" className="rounded-[var(--radius-xl)] bg-surface p-6">
          <p className="flex items-center gap-2 font-semibold text-brand">
            <Loader2 className="size-4 animate-spin" /> Matrijs wordt opgebouwd…
          </p>
          <ol className="mt-3 grid gap-1 text-sm">
            {stappen.map((s, i) => (
              <li key={s} className={cn(i <= stap ? "text-fg" : "text-muted")}>
                {i < stap ? "Klaar — " : i === stap ? "Bezig — " : ""}
                {s}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      <Button type="submit" disabled={!canSubmit} className="h-auto min-h-20 w-full justify-between px-6 py-5 text-left [&_svg]:size-6">
        <span>
          <span className="block text-xl font-bold">{busy ? "Bezig…" : "Matrijs maken"}</span>
          <span className="mt-1 block text-sm font-medium opacity-80">Word-bestand volgt automatisch.</span>
        </span>
        {busy ? <Loader2 className="size-6 animate-spin" /> : <ArrowRight className="size-6" />}
      </Button>
    </form>
    </>

  );
}
