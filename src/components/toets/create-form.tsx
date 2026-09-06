import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, FileUp, Loader2, ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CijferNormControls } from "@/components/toets/cijfer-norm-controls";
import { RttiPicker } from "@/components/toets/rtti-picker";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LEERWEGEN,
  MOEILIJKHEDEN,
  RTTI_PRESETS,
  VAKPROFIELEN,
  VERSIES,
  presetVoorLeerjaar,
  rttiVoorMoeilijkheid,
} from "@/lib/toets/constants";
import { generateToets } from "@/lib/toets/generate";
import { leesBronBestand } from "@/lib/toets/lees-bron";
import { VOORBEELD_LESSTOF, VOORBEELD_NASK_LESSTOF } from "@/lib/toets/sample";
import { bevestigingsRegel, DEFAULT_CIJFER } from "@/lib/toets/cijfer";
import type {
  CijferNorm,
  GenerateInput,
  Leerweg,
  Moeilijkheid,
  RttiVerdeling,
  ToetsVersie,
  VakProfiel,
} from "@/lib/toets/types";
import { useToetsStore } from "@/store/toets-store";
import { cn } from "@/lib/utils";

const STAPPEN = [
  "Lesstof lezen",
  "Toetsmatrijs met RTTI",
  "Vragen in Cito-stijl",
  "Nakijkmodel en Word-bestand",
];

export function CreateForm() {
  const navigate = useNavigate();
  const upsert = useToetsStore((s) => s.upsert);

  const [titel, setTitel] = useState("");
  const [vak, setVak] = useState("");
  const [leerweg, setLeerweg] = useState<Leerweg>("KB");
  const [leerjaar, setLeerjaar] = useState<1 | 2 | 3 | 4>(2);
  const [versie, setVersie] = useState<ToetsVersie>("A");
  const [moeilijkheid, setMoeilijkheid] = useState<Moeilijkheid>("normaal");
  const [duur, setDuur] = useState(50);
  const [punten, setPunten] = useState(40);
  const [aantal, setAantal] = useState(10);
  const [rtti, setRtti] = useState<RttiVerdeling>(
    rttiVoorMoeilijkheid(RTTI_PRESETS.onderbouw.verdeling, "normaal"),
  );
  const [cijferNorm, setCijferNorm] = useState<CijferNorm>(DEFAULT_CIJFER);
  const [vakProfiel, setVakProfiel] = useState<VakProfiel>("generiek");
  const [bron, setBron] = useState("");
  const [url, setUrl] = useState("");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [stap, setStap] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = (bron.trim().length > 0 || url.trim().length > 8) && !busy;

  function rttiVoorJaar(jaar: 1 | 2 | 3 | 4, m: Moeilijkheid) {
    const id = presetVoorLeerjaar(jaar);
    return rttiVoorMoeilijkheid(RTTI_PRESETS[id].verdeling, m);
  }

  function applyJaar(jaar: 1 | 2 | 3 | 4) {
    setLeerjaar(jaar);
    setRtti(rttiVoorJaar(jaar, moeilijkheid));
  }

  function applyMoeilijkheid(m: Moeilijkheid) {
    setMoeilijkheid(m);
    setRtti(rttiVoorJaar(leerjaar, m));
  }

  function applyRtti(next: RttiVerdeling) {
    setRtti(next);
  }

  function applyProfiel(p: VakProfiel) {
    setVakProfiel(p);
    if (p === "nask") {
      if (!vak.trim()) setVak("NaSk");
      setRtti(rttiVoorJaar(leerjaar, moeilijkheid));
    } else if (vak === "NaSk") {
      setVak("");
    }
  }

  const regel = bevestigingsRegel({
    leerweg,
    leerjaar,
    versie,
    moeilijkheid,
    duurMinuten: duur,
    aantalVragen: aantal,
    doelPunten: punten,
    model: cijferNorm.model,
  });
  const regelMetProfiel = vakProfiel === "nask" ? `${regel} · vakprofiel NaSk` : regel;

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
        toast.error("Geen tekst in dit bestand. Plak de inhoud.");
        return;
      }
      setBron((prev) => (prev ? `${prev}\n\n${text}` : text));
      toast.success(`Ingelezen: ${file.name}`);
    } catch {
      toast.error("Dit bestand kon niet worden gelezen. Plak de tekst.");
    }
  }

  async function onWijzigFile(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("Bestand is te groot (max. 2 MB).");
      return;
    }
    try {
      const text = await leesBronBestand(file);
      if (!text) {
        toast.error("Geen tekst in dit bestand. Typ de wijzigingen.");
        return;
      }
      setExtra((prev) => (prev ? `${prev}\n\n${text}` : text));
      toast.success(`Wijzigingen ingelezen: ${file.name}`);
    } catch {
      toast.error("Dit bestand kon niet worden gelezen. Typ de wijzigingen.");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setStap(0);
    const timer = window.setInterval(() => {
      setStap((s) => (s < STAPPEN.length - 1 ? s + 1 : s));
    }, 2200);

    const input: GenerateInput = {
      titel: titel.trim(),
      vak: vak.trim(),
      leerweg,
      leerjaar,
      duurMinuten: duur,
      doelPunten: punten,
      aantalVragen: aantal,
      rttiDoel: rtti,
      bronmateriaal: bron,
      extraEisen: extra,
      bronUrl: url.trim() || undefined,
      versie,
      moeilijkheid,
      cijferNorm,
      vakProfiel,
      ronde: 1,
    };

    try {
      const result = await generateToets({ data: input });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      upsert(result.toets);
      try {
        const { downloadPakketDocx } = await import("@/lib/toets/docx-export");
        await downloadPakketDocx(result.toets);
        toast.success("Word-pakket gedownload.");
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Download werd geblokkeerd. Tik Word op de toets.",
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
          Toets maken
        </h1>
        <p className="mt-3 max-w-xl text-pretty leading-relaxed text-muted">
          Plak alleen de lesstof → Toets maken. Het Word-pakket (leerlingblad,
          nakijkmodel, matrijs, cijfer) downloadt vanzelf. Tik Word als dat
          niet gebeurt.
        </p>
        <p className="mt-4 text-sm font-medium leading-relaxed text-brand">
          {regelMetProfiel}
        </p>
      </header>

      <div className="grid min-w-0 gap-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand">Lesstof</h2>
          <p className="mt-2 leading-relaxed text-muted">
            Plak de tekst, of kies een bestand of openbare link.
          </p>
        </div>
        <Label htmlFor="bron" className="sr-only">
          Lesstof
        </Label>
        <Textarea
          id="bron"
          value={bron}
          onChange={(e) => setBron(e.target.value)}
          placeholder="Plak de lesstof. Titel, vak en leerdoelen worden vanzelf ingevuld."
          className="min-h-56 bg-paper"
        />
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
              setVakProfiel("generiek");
              if (vak === "NaSk") setVak("");
              setBron(VOORBEELD_LESSTOF);
              toast.success("Voorbeeldstof ingevuld. Tik Toets maken.");
            }}
          >
            Voorbeeldstof
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setVakProfiel("nask");
              setVak("NaSk");
              setBron(VOORBEELD_NASK_LESSTOF);
              toast.success("Voorbeeld NaSk ingevuld. Check de regel en tik Toets maken.");
            }}
          >
            Voorbeeld NaSk
          </Button>
          <Input
            id="url"
            type="url"
            inputMode="url"
            placeholder="Of een openbare link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="sm:flex-1"
          />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand">
            Wijzigingen
          </h2>
          <p className="mt-2 leading-relaxed text-muted">
            Extra wensen bij deze toets: typ ze, of lever een Word-bestand in.
            Ze gaan mee in deze ronde.
          </p>
        </div>
        <Label htmlFor="extra" className="sr-only">
          Wijzigingen of extra wensen
        </Label>
        <Textarea
          id="extra"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Bijv. geen meerkeuze, kortere stam bij vraag 3, of een andere context."
          className="min-h-32 bg-paper"
        />
        <label
          htmlFor="wijzig-bestand"
          className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-paper px-4 text-sm font-semibold text-brand hover:opacity-90"
        >
          <FileUp className="size-4 shrink-0" />
          Word-bestand
          <input
            id="wijzig-bestand"
            type="file"
            accept=".txt,.md,.docx,.doc,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(e) => onWijzigFile(e.target.files)}
          />
        </label>
      </div>

      <details className="group min-w-0 overflow-hidden rounded-[var(--radius-xl)] bg-surface">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-6 py-5 text-2xl font-bold tracking-tight text-brand hover:opacity-80 sm:px-8 [&::-webkit-details-marker]:hidden">
          Instellingen
          <ChevronDown className="size-5 shrink-0 text-muted transition-transform duration-[var(--motion-quick)] ease-[var(--ease-out)] group-open:rotate-180" />
        </summary>
        <div className="grid gap-6 px-6 pb-8 pt-1 sm:px-8">
          <p className="leading-relaxed text-muted">
            Standaard: KB klas 2, versie A, normaal, lineair 1,0–10,0. HGL volgt
            GT. Leeg vak = automatisch uit de lesstof. De regel boven Toets
            maken toont altijd wat er meegaat. NaSk: rekenmachine alleen waar
            nodig, geen boek, RTTI volgens leerjaar.
          </p>
          <Choice
            legend="Vakprofiel"
            value={vakProfiel}
            onChange={applyProfiel}
            options={VAKPROFIELEN}
          />
          <div className="grid gap-2">
            <Label htmlFor="titel">Titel</Label>
            <Input
              id="titel"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Leeg = automatisch"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vak">Vak</Label>
            <Input
              id="vak"
              value={vak}
              onChange={(e) => setVak(e.target.value)}
              placeholder="Leeg = automatisch uit de lesstof"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="jaar">Leerjaar</Label>
            <select
              id="jaar"
              value={leerjaar}
              onChange={(e) => applyJaar(Number(e.target.value) as 1 | 2 | 3 | 4)}
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
            legend="Niveau"
            value={leerweg}
            onChange={setLeerweg}
            options={LEERWEGEN}
          />
          <Choice
            legend="Versie"
            value={versie}
            onChange={setVersie}
            options={VERSIES}
          />

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="duur">Minuten</Label>
              <Input
                id="duur"
                type="number"
                min={10}
                max={180}
                value={duur}
                onChange={(e) => setDuur(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="punten">Punten</Label>
              <Input
                id="punten"
                type="number"
                min={10}
                max={100}
                value={punten}
                onChange={(e) => setPunten(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="aantal">Vragen</Label>
              <Input
                id="aantal"
                type="number"
                min={4}
                max={16}
                value={aantal}
                onChange={(e) => setAantal(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <h3 className="text-sm font-semibold text-brand">Cijfernorm</h3>
            <CijferNormControls
              value={cijferNorm}
              onChange={setCijferNorm}
              max={punten}
            />
          </div>

          <div className="grid gap-3">
            <Choice
              legend="Moeilijkheid"
              value={moeilijkheid}
              onChange={applyMoeilijkheid}
              options={MOEILIJKHEDEN}
            />
            <RttiPicker value={rtti} onChange={applyRtti} />
          </div>
        </div>
      </details>

      {busy ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8"
        >
          <p className="flex items-center gap-2 font-semibold text-brand">
            <Loader2 className="size-4 animate-spin" />
            Toets wordt opgebouwd…
          </p>
          <ol className="mt-3 grid gap-1 text-sm">
            {STAPPEN.map((s, i) => (
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
          {regelMetProfiel}
        </p>
      </div>

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-auto min-h-20 w-full justify-between rounded-[var(--radius-lg)] px-6 py-5 text-left sm:px-8 [&_svg]:size-6"
      >
        <span className="min-w-0">
          <span className="block text-xl font-bold">
            {busy ? "Bezig…" : "Toets maken"}
          </span>
          <span className="mt-1 block text-sm font-medium opacity-80">
            Word-pakket volgt automatisch.
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
