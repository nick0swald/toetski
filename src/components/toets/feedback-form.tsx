import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileDown, FileUp, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { KwaliteitPanel } from "@/components/toets/kwaliteit-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateToets } from "@/lib/toets/generate";
import { BRON_ACCEPT, bestandTeGroot, leesBronBestand } from "@/lib/toets/lees-bron";
import { totaalPunten } from "@/lib/toets/rtti";
import { kwaliteitAlsTekst, samenstellenFeedback, vorigeSamenvatting } from "@/lib/toets/text";
import { useToetsStore, persistToetsBeforeNavigate } from "@/store/toets-store";
import { cn } from "@/lib/utils";

export function FeedbackForm({ startId }: { startId?: string }) {
  const navigate = useNavigate();
  const toetsen = useToetsStore((s) => s.toetsen.filter((t) => t.soort !== "matrijs"));
  const stuurdocument = useToetsStore((s) => s.stuurdocument);
  const ensureVoorbeeld = useToetsStore((s) => s.ensureVoorbeeld);
  const [id, setId] = useState(startId ?? "");
  const [extra, setExtra] = useState("");
  const [bestandTekst, setBestandTekst] = useState("");
  const [bestandsnaam, setBestandsnaam] = useState<string | null>(null);
  const [gebruikSite, setGebruikSite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startId) setId(startId);
  }, [startId]);

  const toets = useMemo(() => toetsen.find((t) => t.id === id), [toetsen, id]);

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
        toast.error("Geen tekst in dit bestand.");
        return;
      }
      setBestandTekst(result.text);
      setBestandsnaam(file.name);
      toast.success(`Ingelezen: ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dit bestand kon niet worden gelezen.");
    }
  }

  async function onSubmit() {
    if (!toets) return;
    const feedback = samenstellenFeedback({
      siteTekst: gebruikSite ? kwaliteitAlsTekst(toets) : "",
      extra,
      bestandTekst,
    });
    if (!feedback.trim()) {
      toast.error("Typ een wijziging, lever Word in, of vink de website-feedback aan.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await generateToets({
        data: {
          titel: toets.meta.titel,
          vak: toets.meta.vak,
          leerweg: toets.meta.leerweg,
          leerjaar: toets.meta.leerjaar,
          duurMinuten: toets.meta.duurMinuten,
          doelPunten: Math.min(100, Math.max(10, totaalPunten(toets.vragen))),
          aantalVragen: Math.min(16, Math.max(4, toets.vragen.length)),
          rttiDoel: toets.matrijs.doelverdeling,
          bronmateriaal: toets.bronmateriaal,
          extraEisen: toets.extraEisen,
          versie: toets.meta.versie,
          moeilijkheid: toets.meta.moeilijkheid,
          cijferNorm: toets.cijferNorm,
          ronde: (toets.ronde ?? 1) + 1,
          parentId: toets.id,
          feedback,
          vorigeSamenvatting: vorigeSamenvatting(toets),
          stuurdocument: stuurdocument.trim() || undefined,
        },
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      const toetsId = await persistToetsBeforeNavigate(result.toets);
      try {
        const { downloadPakketDocx } = await import("@/lib/toets/docx-export");
        await downloadPakketDocx(result.toets);
        toast.success("Aangepaste toets als Word gedownload.");
      } catch {
        toast.error("Download geblokkeerd. Tik Word op de toets.");
      }
      navigate({ to: "/toets/$id", params: { id: toetsId } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Aanpassen mislukt.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (toetsen.length === 0) {
    return (
      <div className="rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-brand">Feedback</h1>
        <p className="mt-3 leading-relaxed text-muted">
          Nog geen toets op dit apparaat. Maak er een, of open het voorbeeld.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/">Toets maken</Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const t = ensureVoorbeeld();
              navigate({ to: "/feedback", search: { id: t.id } });
            }}
          >
            Voorbeeldtoets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-brand">Feedback</h1>
        <p className="mt-3 max-w-xl leading-relaxed text-muted">
          Geef wijzigingen op een gemaakte toets: de kwaliteitscheck van de website, eigen tekst, of een
          Word-bestand.
        </p>
      </header>
      <div className="grid gap-3 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
        <Label htmlFor="kies-toets">Toets</Label>
        <select
          id="kies-toets"
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            navigate({ to: "/feedback", search: { id: e.target.value } });
          }}
          className="flex h-12 w-full rounded-[var(--radius-md)] bg-paper px-4 text-sm"
        >
          <option value="">Kies een toets</option>
          {toetsen.map((t) => (
            <option key={t.id} value={t.id}>
              {t.meta.titel} · {t.meta.vak}
            </option>
          ))}
        </select>
      </div>
      {toets ? (
        <>
          <div className="rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-brand">Feedback van de website</h2>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  const { downloadKwaliteitDocx } = await import("@/lib/toets/docx-export");
                  await downloadKwaliteitDocx(toets);
                  toast.success("Feedback als Word gedownload.");
                }}
              >
                <FileDown className="size-4" />
                Word
              </Button>
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-[var(--radius-md)] bg-paper p-4 text-sm">
              <input
                type="checkbox"
                checked={gebruikSite}
                onChange={(e) => setGebruikSite(e.target.checked)}
                className="mt-1 size-4 accent-primary"
              />
              <span>Gebruik deze feedback bij het aanpassen van de toets.</span>
            </label>
            <div className="mt-6">
              <KwaliteitPanel toets={toets} />
            </div>
          </div>
          <div className="grid gap-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-brand">Eigen wijzigingen</h2>
            <Textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Bijv. vraag 7 korter, andere context bij vraag 3."
              className="min-h-32 bg-paper"
            />
            <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-paper px-4 text-sm font-semibold text-brand">
              <FileUp className="size-4" />
              {bestandsnaam ?? "Word of pdf"}
              <input type="file" accept={BRON_ACCEPT} className="sr-only" onChange={(e) => onFile(e.target.files)} />
            </label>
          </div>
          {error ? <p className="text-sm text-warn">{error}</p> : null}
          <Button
            type="button"
            disabled={busy}
            onClick={() => void onSubmit()}
            className="h-auto min-h-20 w-full justify-between px-6 py-5 text-left [&_svg]:size-6"
          >
            <span>
              <span className="block text-xl font-bold">{busy ? "Bezig…" : "Toets aanpassen"}</span>
              <span className={cn("mt-1 block text-sm font-medium opacity-80")}>Nieuwe ronde, Word volgt vanzelf.</span>
            </span>
            {busy ? <Loader2 className="size-6 animate-spin" /> : <ArrowRight className="size-6" />}
          </Button>
        </>
      ) : null}
    </div>
  );
}
