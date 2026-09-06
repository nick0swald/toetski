import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileUp, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RTTI_PRESETS } from "@/lib/toets/constants";
import { generateMatrijs } from "@/lib/toets/generate";
import { BRON_ACCEPT, bestandTeGroot, leesBronBestand } from "@/lib/toets/lees-bron";
import { VOORBEELD_TOETS_TEKST } from "@/lib/toets/sample";
import { useToetsStore } from "@/store/toets-store";
import { cn } from "@/lib/utils";

export function MatrijsForm() {
  const navigate = useNavigate();
  const upsert = useToetsStore((s) => s.upsert);
  const [bron, setBron] = useState("");
  const [feedback, setFeedback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stap, setStap] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [bestandsnaam, setBestandsnaam] = useState<string | null>(null);

  const stappen = feedback
    ? ["Toets lezen", "Vragen en RTTI toewijzen", "Toetsmatrijs", "Feedback", "Word-bestand"]
    : ["Toets lezen", "Vragen en RTTI toewijzen", "Toetsmatrijs", "Word-bestand"];
  const canSubmit = bron.trim().length > 0 && !busy;

  async function onFile(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (bestandTeGroot(file)) {
      toast.error("Bestand is te groot (max. 40 MB).");
      return;
    }
    try {
      const result = await leesBronBestand(file, undefined, (v) => {
        if (v.fase === "ocr" && v.pagina > 0) {
          toast.message(`Scan lezen · pagina ${v.pagina} van ${v.totaal}`);
        }
      });
      if (!result.text) {
        toast.error("Geen tekst in dit bestand. Plak de toets.");
        return;
      }
      setBron(result.text);
      setBestandsnaam(file.name);
      toast.success(
        `Ingelezen: ${file.name}${result.paginaAantal ? ` · ${result.paginaAantal} pagina’s` : ""}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dit bestand kon niet worden gelezen. Plak de tekst.");
    }
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
          bronmateriaal: bron,
          feedbackGewenst: feedback,
        },
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      upsert(result.toets);
      try {
        const { downloadMatrijsDocx } = await import("@/lib/toets/docx-export");
        await downloadMatrijsDocx(result.toets);
        toast.success("Word-bestand gedownload.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Download geblokkeerd. Tik Word op de matrijs.");
      }
      navigate({ to: "/toets/$id", params: { id: result.toets.id } });
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
    <form onSubmit={onSubmit} className="grid min-w-0 gap-5">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">Matrijsmaker</h1>
        <p className="mt-3 max-w-xl text-pretty leading-relaxed text-muted">
          Lever een bestaande toets in. Je krijgt alleen de RTTI-matrijs als Word-bestand.
        </p>
      </header>
      <div className="grid min-w-0 gap-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
        <Label htmlFor="toets-bron">Bestaande toets</Label>
        <Textarea
          id="toets-bron"
          value={bron}
          onChange={(e) => setBron(e.target.value)}
          placeholder="Plak de toets, of kies een pdf of Word-bestand."
          className="min-h-56 bg-paper"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label
            htmlFor="toets-bestand"
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-paper px-4 text-sm font-semibold text-brand hover:opacity-90"
          >
            <FileUp className="size-4 shrink-0" />
            {bestandsnaam ?? "Bestand"}
            <input
              id="toets-bestand"
              type="file"
              accept={BRON_ACCEPT}
              className="sr-only"
              onChange={(e) => onFile(e.target.files)}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setBron(VOORBEELD_TOETS_TEKST);
              toast.success("Voorbeeldtoets ingevuld.");
            }}
          >
            Voorbeeldtoets
          </Button>
        </div>
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
  );
}
