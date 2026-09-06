import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileUp, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RTTI_PRESETS, RTTI_PRESET_KEUZES } from "@/lib/toets/constants";
import { generateMatrijs } from "@/lib/toets/generate";
import { leesBronBestand } from "@/lib/toets/lees-bron";
import { VOORBEELD_TOETS_TEKST } from "@/lib/toets/sample";
import { useToetsStore } from "@/store/toets-store";
import { cn } from "@/lib/utils";

export function MatrijsForm() {
  const navigate = useNavigate();
  const upsert = useToetsStore((s) => s.upsert);

  const [bron, setBron] = useState("");
  const [vak, setVak] = useState("");
  const [leerjaar, setLeerjaar] = useState<1 | 2 | 3 | 4>(2);
  const [preset, setPreset] = useState<keyof typeof RTTI_PRESETS>("onderbouw");
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
    if (file.size > 2_000_000) {
      toast.error("Bestand is te groot (max. 2 MB).");
      return;
    }
    try {
      const text = await leesBronBestand(file);
      if (!text) {
        toast.error("Geen tekst in dit bestand. Plak de toets.");
        return;
      }
      setBron(text);
      setBestandsnaam(file.name);
      toast.success(`Ingelezen: ${file.name}`);
    } catch {
      toast.error("Dit bestand kon niet worden gelezen. Plak de tekst.");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setStap(0);
    const timer = window.setInterval(() => {
      setStap((s) => (s < stappen.length - 1 ? s + 1 : s));
    }, 1800);

    try {
      const result = await generateMatrijs({
        data: {
          vak: vak.trim(),
          leerweg: "KB",
          leerjaar,
          rttiDoel: RTTI_PRESETS[preset].verdeling,
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
        toast.success(
          feedback ? "Matrijs en feedback gedownload." : "Matrijs gedownload.",
        );
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Download werd geblokkeerd. Tik Word op de matrijs.",
        );
      }
      navigate({ to: "/toets/$id", params: { id: result.toets.id } });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Er ging iets mis bij het maken.";
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
        <h1 className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">
          Matrijsmaker
        </h1>
        <p className="mt-3 max-w-xl text-pretty leading-relaxed text-muted">
          Lever een toets in die je al hebt. Geen kaders, geen nieuwe vragen —
          alleen de RTTI-matrijs als Word-bestand. Feedback is optioneel.
        </p>
      </header>

      <div className="grid min-w-0 gap-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand">
            Bestaande toets
          </h2>
          <p className="mt-2 leading-relaxed text-muted">
            Kies een Word-bestand, of plak de vragen.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label
            htmlFor="bestand"
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-paper px-4 text-sm font-semibold text-brand hover:opacity-90"
          >
            <FileUp className="size-4 shrink-0" />
            Bestand
            <input
              id="bestand"
              type="file"
              accept=".txt,.md,.csv,.json,.docx,.doc,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={(e) => onFile(e.target.files)}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setBron(VOORBEELD_TOETS_TEKST);
              setBestandsnaam(null);
              toast.success("Voorbeeldtoets ingevuld. Tik Matrijs maken.");
            }}
          >
            Voorbeeldtoets
          </Button>
          {bestandsnaam ? (
            <p className="text-sm text-muted">{bestandsnaam}</p>
          ) : null}
        </div>
        <Label htmlFor="bron" className="sr-only">
          Bestaande toets
        </Label>
        <Textarea
          id="bron"
          value={bron}
          onChange={(e) => {
            setBron(e.target.value);
            setBestandsnaam(null);
          }}
          placeholder="Of plak hier de bestaande toets."
          className="min-h-56 bg-paper"
        />
      </div>

      <div className="grid min-w-0 gap-5 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
        <div className="grid gap-2">
          <Label htmlFor="matrijs-vak">Vak</Label>
          <Input
            id="matrijs-vak"
            value={vak}
            onChange={(e) => setVak(e.target.value)}
            placeholder="Leeg = automatisch uit de toets"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="matrijs-jaar">Leerjaar</Label>
          <select
            id="matrijs-jaar"
            value={leerjaar}
            onChange={(e) => {
              const jaar = Number(e.target.value) as 1 | 2 | 3 | 4;
              setLeerjaar(jaar);
              setPreset(jaar <= 2 ? "onderbouw" : jaar === 4 ? "examen" : "bovenbouw");
            }}
            className="flex h-12 w-full rounded-[var(--radius-md)] border border-transparent bg-paper px-4 text-sm text-fg focus-visible:border-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {[1, 2, 3, 4].map((j) => (
              <option key={j} value={j}>
                Klas {j}
              </option>
            ))}
          </select>
        </div>
        <Choice
          legend="Doel-RTTI"
          value={preset}
          onChange={setPreset}
          options={RTTI_PRESET_KEUZES}
        />
      </div>

      <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-[var(--radius-xl)] bg-surface px-6 py-5 sm:px-8">
        <input
          id="feedback"
          type="checkbox"
          checked={feedback}
          onChange={(e) => setFeedback(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-primary"
        />
        <span>
          <span className="block font-bold text-brand">
            Feedback op deze toets
          </span>
          <span className="mt-1 block leading-relaxed text-muted">
            RTTI-spreiding, validiteit, taal en Cito-opmaak. Uit = alleen de
            matrijs.
          </span>
        </span>
      </label>

      {busy ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8"
        >
          <p className="flex items-center gap-2 font-semibold text-brand">
            <Loader2 className="size-4 animate-spin" />
            Matrijs wordt opgebouwd…
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

      <div className="rounded-[var(--radius-lg)] bg-surface px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Dit gaat mee
        </p>
        <p className="mt-1 text-sm font-medium leading-relaxed text-brand">
          {vak.trim() || "vak uit de toets"} · leerjaar {leerjaar} ·{" "}
          {RTTI_PRESETS[preset].label}
          {feedback ? " · met feedback" : " · alleen matrijs"}
        </p>
      </div>

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-auto min-h-20 w-full justify-between rounded-[var(--radius-lg)] px-6 py-5 text-left sm:px-8 [&_svg]:size-6"
      >
        <span className="min-w-0">
          <span className="block text-xl font-bold">
            {busy ? "Bezig…" : "Matrijs maken"}
          </span>
          <span className="mt-1 block text-sm font-medium opacity-80">
            {feedback
              ? "Toetsmatrijs plus feedback, als Word."
              : "Alleen de toetsmatrijs, als Word."}
          </span>
        </span>
        {busy ? (
          <Loader2 className="size-6 shrink-0 animate-spin" />
        ) : (
          <ArrowRight className="size-6 shrink-0" />
        )}
      </Button>
    </form>
  );
}
