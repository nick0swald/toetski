import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, FileUp, Loader2, X } from "lucide-react";
import { useState, type DragEvent, type FormEvent } from "react";
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
  VERSIES,
  presetVoorLeerjaar,
  rttiVoorMoeilijkheid,
} from "@/lib/toets/constants";
import { generateToets } from "@/lib/toets/generate";
import {
  herkenBatch,
  herkenBron,
  isUrlRegel,
  rolLabel,
  type BronRol,
} from "@/lib/toets/herken-bron";
import {
  BRON_ACCEPT,
  MAX_ANTWOORD_TEKENS,
  MAX_BRON_TEKENS,
  bestandTeGroot,
  leesBronBestand,
} from "@/lib/toets/lees-bron";
import { VOORBEELD_LESSTOF } from "@/lib/toets/sample";
import { DEFAULT_CIJFER } from "@/lib/toets/cijfer";
import type { CijferNorm, GenerateInput, Leerweg, Moeilijkheid, RttiVerdeling, ToetsVersie } from "@/lib/toets/types";
import { useToetsStore, persistToetsBeforeNavigate } from "@/store/toets-store";
import { cn } from "@/lib/utils";

const STAPPEN = ["Lesstof lezen", "Toetsmatrijs met RTTI", "Vragen in Cito-stijl", "Nakijkmodel en Word-bestand"];

type Stuk = {
  id: string;
  rol: BronRol;
  naam: string;
  reden: string;
  tekst: string;
};

function nieuwId(): string {
  return crypto.randomUUID();
}

function veldenUitStukken(stukken: Stuk[]): {
  bron: string;
  antwoorden: string;
  extra: string;
  url: string;
} {
  const blok = (s: Stuk) =>
    s.naam && s.naam !== "tekstvak" && s.naam !== "plaktekst"
      ? `--- ${s.naam} ---\n${s.tekst}`
      : s.tekst;
  const bron = stukken.filter((s) => s.rol === "lesstof").map(blok).join("\n\n");
  const antwoorden = stukken.filter((s) => s.rol === "antwoorden").map(blok).join("\n\n");
  const extra = stukken.filter((s) => s.rol === "notities").map(blok).join("\n\n");
  return {
    bron: bron.length > MAX_BRON_TEKENS ? bron.slice(0, MAX_BRON_TEKENS) : bron,
    antwoorden:
      antwoorden.length > MAX_ANTWOORD_TEKENS
        ? antwoorden.slice(0, MAX_ANTWOORD_TEKENS)
        : antwoorden,
    extra,
    url: stukken.find((s) => s.rol === "url")?.tekst.trim() ?? "",
  };
}


function vriendelijkeFout(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (/too_big|antwoordenmateriaal|bronmateriaal|Too big: expected string/i.test(raw)) {
    return "Dit bestand is te dik voor één keer. De tekst wordt automatisch ingekort — probeer opnieuw. Lukt het niet, upload leerlingboek en antwoordenboek apart.";
  }
  return raw || "Er ging iets mis bij het maken.";
}

export function CreateForm() {
  const navigate = useNavigate();
  const stuurdocument = useToetsStore((s) => s.stuurdocument);
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
  const [stukken, setStukken] = useState<Stuk[]>([]);
  const [vrijeTekst, setVrijeTekst] = useState("");
  const [overDrop, setOverDrop] = useState(false);
  const [lezend, setLezend] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stap, setStap] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const velden = veldenUitStukken(stukken);
  const canSubmit =
    (velden.bron.trim().length > 0 || velden.url.trim().length > 8 || vrijeTekst.trim().length > 0) &&
    !busy &&
    !lezend;

  function rttiVoorJaar(jaar: 1 | 2 | 3 | 4, m: Moeilijkheid) {
    return rttiVoorMoeilijkheid(RTTI_PRESETS[presetVoorLeerjaar(jaar)].verdeling, m);
  }

  function ctxVan(list: Stuk[]) {
    return {
      heeftLesstof: list.some((s) => s.rol === "lesstof"),
      heeftAntwoorden: list.some((s) => s.rol === "antwoorden"),
    };
  }

  function voegStukkenToe(nieuwe: Omit<Stuk, "id">[]) {
    setStukken((prev) => {
      const next = [...prev];
      for (const n of nieuwe) {
        next.push({ ...n, id: nieuwId() });
      }
      return next;
    });
    for (const n of nieuwe) {
      toast.success(`${rolLabel(n.rol)} herkend · ${n.naam === "tekstvak" || n.naam === "plaktekst" ? n.reden : n.naam}`);
    }
  }

  async function verwerkBestanden(files: File[]) {
    if (!files.length) return;
    setLezend("Bestand lezen…");
    try {
      const gelezen: { naam: string; tekst: string }[] = [];
      for (const file of files) {
        if (bestandTeGroot(file)) {
          toast.error(`${file.name} is te groot (max. 40 MB).`);
          continue;
        }
        try {
          const result = await leesBronBestand(file, MAX_BRON_TEKENS, (v) => {
            if (v.fase === "ocr") {
              setLezend(
                v.pagina === 0
                  ? `Scan zonder tekstlaag · ${v.totaal} pagina’s worden gelezen`
                  : `Scan lezen · pagina ${v.pagina} van ${v.totaal}`,
              );
            } else if (v.pagina === 0) {
              setLezend("Pdf openen…");
            } else {
              setLezend(`Pdf lezen · pagina ${v.pagina} van ${v.totaal}`);
            }
          });
          if (!result.text) {
            toast.error(`Geen tekst in ${file.name}.`);
            continue;
          }
          const pagina =
            result.paginaAantal != null ? ` · ${result.paginaAantal} pagina’s` : "";
          const scan = result.scan ? " · scan gelezen" : "";
          gelezen.push({
            naam: `${file.name}${pagina}${scan}${result.afgekapt ? " · ingekort" : ""}`,
            tekst: result.text.slice(0, MAX_BRON_TEKENS),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : `${file.name} kon niet worden gelezen.`;
          setError(msg);
          toast.error(msg);
        }
      }
      if (!gelezen.length) return;
      const hits = herkenBatch(gelezen, ctxVan(stukken));
      voegStukkenToe(hits.map((h) => ({ rol: h.rol, naam: h.naam, reden: h.reden, tekst: h.tekst })));
    } finally {
      setLezend(null);
    }
  }

  function verwerkPlak(tekst: string): boolean {
    const t = tekst.trim();
    if (!t) return false;
    if (isUrlRegel(t)) {
      voegStukkenToe([{ rol: "url", naam: t, reden: "Link uit de balk of plak.", tekst: t }]);
      return true;
    }
    const hit = herkenBron("plaktekst", t, ctxVan(stukken));
    if (hit.rol === "lesstof" && !stukken.some((s) => s.rol === "lesstof")) {
      return false;
    }
    if (hit.rol !== "lesstof") {
      voegStukkenToe([{ rol: hit.rol, naam: "plaktekst", reden: hit.reden, tekst: t }]);
      return true;
    }
    return false;
  }

  function zetRol(id: string, rol: BronRol) {
    setStukken((prev) => prev.map((s) => (s.id === id ? { ...s, rol, reden: "Zelf aangepast." } : s)));
  }

  function verwijderStuk(id: string) {
    setStukken((prev) => prev.filter((s) => s.id !== id));
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    setOverDrop(false);
    const files = [...e.dataTransfer.files];
    const tekst = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (files.length) {
      await verwerkBestanden(files);
      return;
    }
    if (tekst.trim()) {
      if (!verwerkPlak(tekst)) {
        setVrijeTekst((prev) => (prev ? `${prev}\n\n${tekst.trim()}` : tekst.trim()));
      }
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    let actief = stukken;
    const vrij = vrijeTekst.trim();
    if (vrij) {
      const hit = isUrlRegel(vrij)
        ? { rol: "url" as const, reden: "Link uit het tekstvak." }
        : herkenBron("tekstvak", vrij, ctxVan(stukken));
      actief = [...actief, { id: nieuwId(), rol: hit.rol, naam: "tekstvak", reden: hit.reden, tekst: vrij }];
    }
    const v = veldenUitStukken(actief);
    if (!v.bron.trim() && !v.url.trim()) {
      toast.error("Drop lesstof of een leerlingboek, of plak tekst.");
      return;
    }
    setBusy(true);
    setError(null);
    setStap(0);
    const timer = window.setInterval(() => setStap((s) => (s < STAPPEN.length - 1 ? s + 1 : s)), 2200);
    const input: GenerateInput = {
      titel: titel.trim(),
      vak: vak.trim(),
      leerweg,
      leerjaar,
      duurMinuten: duur,
      doelPunten: punten,
      aantalVragen: aantal,
      rttiDoel: rtti,
      bronmateriaal: v.bron,
      extraEisen: v.extra,
      bronUrl: v.url.trim() || undefined,
      antwoordenmateriaal: v.antwoorden.trim() || undefined,
      versie,
      moeilijkheid,
      cijferNorm,
      ronde: 1,
      stuurdocument: stuurdocument.trim() || undefined,
    };
    try {
      const result = await generateToets({ data: input });
      if (!result.ok) {
        const msg = vriendelijkeFout(new Error(result.error));
        setError(msg);
        toast.error(msg);
        return;
      }
      const toetsId = await persistToetsBeforeNavigate(result.toets);
      try {
        const { downloadPakketDocx } = await import("@/lib/toets/docx-export");
        await downloadPakketDocx(result.toets);
        toast.success("Word-pakket gedownload.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Download werd geblokkeerd. Tik Word op de toets.");
      }
      navigate({ to: "/toets/$id", params: { id: toetsId } });
    } catch (err) {
      const msg = vriendelijkeFout(err);
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
        <h1 className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">Toets maken</h1>
        <p className="mt-3 max-w-xl text-pretty leading-relaxed text-muted">
          Drop het leerlingboek, antwoordenboek of notities. Ook een scan zonder tekstlaag. Daarna: Toets maken.
        </p>
      </header>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setOverDrop(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOverDrop(true);
        }}
        onDragLeave={() => setOverDrop(false)}
        onDrop={(e) => void onDrop(e)}
        className={cn(
          "grid min-w-0 gap-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
          overDrop && "ring-2 ring-primary ring-offset-4 ring-offset-bg",
        )}
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand">Drop en herken</h2>
          <p className="mt-2 leading-relaxed text-muted">
            De maker zet zelf leerlingboek, antwoordenboek, notities of een link uit elkaar. Een scan van het (antwoorden)boek wordt pagina voor pagina gelezen. Tik een chip als het misgaat.
          </p>
        </div>
        <Textarea
          id="bron"
          value={vrijeTekst}
          onChange={(e) => setVrijeTekst(e.target.value)}
          onPaste={(e) => {
            const files = [...e.clipboardData.files];
            if (files.length) {
              e.preventDefault();
              void verwerkBestanden(files);
              return;
            }
            const text = e.clipboardData.getData("text/plain");
            if (verwerkPlak(text)) e.preventDefault();
          }}
          placeholder="Drop pdf of Word (ook scans), of plak lesstof, notities of een link."
          className="min-h-44 bg-paper"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label
            htmlFor="drop-bestanden"
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-paper px-4 text-sm font-semibold text-brand hover:opacity-90"
          >
            <FileUp className="size-4 shrink-0" />
            {lezend ?? "Bestanden"}
            <input
              id="drop-bestanden"
              type="file"
              multiple
              accept={BRON_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                void verwerkBestanden([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              voegStukkenToe([
                {
                  rol: "lesstof",
                  naam: "voorbeeldstof",
                  reden: "Voorbeeldlesstof biologie.",
                  tekst: VOORBEELD_LESSTOF,
                },
              ]);
            }}
          >
            Voorbeeldstof
          </Button>
          <Input
            id="url"
            type="url"
            inputMode="url"
            placeholder="Of drop / plak een openbare link"
            value={velden.url}
            onChange={(e) => {
              const waarde = e.target.value;
              setStukken((prev) => {
                const rest = prev.filter((s) => s.rol !== "url");
                if (!waarde.trim()) return rest;
                return [...rest, { id: nieuwId(), rol: "url", naam: waarde.trim(), reden: "Link via de balk.", tekst: waarde.trim() }];
              });
            }}
            className="sm:flex-1"
          />
        </div>
        {lezend ? (
          <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-semibold text-brand">
            <Loader2 className="size-4 animate-spin" />
            {lezend}
          </p>
        ) : null}
        {stukken.length ? (
          <ul className="grid gap-2">
            {stukken.map((s) => (
              <li
                key={s.id}
                className="flex min-w-0 flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-paper px-3 py-2"
              >
                <select
                  aria-label={`Soort voor ${s.naam}`}
                  value={s.rol}
                  onChange={(e) => zetRol(s.id, e.target.value as BronRol)}
                  className="h-11 rounded-[var(--radius-md)] bg-surface px-2 text-sm font-semibold text-brand"
                >
                  <option value="lesstof">Leerlingboek</option>
                  <option value="antwoorden">Antwoordenboek</option>
                  <option value="notities">Notities</option>
                  <option value="url">Link</option>
                </select>
                <span className="min-w-0 flex-1 truncate text-sm text-muted">
                  {s.naam === "tekstvak" || s.naam === "plaktekst" ? s.reden : s.naam}
                </span>
                <Button type="button" variant="ghost" size="icon" aria-label="Verwijderen" onClick={() => verwijderStuk(s.id)}>
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <details className="group min-w-0 overflow-hidden rounded-[var(--radius-xl)] bg-surface">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-6 py-5 text-2xl font-bold tracking-tight text-brand hover:opacity-80 sm:px-8 [&::-webkit-details-marker]:hidden">
          Instellingen
          <ChevronDown className="size-5 shrink-0 text-muted transition-transform duration-[var(--motion-quick)] ease-[var(--ease-out)] group-open:rotate-180" />
        </summary>
        <div className="grid gap-6 px-6 pb-8 pt-1 sm:px-8">
          <div className="grid gap-2">
            <Label htmlFor="titel">Titel</Label>
            <Input id="titel" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Leeg = automatisch" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vak">Vak</Label>
            <Input id="vak" value={vak} onChange={(e) => setVak(e.target.value)} placeholder="Leeg = automatisch uit de lesstof" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="jaar">Leerjaar</Label>
            <select
              id="jaar"
              value={leerjaar}
              onChange={(e) => {
                const jaar = Number(e.target.value) as 1 | 2 | 3 | 4;
                setLeerjaar(jaar);
                setRtti(rttiVoorJaar(jaar, moeilijkheid));
              }}
              className="flex h-12 w-full rounded-[var(--radius-md)] border border-transparent bg-paper px-4 text-sm text-fg"
            >
              {[1, 2, 3, 4].map((j) => (
                <option key={j} value={j}>
                  Klas {j}
                </option>
              ))}
            </select>
          </div>
          <Choice legend="Niveau" value={leerweg} onChange={setLeerweg} options={LEERWEGEN} />
          <Choice legend="Versie" value={versie} onChange={setVersie} options={VERSIES} />
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="duur">Minuten</Label>
              <Input id="duur" type="number" min={10} max={180} value={duur} onChange={(e) => setDuur(Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="punten">Punten</Label>
              <Input id="punten" type="number" min={10} max={100} value={punten} onChange={(e) => setPunten(Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="aantal">Vragen</Label>
              <Input id="aantal" type="number" min={4} max={16} value={aantal} onChange={(e) => setAantal(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold text-brand">Cijfernorm</h3>
            <CijferNormControls value={cijferNorm} onChange={setCijferNorm} max={punten} />
          </div>
          <Choice
            legend="Moeilijkheid"
            value={moeilijkheid}
            onChange={(m) => {
              setMoeilijkheid(m);
              setRtti(rttiVoorJaar(leerjaar, m));
            }}
            options={MOEILIJKHEDEN}
          />
          <RttiPicker value={rtti} onChange={setRtti} />
        </div>
      </details>

      {busy ? (
        <div role="status" aria-live="polite" className="rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
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
      <Button type="submit" disabled={!canSubmit} className="h-auto min-h-20 w-full justify-between rounded-[var(--radius-lg)] px-6 py-5 text-left sm:px-8 [&_svg]:size-6">
        <span className="min-w-0">
          <span className="block text-xl font-bold">{busy ? "Bezig…" : "Toets maken"}</span>
          <span className="mt-1 block text-sm font-medium opacity-80">Word-pakket volgt automatisch.</span>
        </span>
        {busy ? <Loader2 className="size-6 shrink-0 animate-spin" /> : <ArrowRight className="size-6 shrink-0" />}
      </Button>
    </form>
  );
}
