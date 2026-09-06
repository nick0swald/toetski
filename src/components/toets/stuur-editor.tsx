import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CONSTRUCTOR_SLEUTEL_HASH, hashSleutel, stuurdocumentTekst } from "@/lib/toets/stuurdocument";
import { useToetsStore } from "@/store/toets-store";

const OPEN_KEY = "ares058-stuur-open";

export function StuurEditor() {
  const opgeslagen = useToetsStore((s) => s.stuurdocument);
  const setStuurdocument = useToetsStore((s) => s.setStuurdocument);
  const resetStuurdocument = useToetsStore((s) => s.resetStuurdocument);
  const [open, setOpen] = useState(false);
  const [sleutel, setSleutel] = useState("");
  const [tekst, setTekst] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(OPEN_KEY) === "1") setOpen(true);
  }, []);

  useEffect(() => {
    if (open) setTekst(opgeslagen.trim() || stuurdocumentTekst());
  }, [open, opgeslagen]);

  async function ontgrendel() {
    setBusy(true);
    try {
      const hash = await hashSleutel(sleutel);
      if (hash !== CONSTRUCTOR_SLEUTEL_HASH) {
        toast.error("Die sleutel klopt niet.");
        return;
      }
      sessionStorage.setItem(OPEN_KEY, "1");
      setOpen(true);
      setSleutel("");
    } finally {
      setBusy(false);
    }
  }

  function vergrendel() {
    sessionStorage.removeItem(OPEN_KEY);
    setOpen(false);
    setSleutel("");
  }

  function bewaren() {
    const next = tekst.trim();
    if (next.length < 40) {
      toast.error("Te kort.");
      return;
    }
    setStuurdocument(next);
    toast.success("Opgeslagen. Nieuwe toetsen volgen deze regels.");
  }

  function standaard() {
    resetStuurdocument();
    setTekst(stuurdocumentTekst());
    toast.success("Terug naar de standaard.");
  }

  if (!open) {
    return (
      <form
        className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void ontgrendel();
        }}
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-brand">Sleutel</span>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={sleutel}
            onChange={(e) => setSleutel(e.target.value)}
            placeholder="Sleutel"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={busy}>
          Openen
        </Button>
      </form>
    );
  }

  return (
    <div className="mt-6 grid gap-4">
      <Textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        className="min-h-80 font-mono text-[13px] leading-relaxed"
        aria-label="Regels bewerken"
      />
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={bewaren}>
          Bewaren
        </Button>
        <Button type="button" variant="secondary" onClick={standaard}>
          Standaard
        </Button>
        <Button type="button" variant="ghost" onClick={vergrendel}>
          Vergrendelen
        </Button>
      </div>
    </div>
  );
}
